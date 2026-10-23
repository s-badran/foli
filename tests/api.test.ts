import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import type { Server } from 'node:http';
import { createApp } from '../server/app';
import { Store } from '../server/store';
import type { GeneratedContent, Section, StudyState } from '../shared/models';

let server: Server;
let base: string;
let directory: string;
let folderId: string;
let section: Section;
let content: GeneratedContent;
const root = process.cwd();
async function json(route: string, method = 'GET', body?: unknown) {
  const response = await fetch(`${base}${route}`, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  return { status: response.status, data: await response.json() };
}
beforeAll(async () => {
  directory = await mkdtemp(path.join(root, '.cache-test-'));
  server = createApp(root, new Store(directory)).listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});
afterAll(async () => {
  await new Promise<void>(resolve => server.close(() => resolve()));
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
    form.append('files', new Blob(['# Networking\nAn availability zone contains separate data centers with redundant power.\nA virtual private cloud provides network isolation for your resources.\nIAM roles provide temporary credentials to AWS workloads.']), 'network.md');
    const response = await fetch(`${base}/api/folders/${folderId}/upload`, { method: 'POST', body: form });
    expect(response.status).toBe(201);
    const state = (await json('/api/state')).data as StudyState;
    section = state.sections[0];
    expect(section.title).toBe('Networking');
    expect((await new Store(directory).read()).sources).toHaveLength(1);
  });
  it('generates a usable offline study pack', async () => {
    const result = await json(`/api/sections/${section.id}/generate`, 'POST', { provider: 'offline' });
    expect(result.status).toBe(200);
    content = result.data;
    expect(content.cards.length).toBeGreaterThan(1);
  });
  it('records card reviews and prevents accidental double-review', async () => {
    const route = `/api/sections/${section.id}/cards/${content.cards[0].id}/review`;
    expect((await json(route, 'POST', { rating: 3 })).status).toBe(200);
    expect((await json(route, 'POST', { rating: 3 })).status).toBe(400);
  });
  it('scores a quiz on the server and protects study history', async () => {
    const answers = content.quiz.map(question => question.correctIndex);
    const attempt = await json(`/api/sections/${section.id}/quiz`, 'POST', { answers });
    expect(attempt.data.correct).toBe(content.quiz.length);
    expect((await json(`/api/sections/${section.id}/generate`, 'POST', { provider: 'offline' })).status).toBe(400);
  });
  it('creates a dated study plan and marks reading complete', async () => {
    const examDate = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
    expect((await json(`/api/folders/${folderId}/plan`, 'PUT', { examDate, dailyMinutes: 45 })).status).toBe(200);
    expect((await json(`/api/sections/${section.id}`, 'PATCH', { read: true })).status).toBe(200);
    const state = (await json('/api/state')).data as StudyState;
    expect(state.sections[0].read).toBe(true);
    expect(state.attempts).toHaveLength(1);
    expect(state.reviews).toHaveLength(1);
  });
  it('rejects workspace path traversal', async () => {
    expect((await json('/api/import-workspace', 'POST', { name: '../other-folder' })).status).toBe(400);
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