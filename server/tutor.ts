import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createEmptyCard } from 'ts-fsrs';
import { z } from 'zod';
import {
  artifactSchemas,
  checkFlashcards,
  checkQuiz,
  checkRanges,
  renderSummary,
  sameTopic,
  type ArtifactKind,
  type Flashcards,
  type Outline,
  type Quiz,
  type SectionPlan,
  type Summary,
} from '../shared/artifacts';
import { normalizeArtifact } from '../shared/normalize';
import type {
  ArtifactMeta,
  Folder,
  GeneratedContent,
  GenerationRequest,
  Section,
  StudyState,
} from '../shared/models';
import { refreshSupplementLinks } from './curriculum';
import type { Store } from './store';
import { replanExam, serializeCard } from './study';

export const promptDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'prompts',
);
const familiarityLabels = {
  new: "Haven't learned it yet",
  basic: 'I have a basic understanding',
  refresh: 'Know it well and just want to review',
};
const SUPPLEMENT_LIMIT = 60000;

export async function loadPrompt(id: string) {
  const raw = await readFile(path.join(promptDirectory, `${id}.md`), 'utf8');
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?/);
  const version = Number(match?.[1].match(/^version:\s*(\d+)/m)?.[1] ?? 0);
  if (!version) throw new Error(`Prompt ${id} has no version header.`);
  return { version, body: raw.slice(match?.[0].length ?? 0).trim() };
}

export function renderTemplate(template: string, variables: Record<string, string>) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    if (!(key in variables)) throw new Error(`Missing prompt variable: ${key}`);
    return variables[key];
  });
}

function required<Item extends { id: string }>(
  items: Item[],
  id: string | undefined,
  label: string,
) {
  const item = items.find((entry) => entry.id === id);
  if (!item) throw Object.assign(new Error(`${label} not found.`), { status: 404 });
  return item;
}

/** One cleaned text block per page; lines repeated on many pages (footers, watermarks) are dropped. */
export function sourcePages(
  state: StudyState,
  sourceId: string,
  start = 1,
  end = Number.MAX_SAFE_INTEGER,
) {
  const seen = new Set<number>();
  const pages = state.sections
    .filter(
      (section) => section.sourceId === sourceId && section.sourceFragment && section.pageStart,
    )
    .sort((left, right) => left.pageStart! - right.pageStart!)
    .filter((section) => !seen.has(section.pageStart!) && seen.add(section.pageStart!));
  const frequency = new Map<string, number>();
  for (const page of pages)
    for (const line of new Set(page.text.split('\n').map((value) => value.trim())))
      frequency.set(line, (frequency.get(line) ?? 0) + 1);
  const repeated = Math.max(3, Math.ceil(pages.length * 0.3));
  return pages
    .filter((page) => page.pageStart! >= start && page.pageStart! <= end)
    .map((page) => ({
      page: page.pageStart!,
      text: page.text
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line && (frequency.get(line) ?? 0) < repeated)
        .join('\n'),
    }));
}

const formatPages = (pages: { page: number; text: string }[]) =>
  pages.map((page) => `[Page ${page.page}]\n${page.text}`).join('\n\n');

function supplementaryText(state: StudyState, folder: Folder) {
  const blocks = state.sources
    .filter(
      (source) =>
        source.folderId === folder.id &&
        source.id !== folder.mainSourceId &&
        source.relevance?.status === 'accepted',
    )
    .map((source) => `### ${source.name}\n${formatPages(sourcePages(state, source.id))}`);
  const text = blocks.join('\n\n');
  return text.length > SUPPLEMENT_LIMIT
    ? `${text.slice(0, SUPPLEMENT_LIMIT)}\n[truncated]`
    : text || '(none)';
}

function sectionVariables(state: StudyState, section: Section) {
  return {
    sectionTitle: section.title,
    pageStart: String(section.pageStart ?? 1),
    pageEnd: String(section.pageEnd ?? section.pageStart ?? 1),
    keyTopics: (section.keyTopics ?? [section.title]).join('; '),
    objective: section.objective ?? '(not stated)',
    summary: section.summaryData ? renderSummary(section.summaryData) : '(not generated yet)',
    sectionPages:
      formatPages(
        sourcePages(
          state,
          section.sourceId,
          section.pageStart,
          section.pageEnd ?? section.pageStart,
        ),
      ) || section.text,
  };
}

