/**
 * Tutor-in-the-loop helper. Talks to the running API so only one process owns the data directory.
 *   pnpm tutor pending          list open requests with their prompt/response file paths
 *   pnpm tutor ingest           validate and apply every response file that exists
 */
import path from 'node:path';
import type { GenerationRequest, StudyState } from '../shared/models';

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

const command = process.argv[2] ?? 'pending';
const state = await call<StudyState>('/state');
if (command === 'pending') {
  const open = state.requests.filter(
    (request) => request.status === 'pending' || request.status === 'failed',
  );
  if (!open.length) console.log('No open requests.');
  for (const request of open) {
    const folder = state.folders.find((item) => item.id === request.folderId)!;
    const target =
      state.chapters.find((item) => item.id === request.targetId)?.title ??
      state.sections.find((item) => item.id === request.targetId)?.title ??
      'whole source';
    const directory = path.join(dataRoot, folder.directory ?? '', 'generation');
    console.log(
      `${request.status.toUpperCase()} ${request.kind} v${request.promptVersion} · ${folder.name} · ${target}`,
    );
    console.log(`  prompt:   ${path.join(directory, `${request.id}.prompt.md`)}`);
    console.log(`  response: ${path.join(directory, `${request.id}.response.json`)}`);
    for (const problem of request.problems ?? []) console.log(`  problem:  ${problem}`);
  }
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
