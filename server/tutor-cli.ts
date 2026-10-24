/**
 * Tutor-in-the-loop helper. Talks to the running API so only one process owns the data directory.
 *   pnpm tutor pending          list open requests with their prompt/response file paths
 *   pnpm tutor ingest           validate and apply every response file that exists
 *   pnpm tutor run [--limit N]  answer pending requests with an AiModel, then ingest each response
 *                  [--model id]  (defaults to FOLIO_AI_MODEL, then deepseek-chat)
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { GenerationRequest, StudyState } from '../shared/models';
import { AiModel } from './ai/model';
import { loadEnvironment } from './env';
import { workspaceDirectory } from './store';

loadEnvironment(path.join(process.cwd(), '.env'));
const base = process.env.FOLIO_API ?? `http://127.0.0.1:${process.env.PORT ?? 3001}/api`;
const dataRoot = path.resolve(process.cwd(), process.env.FOLIO_DATA_DIR ?? 'data');

async function call<T>(route: string, method = 'GET'): Promise<T> {
  const response = await fetch(`${base}${route}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: method === 'POST' ? '{}' : undefined,
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? response.statusText);
  return data as T;
}

async function fetchText(route: string): Promise<string> {
  const response = await fetch(`${base}${route}`);
  if (!response.ok) throw new Error((await response.text()) || response.statusText);
  return response.text();
}

function flag(name: string) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function targetLabel(state: StudyState, request: GenerationRequest) {
  return (
    state.chapters.find((item) => item.id === request.targetId)?.title ??
    state.sections.find((item) => item.id === request.targetId)?.title ??
    'whole source'
  );
}

const command = process.argv[2] ?? 'pending';
const state = await call<StudyState>('/state');
if (command === 'pending') {
  const open = state.requests.filter(
    (request) => request.status === 'pending' || request.status === 'failed',
  );
  if (!open.length) console.log('No open requests.');
  for (const request of open) {
    const folder = state.folders.find((item) => item.id === request.folderId)!;
    const target = targetLabel(state, request);
    const directory = path.join(
      dataRoot,
      folder.directory ?? workspaceDirectory(folder),
      'generation',
    );
    console.log(
      `${request.status.toUpperCase()} ${request.kind} v${request.promptVersion} · ${folder.name} · ${target}`,
    );
    console.log(`  prompt:   ${path.join(directory, `${request.id}.prompt.md`)}`);
    console.log(`  response: ${path.join(directory, `${request.id}.response.json`)}`);
    for (const problem of request.problems ?? []) console.log(`  problem:  ${problem}`);
  }
} else if (command === 'run') {
  let model: AiModel;
  try {
    model = AiModel.create(flag('model') ?? process.env.FOLIO_AI_MODEL);
  } catch (error) {
    console.error((error as Error).message);
    process.exit(1);
  }
  const limit = Number(flag('limit') ?? '1');
  const pending = state.requests.filter((request) => request.status === 'pending');
  if (!pending.length) console.log('No pending requests.');
  const batch = pending.slice(0, Number.isFinite(limit) && limit > 0 ? limit : 1);
  console.log(`Answering ${batch.length} request(s) with ${model.label}.`);
  let applied = 0;
  let rejected = 0;
  for (const request of batch) {
    const folder = state.folders.find((item) => item.id === request.folderId)!;
    const target = targetLabel(state, request);
    console.log(`\n→ ${request.kind} · ${target}`);
    let text: string;
    try {
      text = await model.complete({ prompt: await fetchText(`/requests/${request.id}/prompt`) });
    } catch (error) {
      rejected += 1;
      console.error(`  model error: ${(error as Error).message}`);
      continue;
    }
    const file = path.join(
      dataRoot,
      folder.directory ?? workspaceDirectory(folder),
      'generation',
      `${request.id}.response.json`,
    );
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, text, { mode: 0o600 });
    const result = await call<{ applied: boolean; problems: string[] }>(
      `/requests/${request.id}/ingest`,
      'POST',
    );
    if (result.applied) {
      applied += 1;
      console.log('  APPLIED');
    } else {
      rejected += 1;
      console.log(`  NOT APPLIED\n  - ${result.problems.join('\n  - ')}`);
    }
  }
  console.log(`\n${applied} applied, ${rejected} not applied · ${model.id}`);
} else if (command === 'ingest') {
  for (const folder of state.folders) {
    const results = await call<
      { request: GenerationRequest; problems: string[]; applied: boolean }[]
    >(`/folders/${folder.id}/requests/ingest`, 'POST');
    for (const result of results)
      console.log(
        `${result.applied ? 'APPLIED' : 'REJECTED'} ${result.request.kind} ${result.request.id}${result.problems.length ? `\n  - ${result.problems.join('\n  - ')}` : ''}`,
      );
  }
} else {
  console.error(`Unknown command: ${command}`);
  process.exitCode = 1;
}
