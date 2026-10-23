import express from 'express';
import multer from 'multer';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, readdir, realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { providerSchema, type Section, type Source, type StudyState } from '../shared/models';
import { Store } from './store';
import { extractDocument } from './documents';
import { generateContent } from './generation';
import { createPlan, reviewCard } from './study';

const extensions = new Set(['.pdf', '.md', '.txt']);
const reserved = new Set(['node_modules', 'data', 'dist', 'src', 'server', 'shared', 'tests', 'docs', 'test-results', 'playwright-report']);
const nameSchema = z.string().trim().min(1).max(120);

function required<Item extends { id: string }>(items: Item[], id: string): Item {
  const item = items.find(entry => entry.id === id);
  if (!item) throw Object.assign(new Error('Item not found.'), { status: 404 });
  return item;
}

export function createApp(workspaceRoot: string, store = new Store(path.join(workspaceRoot, 'data'))) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 60 * 1024 * 1024, files: 12 }, fileFilter: (_request, file, callback) => {
    if (!extensions.has(path.extname(file.originalname).toLowerCase())) return callback(new Error('Only PDF, Markdown and TXT files are supported.'));
    callback(null, true);
  } });
  const generationLocks = new Set<string>();

  async function importFiles(folderId: string, files: { name: string; buffer: Buffer }[]) {
    required((await store.read()).folders, folderId);
    const sources: Source[] = [];
    const sections: Section[] = [];
    for (const file of files) {
      const id = randomUUID();
      const extension = path.extname(file.name).toLowerCase();
      const extracted = await extractDocument(file.buffer, file.name);
      await mkdir(path.join(store.directory, 'uploads'), { recursive: true });
      await writeFile(path.join(store.directory, 'uploads', `${id}${extension}`), file.buffer, { mode: 0o600 });
      sources.push({ id, folderId, name: file.name, kind: extension.slice(1) as Source['kind'], pages: extracted.at(-1)?.pageEnd, addedAt: new Date().toISOString(), file: `${id}${extension}` });
      sections.push(...extracted.map(section => ({ ...section, id: randomUUID(), sourceId: id, folderId, read: false })));
    }
    await store.update(state => { required(state.folders, folderId); state.sources.push(...sources); state.sections.push(...sections); });
    return { sourceCount: sources.length, sectionCount: sections.length };
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
      const files = (await readdir(path.join(workspaceRoot, entry.name), { withFileTypes: true })).filter(file => file.isFile() && extensions.has(path.extname(file.name).toLowerCase())).map(file => file.name);
      if (files.length) folders.push({ name: entry.name, files });
    }
    response.json(folders);
  });
  app.post('/api/folders', async (request, response) => {
    const { name } = z.object({ name: nameSchema }).parse(request.body);
    const folder = { id: randomUUID(), name, createdAt: new Date().toISOString() };
    await store.update(state => state.folders.push(folder));
    response.status(201).json(folder);
  });
  app.post('/api/import-workspace', async (request, response) => {
    const { name } = z.object({ name: nameSchema }).parse(request.body);
    if (name.startsWith('.') || name.includes('/') || name.includes('\\') || reserved.has(name)) throw new Error('Select a source folder directly inside this workspace.');
    const directory = await realpath(path.join(workspaceRoot, name));
    if (path.dirname(directory) !== workspaceRoot) throw new Error('Folder must be inside this workspace, not a symlink outside it.');
    const entries = await readdir(directory, { withFileTypes: true });
    const files = [];
    for (const entry of entries) {
      if (entry.isFile() && extensions.has(path.extname(entry.name).toLowerCase())) files.push({ name: entry.name, buffer: await readFile(path.join(directory, entry.name)) });
    }
    if (!files.length) throw new Error('This folder has no supported documents.');
    const existing = (await store.read()).folders.find(folder => folder.name === name);
    if (existing) throw new Error('This folder already exists. Upload additional sources into the existing folder.');
    const folder = { id: randomUUID(), name, createdAt: new Date().toISOString() };
    await store.update(state => state.folders.push(folder));
    try {
      const result = await importFiles(folder.id, files);
      response.status(201).json({ ...result, folder });
    } catch (error) {
      await store.update(state => { state.folders = state.folders.filter(item => item.id !== folder.id); });
      throw error;
    }
  });
  app.post('/api/folders/:id/upload', upload.array('files'), async (request, response) => {
    const files = request.files as Express.Multer.File[];
    if (!files?.length) throw new Error('Select at least one file.');
    response.status(201).json(await importFiles(z.string().parse(request.params.id), files.map(file => ({ name: Buffer.from(file.originalname, 'latin1').toString('utf8'), buffer: file.buffer }))));
  });
  app.delete('/api/folders/:id', async (request, response) => {
    await store.update(state => {
      required(state.folders, request.params.id);
      const sectionIds = new Set(state.sections.filter(section => section.folderId === request.params.id).map(section => section.id));
      state.folders = state.folders.filter(folder => folder.id !== request.params.id);
      state.sources = state.sources.filter(source => source.folderId !== request.params.id);
      state.sections = state.sections.filter(section => !sectionIds.has(section.id));
      state.attempts = state.attempts.filter(attempt => !sectionIds.has(attempt.sectionId));
      state.reviews = state.reviews.filter(review => !sectionIds.has(review.sectionId));
    });
    response.json({ ok: true });
  });
  app.get('/api/sources/:id/file', async (request, response) => {
    const source = required((await store.read()).sources, request.params.id);
    if (!source.file) throw new Error('This source has no file.');
    response.setHeader('Content-Type', source.kind === 'pdf' ? 'application/pdf' : 'text/plain; charset=utf-8');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.sendFile(path.join(store.directory, 'uploads', path.basename(source.file)));
  });
  app.patch('/api/sections/:id', async (request, response) => {
    const { read } = z.object({ read: z.boolean() }).parse(request.body);
    await store.update(state => { required(state.sections, request.params.id).read = read; });
    response.json({ ok: true });
  });
  app.post('/api/sections/:id/generate', async (request, response) => {
    const config = providerSchema.parse(request.body);
    const section = required((await store.read()).sections, request.params.id);
    if (generationLocks.has(section.id)) throw new Error('This section is already generating.');
    if (section.content && ((await store.read()).reviews.some(review => review.sectionId === section.id) || (await store.read()).attempts.some(attempt => attempt.sectionId === section.id))) throw new Error('This section has study history. Generation is locked to preserve your progress.');
    generationLocks.add(section.id);
    try {
      const source = required((await store.read()).sources, section.sourceId);
      const content = await generateContent(section.text, section.title, config, request.get('x-ai-key'), workspaceRoot, source.kind === 'topic');
      await store.update(state => { required(state.sections, section.id).content = content; });
      response.json(content);
    } finally { generationLocks.delete(section.id); }
  });
  app.post('/api/folders/:id/topic', async (request, response) => {
    const { topic, ...config } = providerSchema.extend({ topic: nameSchema }).parse(request.body);
    required((await store.read()).folders, request.params.id);
    const content = await generateContent('', topic, config, request.get('x-ai-key'), workspaceRoot, true);
    const source: Source = { id: randomUUID(), folderId: request.params.id, name: topic, kind: 'topic', addedAt: new Date().toISOString() };
    const section: Section = { id: randomUUID(), folderId: request.params.id, sourceId: source.id, title: topic, text: 'Model knowledge. No uploaded source supports this section. Verify important facts against current official documentation.', read: false, content };
    await store.update(state => { required(state.folders, request.params.id); state.sources.push(source); state.sections.push(section); });
    response.status(201).json(section);
  });
  app.post('/api/sections/:id/cards/:cardId/review', async (request, response) => {
    const { rating } = z.object({ rating: z.number().int().min(1).max(4) }).parse(request.body);
    const result = await store.update(state => {
      const section = required(state.sections, request.params.id);
      const card = required(section.content?.cards ?? [], request.params.cardId);
      if (new Date(card.schedule.due) > new Date()) throw new Error('This card is not due yet.');
      card.schedule = reviewCard(card.schedule, rating);
      state.reviews.push({ cardId: card.id, sectionId: section.id, date: new Date().toISOString(), rating });
      return card;
    });
    response.json(result);
  });
  app.post('/api/sections/:id/quiz', async (request, response) => {
    const { answers } = z.object({ answers: z.array(z.number().int().min(0).max(3)).min(2).max(12) }).parse(request.body);
    const result = await store.update(state => {
      const section = required(state.sections, request.params.id);
      const quiz = section.content?.quiz;
      if (!quiz || answers.length !== quiz.length) throw new Error('Answer every question before submitting.');
      const attempt = { id: randomUUID(), sectionId: section.id, date: new Date().toISOString(), answers, correct: quiz.filter((question, index) => question.correctIndex === answers[index]).length, total: quiz.length };
      state.attempts.push(attempt);
      return attempt;
    });
    response.status(201).json(result);
  });
  app.put('/api/folders/:id/plan', async (request, response) => {
    const { examDate, dailyMinutes } = z.object({ examDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), dailyMinutes: z.number().int().min(20).max(480) }).parse(request.body);
    const plan = await store.update(state => {
      const folder = required(state.folders, request.params.id);
      const sections = state.sections.filter(section => section.folderId === folder.id);
      if (!sections.length) throw new Error('Import sources or add a topic before creating a plan.');
      folder.plan = createPlan(sections, examDate, dailyMinutes);
      return folder.plan;
    });
    response.json(plan);
  });
  app.use(express.static(path.join(workspaceRoot, 'dist')));
  app.get('/{*path}', (request, response, next) => {
    if (request.path.startsWith('/api/')) return response.status(404).json({ error: 'API route not found.' });
    response.sendFile(path.join(workspaceRoot, 'dist', 'index.html'), error => { if (error) next(error); });
  });
  app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
    void _next;
    const status = error instanceof z.ZodError ? 400 : (error as { status?: number }).status ?? 400;
    const message = error instanceof z.ZodError ? error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join('; ') : error instanceof Error ? error.message : 'Something went wrong.';
    response.status(status).json({ error: message });
  });
  return app;
}

export function folderProgress(state: StudyState, folderId: string) {
  const sections = state.sections.filter(section => section.folderId === folderId);
  return { total: sections.length, read: sections.filter(section => section.read).length };
}