export async function renderRequest(
  state: StudyState,
  folder: Folder,
  kind: ArtifactKind,
  targetId?: string,
) {
  const system = await loadPrompt('system');
  const task = await loadPrompt(kind);
  const learner = folder.learner ?? {
    familiarity: 'new' as const,
    role: 'professional' as const,
    goal: '',
  };
  const common = {
    examName: folder.name,
    familiarity: familiarityLabels[learner.familiarity],
    role: learner.role,
    goal: learner.goal || '(not stated)',
    brief: folder.prompt?.trim() || '(none)',
    supplementary: supplementaryText(state, folder),
  };
  let variables: Record<string, string> = { ...common };
  let target = 'whole main source';
  if (kind === 'outline') {
    if (!folder.mainSourceId) throw new Error('Choose a main source first.');
    variables.sourcePages = formatPages(sourcePages(state, folder.mainSourceId));
  } else if (kind === 'sections') {
    const chapter = required(state.chapters, targetId, 'Chapter');
    target = `chapter ${chapter.order}: ${chapter.title}`;
    variables = {
      ...variables,
      chapterTitle: chapter.title,
      pageStart: String(chapter.pageStart ?? 1),
      pageEnd: String(chapter.pageEnd ?? chapter.pageStart ?? 1),
      examFocus: chapter.examFocus?.length
        ? chapter.examFocus.map((item) => `- ${item}`).join('\n')
        : '(none)',
      chapterPages: formatPages(
        sourcePages(state, chapter.sourceId, chapter.pageStart, chapter.pageEnd),
      ),
    };
  } else {
    const section = required(state.sections, targetId, 'Section');
    target = `section: ${section.title}`;
    variables = {
      ...variables,
      familiarity: learner.familiarity,
      ...sectionVariables(state, section),
    };
  }
  const schema = JSON.stringify(z.toJSONSchema(artifactSchemas[kind], { io: 'input' }), null, 2);
  const text = [
    `# Generation request: ${kind} (${target})`,
    `Prompt versions: system v${system.version}, ${kind} v${task.version}.`,
    '## System prompt',
    renderTemplate(system.body, common),
    '## Task prompt',
    renderTemplate(task.body, variables),
    '## Required JSON schema',
    '```json',
    schema,
    '```',
  ].join('\n\n');
  return { text, promptVersion: task.version };
}

export async function queueRequest(
  store: Store,
  folderId: string,
  kind: ArtifactKind,
  targetId?: string,
) {
  const state = await store.read();
  const folder = required(state.folders, folderId, 'Exam');
  const existing = state.requests.find(
    (request) =>
      request.folderId === folderId &&
      request.kind === kind &&
      request.targetId === targetId &&
      request.status === 'pending',
  );
  if (existing) return existing;
  if (kind !== 'outline' && kind !== 'sections') {
    const section = required(state.sections, targetId, 'Section');
    if (section.folderId !== folderId || section.archived)
      throw new Error('Section is not active in this exam.');
  }
  const { text, promptVersion } = await renderRequest(state, folder, kind, targetId);
  const request: GenerationRequest = {
    id: randomUUID(),
    folderId,
    kind,
    targetId,
    status: 'pending',
    promptVersion,
    createdAt: new Date().toISOString(),
  };
  await store.update((current) => {
    required(current.folders, folderId, 'Exam');
    current.requests.push(request);
  });
  const saved = required((await store.read()).folders, folderId, 'Exam');
  await mkdir(path.dirname(store.generationPath(saved, `${request.id}.prompt.md`)), {
    recursive: true,
  });
  await writeFile(store.generationPath(saved, `${request.id}.prompt.md`), text, { mode: 0o600 });
  return request;
}

