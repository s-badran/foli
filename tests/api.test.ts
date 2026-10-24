import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import type { Server } from 'node:http';
import { createApp } from '../server/app';
import { Store } from '../server/store';
import { AWS_SLIDES_HASH, buildCurriculum } from '../server/curriculum';
import { emptyState, type GeneratedContent, type Section, type StudyState } from '../shared/models';

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
  it('retires cloze generation and installs a tutor fixture for practice tests', async () => {
    const result = await json(`/api/sections/${section.id}/generate`, 'POST', {
      provider: 'offline',
    });
    expect(result.status).toBe(400);
    const fixture = emptyState();
    const folder = { id: 'fixture', name: 'AWS fixture', createdAt: '', mainSourceId: 'main' };
    fixture.folders.push(folder);
    fixture.sources.push({
      id: 'main',
      folderId: folder.id,
      name: 'fixture.pdf',
      kind: 'pdf',
      addedAt: '',
      contentHash: AWS_SLIDES_HASH,
    });
    fixture.sections.push({
      id: 'raw',
      folderId: folder.id,
      sourceId: 'main',
      title: 'Source fixture',
      text: 'Fixture source text',
      pageStart: 1,
      pageEnd: 879,
      read: false,
    });
    buildCurriculum(fixture, folder);
    content = fixture.sections.find((item) => !item.archived)!.content!;
    await new Store(directory).update((current) => {
      current.sections.find((item) => item.id === section.id)!.content = content;
    });
    expect(content.cards.length).toBeGreaterThan(1);
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
    expect(
      (await json(`/api/sections/${section.id}/generate`, 'POST', { provider: 'offline' })).status,
    ).toBe(200);
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
  it('upgrades old material with confirmation while preserving archived history', async () => {
    await new Store(directory).update((current) => {
      current.folders[0].materialsVersion = 1;
    });
    expect((await json(`/api/folders/${folderId}/refresh-materials`, 'POST', {})).status).toBe(400);
    expect(
      (await json(`/api/folders/${folderId}/refresh-materials`, 'POST', { confirm: true })).data
        .changed,
    ).toBe(true);
    const after = (await json('/api/state')).data as StudyState;
    expect(after.sections.find((item) => item.id === section.id)?.archived).toBe(true);
    expect(after.reviews).toHaveLength(1);
    expect(after.attempts).toHaveLength(1);
    expect(
      (await json(`/api/folders/${folderId}/refresh-materials`, 'POST', { confirm: true })).data
        .changed,
    ).toBe(false);
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
