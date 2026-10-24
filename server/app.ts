import express from 'express';
import multer from 'multer';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, readdir, realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { learnerSchema, type Section, type Source, type StudyState } from '../shared/models';
import { artifactKinds } from '../shared/artifacts';
import { DEFAULT_MODEL_ID, listModels, modelConfigured, SUPPORTED_MODELS } from './ai/model';
import { answerRequest } from './ai/run';
import { Store } from './store';
import { extractDocument } from './documents';
import { createPlan, planItems, replanExam, reviewCard } from './study';
import { buildCurriculum, refreshRelevance, refreshSupplementLinks } from './curriculum';
import { ingestRequest, loadPrompt, promptDirectory, queueRequest } from './tutor';

const extensions = new Set(['.pdf', '.md', '.txt']);
const reserved = new Set([
  'node_modules',
  'data',
  'dist',
  'src',
  'server',
  'shared',
  'tests',
  'docs',
  'test-results',
  'playwright-report',
]);
const nameSchema = z.string().trim().min(1).max(120);

function required<Item extends { id: string }>(items: Item[], id: string): Item {
  const item = items.find((entry) => entry.id === id);
  if (!item) throw Object.assign(new Error('Item not found.'), { status: 404 });
  return item;
}

export function createApp(
  workspaceRoot: string,
  store = new Store(path.join(workspaceRoot, 'data')),
) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 60 * 1024 * 1024, files: 12 },
    fileFilter: (_request, file, callback) => {
      if (!extensions.has(path.extname(file.originalname).toLowerCase()))
        return callback(new Error('Only PDF, Markdown and TXT files are supported.'));
      callback(null, true);
    },
  });
  async function importFiles(folderId: string, files: { name: string; buffer: Buffer }[]) {
    const folder = required((await store.read()).folders, folderId);
    const sources: Source[] = [];
    const sections: Section[] = [];
    for (const file of files) {
      const id = randomUUID();
      const extension = path.extname(file.name).toLowerCase();
      const extracted = await extractDocument(file.buffer, file.name, true);
      const savedName = `${id}--${path.basename(file.name).replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      await mkdir(path.dirname(store.sourcePath(folder, savedName)), { recursive: true });
      await writeFile(store.sourcePath(folder, savedName), file.buffer, {
        mode: 0o600,
      });
      sources.push({
        id,
        folderId,
        name: file.name,
        kind: extension.slice(1) as Source['kind'],
        pages: extracted.at(-1)?.pageEnd,
        addedAt: new Date().toISOString(),
        file: savedName,
        contentHash: createHash('sha256').update(file.buffer).digest('hex'),
      });
      sections.push(
        ...extracted.map((section) => ({
          ...section,
          id: randomUUID(),
          sourceId: id,
          folderId,
          read: false,
          sourceFragment: true,
          archived: true,
        })),
      );
    }
    await store.update((state) => {
      const current = required(state.folders, folderId);
      state.sources.push(...sources);
      state.sections.push(...sections);
      current.mainSourceId ??= sources[0]?.id;
      refreshRelevance(state, current);
      if (!state.chapters.some((chapter) => chapter.folderId === folderId))
        buildCurriculum(state, current);
      refreshSupplementLinks(state, current);
    });
    const saved = await store.read();
    const exam = required(saved.folders, folderId);
    if (!exam.outline && exam.mainSourceId) await queueRequest(store, folderId, 'outline');
    return {
      sourceCount: sources.length,
      sectionCount: saved.sections.filter(
        (section) => section.folderId === folderId && !section.archived,
      ).length,
      warnings: saved.sources
        .filter(
          (source) =>
            sources.some((item) => item.id === source.id) &&
            source.relevance?.status === 'needs-review',
        )
        .map((source) => `${source.name}: ${source.relevance?.reason}`),
    };
  }

  app.get('/api/health', (_request, response) => response.json({ ok: true }));
  app.get('/api/state', async (_request, response) => response.json(await store.read()));
  app.get('/api/export', async (_request, response) => {
    response.attachment('folio-study-backup.json').json(await store.read());
  });
  app.get('/api/workspace-folders', async (_request, response) => {
    const entries = await readdir(workspaceRoot, { withFileTypes: true });
    const folders = [];
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith('.') || reserved.has(entry.name)) continue;
      const files = (await readdir(path.join(workspaceRoot, entry.name), { withFileTypes: true }))
        .filter((file) => file.isFile() && extensions.has(path.extname(file.name).toLowerCase()))
        .map((file) => file.name);
      if (files.length) folders.push({ name: entry.name, files });
    }
    response.json(folders);
  });
  app.post('/api/folders', async (request, response) => {
    const { name, learner } = z
      .object({ name: nameSchema, learner: learnerSchema.optional() })
      .parse(request.body);
    const folder = {
      id: randomUUID(),
      name,
      createdAt: new Date().toISOString(),
      learner: learner ?? learnerSchema.parse({}),
    };
    await store.update((state) => state.folders.push(folder));
    response.status(201).json(folder);
  });
  app.post('/api/workspaces/upload', upload.array('files'), async (request, response) => {
    const files = request.files as Express.Multer.File[];
    if (!files?.length) throw new Error('Choose a PDF, Markdown or text source first.');
    const name = nameSchema.parse(request.body.name || path.parse(files[0].originalname).name);
    const learner = learnerSchema.parse({
      familiarity: request.body.familiarity ?? 'new',
      role: request.body.role ?? 'professional',
      goal: request.body.goal ?? '',
    });
    const folder = { id: randomUUID(), name, createdAt: new Date().toISOString(), learner };
    await store.update((state) => state.folders.push(folder));
    try {
      const result = await importFiles(
        folder.id,
        files.map((file) => ({
          name: Buffer.from(file.originalname, 'latin1').toString('utf8'),
          buffer: file.buffer,
        })),
      );
      response.status(201).json({ ...result, folder });
    } catch (error) {
      await store.update((state) => {
        state.folders = state.folders.filter((item) => item.id !== folder.id);
      });
      throw error;
    }
  });
  app.patch('/api/folders/:id', async (request, response) => {
    const settings = z
      .object({
        learner: learnerSchema.optional(),
        prompt: z.string().max(16000).optional(),
        modelId: z.string().optional(),
      })
      .parse(request.body);
    if (
      settings.modelId &&
      !SUPPORTED_MODELS.some((item) => item.id === settings.modelId && !item.hidden)
    )
      throw new Error('Unsupported AI model.');
    const folder = await store.update((state) => {
      const current = required(state.folders, request.params.id);
      const previousFamiliarity = current.learner?.familiarity;
      const { modelId, ...rest } = settings;
      Object.assign(current, rest);
      if (modelId !== undefined) current.modelId = modelId || undefined;
      if (settings.learner && settings.learner.familiarity !== previousFamiliarity)
        replanExam(state, current);
      return current;
    });
    response.json(folder);
  });
  app.put('/api/folders/:id/main-source', async (request, response) => {
    const { sourceId, confirmRebuild } = z
      .object({ sourceId: z.string(), confirmRebuild: z.literal(true) })
      .parse(request.body);
    void confirmRebuild;
    await store.update((state) => {
      const folder = required(state.folders, request.params.id);
      const source = required(state.sources, sourceId);
      if (source.folderId !== folder.id || source.kind === 'topic')
        throw new Error('Select a file belonging to this exam.');
      folder.mainSourceId = source.id;
      for (const item of state.sources.filter((item) => item.folderId === folder.id))
        item.relevance = undefined;
      refreshRelevance(state, folder);
      buildCurriculum(state, folder);
    });
    await queueRequest(store, request.params.id, 'outline');
    response.json({
      ok: true,
      message:
        'Main source changed. Previous curriculum and progress are archived; an outline request was queued.',
    });
  });
  app.patch('/api/folders/:id/sources/:sourceId', async (request, response) => {
    const { status } = z.object({ status: z.enum(['accepted', 'excluded']) }).parse(request.body);
    await store.update((state) => {
      const folder = required(state.folders, request.params.id);
      const source = required(state.sources, request.params.sourceId);
      if (source.folderId !== folder.id || source.id === folder.mainSourceId)
        throw new Error('Only supplementary sources in this exam can be reviewed.');
      if (!source.relevance) throw new Error('Run exam preparation first.');
      source.relevance.status = status;
      source.relevance.reason =
        status === 'accepted'
          ? 'Explicitly accepted by the learner after reviewing the relevance warning.'
          : 'Excluded by the learner; never used as supplementary context.';
      source.relevance.method = 'Learner review override';
      refreshSupplementLinks(state, folder);
    });
    response.json({ ok: true });
  });
  app.post('/api/folders/:id/prepare', async (request, response) => {
    const state = await store.read();
    const folder = required(state.folders, request.params.id);
    const sources = state.sources.filter((source) => source.folderId === folder.id);
    const hashes = new Map<string, string>();
    for (const source of sources)
      if (source.file && !source.contentHash) {
        let buffer: Buffer;
        try {
          buffer = await readFile(store.sourcePath(folder, source.file));
        } catch {
          buffer = await readFile(
            path.join(store.directory, 'uploads', path.basename(source.file)),
          );
        }
        hashes.set(source.id, createHash('sha256').update(buffer).digest('hex'));
        const pages = await extractDocument(buffer, source.name, true);
        await store.update((current) => {
          for (const old of current.sections.filter(
            (section) => section.sourceId === source.id && !section.chapterId,
          ))
            old.archived = true;
          current.sections.push(
            ...pages.map((page) => ({
              ...page,
              id: randomUUID(),
              folderId: folder.id,
              sourceId: source.id,
              read: false,
              sourceFragment: true,
              archived: true,
            })),
          );
        });
      }
    await store.update((current) => {
      const exam = required(current.folders, folder.id);
      for (const source of current.sources)
        if (hashes.has(source.id)) source.contentHash = hashes.get(source.id);
      exam.mainSourceId ??= sources[0]?.id;
      exam.learner ??= learnerSchema.parse({});
      refreshRelevance(current, exam);
      buildCurriculum(current, exam);
    });
    await queueRequest(store, folder.id, 'outline');
    response.json({ ok: true });
  });
  app.get('/api/prompts', async (_request, response) => {
    const files = (await readdir(promptDirectory)).filter((file) => file.endsWith('.md')).sort();
    response.json(
      await Promise.all(
        files.map(async (file) => ({
          id: file.replace(/\.md$/, ''),
          version: (await loadPrompt(file.replace(/\.md$/, ''))).version,
          file: `prompts/${file}`,
        })),
      ),
    );
  });
  app.get('/api/models', (_request, response) => {
    response.json({ default: DEFAULT_MODEL_ID, auto: modelConfigured(), models: listModels() });
  });
  app.post('/api/folders/:id/requests', async (request, response) => {
    const { kind, targetId } = z
      .object({ kind: z.enum(artifactKinds), targetId: z.string().optional() })
      .parse(request.body);
    response
      .status(201)
      .json(await queueRequest(store, z.string().parse(request.params.id), kind, targetId));
  });
  app.post('/api/chapters/:id/materials', async (request, response) => {
    const state = await store.read();
    const chapter = required(state.chapters, request.params.id);
    const sections = state.sections.filter(
      (item) => item.chapterId === chapter.id && !item.archived,
    );
    if (!sections.length) throw new Error("Generate this chapter's sections first.");
    const queued = [];
    for (const section of sections)
      for (const kind of ['summary', 'flashcards', 'quiz'] as const)
        if (!section.artifacts?.[kind])
          queued.push(await queueRequest(store, chapter.folderId, kind, section.id));
    response.status(201).json(queued);
  });
  app.get('/api/requests/:id/prompt', async (request, response) => {
    const state = await store.read();
    const item = required(state.requests, request.params.id);
    const folder = required(state.folders, item.folderId);
    response.type('text/markdown; charset=utf-8');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.send(await readFile(store.generationPath(folder, `${item.id}.prompt.md`), 'utf8'));
  });
  app.post('/api/requests/:id/ingest', async (request, response) => {
    response.json(await ingestRequest(store, z.string().parse(request.params.id)));
  });
  app.post('/api/requests/:id/run', async (request, response) => {
    const id = z.string().parse(request.params.id);
    const { model } = z.object({ model: z.string().optional() }).parse(request.body ?? {});
    const state = await store.read();
    const target = required(state.requests, id);
    const folder = required(state.folders, target.folderId);
    const resolved = model ?? folder.modelId;
    if (!modelConfigured(resolved)) {
      response.json({
        skipped: true,
        reason:
          'No AI model configured. Add DEEPSEEK_API_KEY to .env and restart, or answer the request manually.',
      });
      return;
    }
    response.json(await answerRequest(store, id, resolved));
  });
  app.post('/api/folders/:id/requests/ingest', async (request, response) => {
    const pending = (await store.read()).requests.filter(
      (item) =>
        item.folderId === request.params.id &&
        (item.status === 'pending' || item.status === 'failed'),
    );
    const results = [];
    for (const item of pending) results.push(await ingestRequest(store, item.id));
    response.json(results.filter((result) => !('waiting' in result && result.waiting)));
  });
  app.delete('/api/requests/:id', async (request, response) => {
    await store.update((state) => {
      const item = required(state.requests, request.params.id);
      if (item.status === 'pending' || item.status === 'failed') item.status = 'superseded';
    });
    response.json({ ok: true });
  });
  app.post('/api/import-workspace', async (request, response) => {
    const { name } = z.object({ name: nameSchema }).parse(request.body);
    if (name.startsWith('.') || name.includes('/') || name.includes('\\') || reserved.has(name))
      throw new Error('Select a source folder directly inside this workspace.');
    const directory = await realpath(path.join(workspaceRoot, name));
    if (path.dirname(directory) !== workspaceRoot)
      throw new Error('Folder must be inside this workspace, not a symlink outside it.');
    const entries = await readdir(directory, { withFileTypes: true });
    const files = [];
    for (const entry of entries) {
      if (entry.isFile() && extensions.has(path.extname(entry.name).toLowerCase()))
        files.push({ name: entry.name, buffer: await readFile(path.join(directory, entry.name)) });
    }
    if (!files.length) throw new Error('This folder has no supported documents.');
    const existing = (await store.read()).folders.find((folder) => folder.name === name);
    if (existing)
      throw new Error(
        'This folder already exists. Upload additional sources into the existing folder.',
      );
    const folder = { id: randomUUID(), name, createdAt: new Date().toISOString() };
    await store.update((state) => state.folders.push(folder));
    try {
      const result = await importFiles(folder.id, files);
      response.status(201).json({ ...result, folder });
    } catch (error) {
      await store.update((state) => {
        state.folders = state.folders.filter((item) => item.id !== folder.id);
      });
      throw error;
    }
  });
  app.post('/api/folders/:id/upload', upload.array('files'), async (request, response) => {
    const files = request.files as Express.Multer.File[];
    if (!files?.length) throw new Error('Select at least one file.');
    response.status(201).json(
      await importFiles(
        z.string().parse(request.params.id),
        files.map((file) => ({
          name: Buffer.from(file.originalname, 'latin1').toString('utf8'),
          buffer: file.buffer,
        })),
      ),
    );
  });
  app.delete('/api/folders/:id', async (request, response) => {
    await store.update((state) => {
      required(state.folders, request.params.id);
      const sectionIds = new Set(
        state.sections
          .filter((section) => section.folderId === request.params.id)
          .map((section) => section.id),
      );
      state.folders = state.folders.filter((folder) => folder.id !== request.params.id);
      state.sources = state.sources.filter((source) => source.folderId !== request.params.id);
      state.sections = state.sections.filter((section) => !sectionIds.has(section.id));
      state.attempts = state.attempts.filter((attempt) => !sectionIds.has(attempt.sectionId));
      state.reviews = state.reviews.filter((review) => !sectionIds.has(review.sectionId));
      state.chapters = state.chapters.filter((chapter) => chapter.folderId !== request.params.id);
    });
    response.json({ ok: true });
  });
  app.get('/api/sources/:id/file', async (request, response) => {
    const source = required((await store.read()).sources, request.params.id);
    if (!source.file) throw new Error('This source has no file.');
    response.setHeader(
      'Content-Type',
      source.kind === 'pdf' ? 'application/pdf' : 'text/plain; charset=utf-8',
    );
    response.setHeader('X-Content-Type-Options', 'nosniff');
    const folder = required((await store.read()).folders, source.folderId);
    response.sendFile(store.sourcePath(folder, source.file), {
      dotfiles: 'allow',
    });
  });
  app.patch('/api/sections/:id', async (request, response) => {
    const { read } = z.object({ read: z.boolean() }).parse(request.body);
    await store.update((state) => {
      required(state.sections, request.params.id).read = read;
    });
    response.json({ ok: true });
  });
  app.post('/api/folders/:id/topic', (_request, response) => {
    response
      .status(400)
      .json({
        error: 'Topic-only exams are not supported yet. Add sources to an exam workspace instead.',
      });
  });
  app.post('/api/sections/:id/cards/:cardId/review', async (request, response) => {
    const { rating } = z.object({ rating: z.number().int().min(1).max(4) }).parse(request.body);
    const result = await store.update((state) => {
      const section = required(state.sections, request.params.id);
      const card = required(section.content?.cards ?? [], request.params.cardId);
      if (new Date(card.schedule.due) > new Date()) throw new Error('This card is not due yet.');
      card.schedule = reviewCard(card.schedule, rating);
      state.reviews.push({
        cardId: card.id,
        sectionId: section.id,
        date: new Date().toISOString(),
        rating,
      });
      replanExam(state, required(state.folders, section.folderId));
      return card;
    });
    response.json(result);
  });
  app.post('/api/sections/:id/quiz', async (request, response) => {
    const { answers } = z
      .object({ answers: z.array(z.number().int().min(0).max(3)).min(1).max(12) })
      .parse(request.body);
    const result = await store.update((state) => {
      const section = required(state.sections, request.params.id);
      const quiz = section.content?.quiz;
      if (!quiz || answers.length !== quiz.length)
        throw new Error('Answer every question before submitting.');
      const attempt = {
        id: randomUUID(),
        sectionId: section.id,
        date: new Date().toISOString(),
        answers,
        correct: quiz.filter((question, index) => question.correctIndex === answers[index]).length,
        total: quiz.length,
        quizRequestId: section.artifacts?.quiz?.requestId,
      };
      state.attempts.push(attempt);
      replanExam(state, required(state.folders, section.folderId));
      return attempt;
    });
    response.status(201).json(result);
  });
  app.put('/api/folders/:id/plan', async (request, response) => {
    const { examDate, dailyMinutes } = z
      .object({
        examDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        dailyMinutes: z.number().int().min(20).max(480),
      })
      .parse(request.body);
    const plan = await store.update((state) => {
      const folder = required(state.folders, request.params.id);
      if (!state.chapters.some((chapter) => chapter.folderId === folder.id))
        throw new Error('Import sources or add a topic before creating a plan.');
      folder.plan = createPlan(
        planItems(state, folder),
        examDate,
        dailyMinutes,
        new Date(),
        folder.learner,
        state,
      );
      replanExam(state, folder);
      return folder.plan;
    });
    response.json(plan);
  });
  app.use(express.static(path.join(workspaceRoot, 'dist')));
  app.get('/{*path}', (request, response, next) => {
    if (request.path.startsWith('/api/'))
      return response.status(404).json({ error: 'API route not found.' });
    response.sendFile(path.join(workspaceRoot, 'dist', 'index.html'), (error) => {
      if (error) next(error);
    });
  });
  app.use(
    (
      error: unknown,
      _request: express.Request,
      response: express.Response,
      _next: express.NextFunction,
    ) => {
      void _next;
      const status =
        error instanceof z.ZodError ? 400 : ((error as { status?: number }).status ?? 400);
      const message =
        error instanceof z.ZodError
          ? error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ')
          : error instanceof Error
            ? error.message
            : 'Something went wrong.';
      response.status(status).json({ error: message });
    },
  );
  return app;
}

export function folderProgress(state: StudyState, folderId: string) {
  const sections = state.sections.filter((section) => section.folderId === folderId);
  return { total: sections.length, read: sections.filter((section) => section.read).length };
}