export function parseResponse(raw: string) {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '');
  try {
    return JSON.parse(cleaned) as unknown;
  } catch {
    throw new Error('Response is not valid JSON.');
  }
}

function meta(request: GenerationRequest): ArtifactMeta {
  return {
    requestId: request.id,
    promptVersion: request.promptVersion,
    generatedAt: new Date().toISOString(),
  };
}

function ensureContent(section: Section, label: string): GeneratedContent {
  section.content ??= {
    summary: '',
    keyPoints: [],
    supplement: '',
    cards: [],
    quiz: [],
    provider: 'copilot',
    model: label,
    authorship: 'model',
    generatedAt: new Date().toISOString(),
    evidence: [],
  };
  section.content.model = label;
  section.content.evidence = [
    {
      sourceId: section.sourceId,
      pageStart: section.pageStart,
      pageEnd: section.pageEnd,
      note: 'Main-source pages given to the tutor for this section.',
    },
    ...(section.content.evidence ?? []).filter((item) => item.sourceId !== section.sourceId),
  ];
  return section.content;
}

const slug = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
const matchTopic = (topics: string[], value: string) =>
  topics.find((topic) => sameTopic(topic, value)) ?? value;
const objectiveId = (section: Section, topic: string) => `${section.id}::${slug(topic)}`;
const modelLabel = (request: GenerationRequest) =>
  `Tutor model · ${request.kind} prompt v${request.promptVersion}`;

