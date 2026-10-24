import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Server } from 'node:http';
import { createApp } from '../server/app';
import { Store } from '../server/store';
import { type GeneratedContent, type Section, type StudyState } from '../shared/models';

let server: Server;
let base: string;
let directory: string;
let folderId: string;
let section: Section;
let content: GeneratedContent;
const root = process.cwd();
async function json(route: string, method = 'GET', body?: unknown) {
  const response = await fetch(`${base}${route}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: response.status, data: await response.json() };
}
beforeAll(async () => {
  directory = await mkdtemp(path.join(root, '.cache-test-'));
  server = createApp(root, new Store(directory)).listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});
afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await rm(directory, { recursive: true, force: true });
});
describe.sequential('complete local study workflow', () => {
  it('creates a folder', async () => {
    const result = await json('/api/folders', 'POST', { name: 'Network studies' });
    expect(result.status).toBe(201);
    folderId = result.data.id;
  });
  it('uploads notes and persists sections', async () => {
    const form = new FormData();
    form.append(
      'files',
      new Blob([
        '# Networking\nAn availability zone contains separate data centers with redundant power.\nA virtual private cloud provides network isolation for your resources.\nIAM roles provide temporary credentials to AWS workloads.',
      ]),
      'network.md',
    );
    const response = await fetch(`${base}/api/folders/${folderId}/upload`, {
      method: 'POST',
      body: form,
    });
    expect(response.status).toBe(201);
    const state = (await json('/api/state')).data as StudyState;
    section = state.sections.find((item) => !item.archived)!;
    expect(section.title).toBe('Networking');
    expect((await new Store(directory).read()).sources).toHaveLength(1);
  });
  it('queues an outline on upload and applies validated per-artifact responses', async () => {
    let state = (await json('/api/state')).data as StudyState;
    expect(
      state.requests.some((item) => item.kind === 'outline' && item.status === 'pending'),
    ).toBe(true);
    const answer = async (kind: string, payload: unknown) => {
      const queued = await json(`/api/folders/${folderId}/requests`, 'POST', {
        kind,
        targetId: section.id,
      });
      expect(queued.status).toBe(201);
      const prompt = await fetch(`${base}/api/requests/${queued.data.id}/prompt`);
      expect(await prompt.text()).toContain('Required JSON schema');
      const folder = (await new Store(directory).read()).folders[0];
      await writeFile(
        new Store(directory).generationPath(folder, `${queued.data.id}.response.json`),
        JSON.stringify(payload),
      );
      return json(`/api/requests/${queued.data.id}/ingest`, 'POST', {});
    };
    const rejected = await answer('flashcards', {
      groups: [
        {
          concept: 'Networking',
          cards: [
            {
              question: 'Explain everything about networking?',
              answer: 'x',
              keyTopic: 'Networking',
            },
          ],
        },
      ],
    });
    expect(rejected.data.applied).toBe(false);
    expect(rejected.data.problems.join(' ')).toContain('Too few cards');
    const cards = [
      {
        question: 'What isolates network resources?',
        answer: 'A virtual private cloud',
        keyTopic: 'Networking',
      },
      {
        question: 'What does an availability zone contain?',
        answer: 'Separate data centers',
        keyTopic: 'Networking',
      },
      {
        question: 'What power design do zones use?',
        answer: 'Redundant power',
        keyTopic: 'Networking',
      },
      {
        question: 'What gives workloads temporary credentials?',
        answer: 'Roles',
        keyTopic: 'Networking',
      },
    ];
    expect(
      (await answer('flashcards', { groups: [{ concept: 'Networking', cards }] })).data.applied,
    ).toBe(true);
    const question = (text: string, correctIndex: number, kind: string) => ({
      question: text,
      options: ['Private cloud network', 'Data center zone', 'Temporary role', 'Public bucket'],
      correctIndex,
      explanation:
        'The scenario requirement matches exactly one option; the others solve a different need.',
      keyTopic: 'Networking',
      kind,
    });
    const quiz = {
      questions: [
        question('A team needs isolated networking for its resources. What fits?', 0, 'scenario'),
        question(
          'A design must survive a facility power failure. What isolates the failure?',
          1,
          'scenario',
        ),
        question('Which item issues temporary credentials?', 2, 'concept'),
      ],
    };
    expect((await answer('quiz', quiz)).data.applied).toBe(true);
    state = (await json('/api/state')).data as StudyState;
    content = state.sections.find((item) => item.id === section.id)!.content!;
    expect(content.cards).toHaveLength(4);
    expect(content.quiz).toHaveLength(3);
  });
  it('serves original files even when the configured data directory is hidden', async () => {
    const state = (await json('/api/state')).data as StudyState;
    const response = await fetch(`${base}/api/sources/${state.sources[0].id}/file`);
    expect(response.status).toBe(200);
    expect(await response.text()).toContain('# Networking');
  });
  it('records card reviews and prevents accidental double-review', async () => {
    const route = `/api/sections/${section.id}/cards/${content.cards[0].id}/review`;
    expect((await json(route, 'POST', { rating: 3 })).status).toBe(200);
    expect((await json(route, 'POST', { rating: 3 })).status).toBe(400);
  });
  it('scores a quiz on the server and protects study history', async () => {
    const answers = content.quiz.map((question) => question.correctIndex);
    const attempt = await json(`/api/sections/${section.id}/quiz`, 'POST', { answers });
    expect(attempt.data.correct).toBe(content.quiz.length);
    expect(attempt.data.quizRequestId).toBeTruthy();
  });
  it('creates a dated study plan and marks reading complete', async () => {
    const examDate = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
    expect(
      (await json(`/api/folders/${folderId}/plan`, 'PUT', { examDate, dailyMinutes: 45 })).status,
    ).toBe(200);
    expect((await json(`/api/sections/${section.id}`, 'PATCH', { read: true })).status).toBe(200);
    const state = (await json('/api/state')).data as StudyState;
    expect(state.sections.find((item) => item.id === section.id)!.read).toBe(true);
    expect(state.attempts).toHaveLength(1);
    expect(state.reviews).toHaveLength(1);
  });
  it('replans automatically on baseline change without regenerating assessments; role is context only', async () => {
    const before = (await json('/api/state')).data as StudyState;
    const beforeContent = JSON.stringify(
      before.sections.find((item) => item.id === section.id)!.content,
    );
    const result = await json(`/api/folders/${folderId}`, 'PATCH', {
      learner: { familiarity: 'basic', role: 'student', goal: 'Understand the source' },
    });
    expect(result.status).toBe(200);
    expect(result.data.plan.familiarity).toBe('basic');
    expect(
      result.data.plan.days.some((day: { studyMinutes: number }) => day.studyMinutes === 15),
    ).toBe(true);
    const after = (await json('/api/state')).data as StudyState;
    expect(JSON.stringify(after.sections.find((item) => item.id === section.id)!.content)).toBe(
      beforeContent,
    );
    const roleChange = await json(`/api/folders/${folderId}`, 'PATCH', {
      learner: { familiarity: 'basic', role: 'professional', goal: 'Understand the source' },
    });
    expect(roleChange.data.plan).toEqual(result.data.plan);
  });
  it('rejects workspace path traversal', async () => {
    expect((await json('/api/import-workspace', 'POST', { name: '../other-folder' })).status).toBe(
      400,
    );
  });
  it('does not corrupt existing data on invalid input', async () => {
    expect((await json('/api/folders', 'POST', { name: '' })).status).toBe(400);
    expect((await json('/api/state')).data.folders).toHaveLength(1);
  });
  it('deletes a folder and its progress', async () => {
    expect((await json(`/api/folders/${folderId}`, 'DELETE')).status).toBe(200);
    const state = (await json('/api/state')).data as StudyState;
    expect(state.sections).toHaveLength(0);
    expect(state.attempts).toHaveLength(0);
  });
});

describe('supported models', () => {
  it('lists models without exposing credentials', async () => {
    const result = await json('/api/models');
    expect(result.status).toBe(200);
    const body = result.data as {
      default: string;
      models: { id: string; configured: boolean; default: boolean }[];
    };
    expect(body.default).toBe('deepseek-chat');
    expect(body.models.map((item) => item.id)).toContain('deepseek-chat');
    expect(body.models.map((item) => item.id)).not.toContain('mock');
    expect(body.models.find((item) => item.default)?.id).toBe('deepseek-chat');
    expect(JSON.stringify(body)).not.toMatch(/sk-[a-z0-9]/i);
  });
});

describe.sequential('auto-run route', () => {
  let runFolderId: string;
  beforeAll(() => {
    delete process.env.DEEPSEEK_API_KEY;
  });

  it('creates a workspace with a markdown source', async () => {
    const created = await json('/api/folders', 'POST', { name: 'Run route tests' });
    expect(created.status).toBe(201);
    runFolderId = created.data.id;
    const form = new FormData();
    form.append(
      'files',
      new Blob(['# Network\n## Availability Zone\nAZs are isolated locations.'], {
        type: 'text/markdown',
      }),
      'run.md',
    );
    const upload = await fetch(`${base}/api/folders/${runFolderId}/upload`, {
      method: 'POST',
      body: form,
    });
    expect(upload.status).toBe(201);
  });

  it('skips inline generation when no model is configured', async () => {
    const state = (await json('/api/state')).data as StudyState;
    const outline = state.requests.find(
      (item) => item.folderId === runFolderId && item.kind === 'outline' && item.status === 'pending',
    );
    expect(outline).toBeTruthy();
    const run = await json(`/api/requests/${outline!.id}/run`, 'POST', {});
    expect(run.status).toBe(200);
    expect(run.data.skipped).toBe(true);
  });

  it('answers with the mock model and rejects the invalid response', async () => {
    const state = (await json('/api/state')).data as StudyState;
    const outline = state.requests.find(
      (item) => item.folderId === runFolderId && item.kind === 'outline',
    );
    const run = await json(`/api/requests/${outline!.id}/run`, 'POST', { model: 'mock' });
    expect(run.status).toBe(200);
    expect(run.data.applied).toBe(false);
    expect((run.data.problems as string[]).length).toBeGreaterThan(0);
  });
});

describe('model selection', () => {
  it('saves a supported model and rejects an unsupported one', async () => {
    const created = await json('/api/folders', 'POST', { name: 'Model tests' });
    expect(created.status).toBe(201);
    const id = created.data.id as string;
    const saved = await json(`/api/folders/${id}`, 'PATCH', { modelId: 'deepseek-chat' });
    expect(saved.status).toBe(200);
    expect(saved.data.modelId).toBe('deepseek-chat');
    const cleared = await json(`/api/folders/${id}`, 'PATCH', { modelId: '' });
    expect(cleared.data.modelId).toBeUndefined();
    const bad = await json(`/api/folders/${id}`, 'PATCH', { modelId: 'not-a-model' });
    expect(bad.status).toBe(400);
    await json(`/api/folders/${id}`, 'DELETE');
  });
});