/** Validates a response and applies it to state; returns problems instead of applying when invalid. */
export function applyResponse(
  state: StudyState,
  request: GenerationRequest,
  data: unknown,
): string[] {
  data = normalizeArtifact(request.kind, data);
  const parsed = artifactSchemas[request.kind].safeParse(data);
  if (!parsed.success)
    return parsed.error.issues
      .slice(0, 20)
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`);
  const folder = required(state.folders, request.folderId, 'Exam');
  if (request.kind === 'outline') {
    const outline = parsed.data as Outline;
    const main = required(state.sources, folder.mainSourceId, 'Main source');
    const lastPage =
      main.pages ?? Math.max(...sourcePages(state, main.id).map((page) => page.page));
    const problems = checkRanges(outline.chapters, 1, lastPage);
    if (problems.length) return problems;
    for (const section of state.sections.filter((item) => item.folderId === folder.id))
      section.archived = true;
    for (const pending of state.requests)
      if (
        pending.folderId === folder.id &&
        pending.id !== request.id &&
        pending.status === 'pending'
      )
        pending.status = 'superseded';
    state.chapters = state.chapters.filter((chapter) => chapter.folderId !== folder.id);
    outline.chapters.forEach((chapter, index) =>
      state.chapters.push({
        id: randomUUID(),
        folderId: folder.id,
        sourceId: main.id,
        order: index + 1,
        title: chapter.title,
        pageStart: chapter.pageStart,
        pageEnd: chapter.pageEnd,
        description: chapter.description,
        examFocus: chapter.examFocus,
        objectives: [],
        coverageStatus: 'draft',
      }),
    );
    folder.outline = meta(request);
    folder.curriculumRevision = (folder.curriculumRevision ?? 0) + 1;
    folder.curriculumNote = outline.notes || undefined;
  } else if (request.kind === 'sections') {
    const plan = parsed.data as SectionPlan;
    const chapter = required(state.chapters, request.targetId, 'Chapter');
    const problems = checkRanges(
      plan.sections,
      chapter.pageStart ?? 1,
      chapter.pageEnd ?? chapter.pageStart ?? 1,
    );
    if (problems.length) return problems;
    const replaced = new Set(
      state.sections
        .filter((item) => item.chapterId === chapter.id)
        .map((item) => item.id),
    );
    for (const section of state.sections.filter((item) => item.chapterId === chapter.id))
      section.archived = true;
    for (const pending of state.requests)
      if (
        pending.folderId === folder.id &&
        pending.status === 'pending' &&
        pending.targetId &&
        replaced.has(pending.targetId)
      )
        pending.status = 'superseded';
    chapter.objectives = [];
    for (const item of plan.sections) {
      const section: Section = {
        id: randomUUID(),
        folderId: folder.id,
        sourceId: chapter.sourceId,
        chapterId: chapter.id,
        title: item.title,
        objective: item.objective,
        keyTopics: item.keyTopics,
        pageStart: item.pageStart,
        pageEnd: item.pageEnd,
        text: formatPages(sourcePages(state, chapter.sourceId, item.pageStart, item.pageEnd)),
        read: false,
      };
      state.sections.push(section);
      chapter.objectives.push(
        ...item.keyTopics.map((topic) => ({
          id: objectiveId(section, topic),
          title: topic,
          sourceId: chapter.sourceId,
          pageStart: item.pageStart,
          pageEnd: item.pageEnd,
          assessment: 'recall' as const,
        })),
      );
    }
    chapter.coverageStatus = 'source-audited';
  } else {
    const section = required(state.sections, request.targetId, 'Section');
    if (section.archived)
      return ['Section was replaced after this request; regenerate for the current section.'];
    const topics = section.keyTopics ?? [section.title];
    if (request.kind === 'summary') {
      const summary = parsed.data as Summary;
      const content = ensureContent(section, modelLabel(request));
      section.summaryData = summary;
      content.summary = renderSummary(summary, { mustRemember: false });
      content.keyPoints = summary.mustRemember;
      content.supplement = summary.beyondSource.map((item) => `- ${item}`).join('\n');
    } else if (request.kind === 'flashcards') {
      const cards = parsed.data as Flashcards;
      const problems = checkFlashcards(cards, topics);
      if (problems.length) return problems;
      ensureContent(section, modelLabel(request)).cards = cards.groups.flatMap((group) =>
        group.cards.map((card) => {
          const topic = matchTopic(topics, card.keyTopic);
          return {
            id: randomUUID(),
            question: card.question,
            answer: Array.isArray(card.answer) ? card.answer.join('\n') : card.answer,
            group: group.concept,
            keyTopic: topic,
            origin: card.origin,
            objectiveIds: [objectiveId(section, topic)],
            schedule: serializeCard(createEmptyCard()),
          };
        }),
      );
    } else {
      const quiz = parsed.data as Quiz;
      const problems = checkQuiz(quiz, topics);
      if (problems.length) return problems;
      ensureContent(section, modelLabel(request)).quiz = quiz.questions.map((question) => {
        const topic = matchTopic(topics, question.keyTopic);
        return { ...question, keyTopic: topic, objectiveIds: [objectiveId(section, topic)] };
      });
    }
    section.artifacts = { ...section.artifacts, [request.kind]: meta(request) };
  }
  refreshSupplementLinks(state, folder);
  replanExam(state, folder);
  return [];
}

export async function ingestRequest(store: Store, requestId: string) {
  const state = await store.read();
  const request = required(state.requests, requestId, 'Request');
  if (request.status === 'done' || request.status === 'superseded')
    return { request, problems: [] as string[], applied: false };
  const folder = required(state.folders, request.folderId, 'Exam');
  let raw: string;
  try {
    raw = await readFile(store.generationPath(folder, `${request.id}.response.json`), 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT')
      return { request, problems: [] as string[], applied: false, waiting: true };
    throw error;
  }
  let data: unknown;
  let problems: string[];
  try {
    data = parseResponse(raw);
    problems = [];
  } catch (error) {
    problems = [(error as Error).message];
  }
  const updated = await store.update((current) => {
    const target = required(current.requests, requestId, 'Request');
    if (!problems.length) problems = applyResponse(current, target, data);
    target.status = problems.length ? 'failed' : 'done';
    target.problems = problems.length ? problems : undefined;
    target.completedAt = new Date().toISOString();
    if (!problems.length)
      for (const other of current.requests)
        if (
          other.id !== target.id &&
          other.folderId === target.folderId &&
          other.kind === target.kind &&
          other.targetId === target.targetId &&
          other.status === 'pending'
        )
          other.status = 'superseded';
    return { ...target };
  });
  return { request: updated, problems, applied: !problems.length };
}
