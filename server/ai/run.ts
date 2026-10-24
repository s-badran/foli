import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { ingestRequest } from '../tutor';
import type { Store } from '../store';
import type { GenerationRequest } from '../../shared/models';
import { AiModel } from './model';

function required<Item extends { id: string }>(items: Item[], id: string): Item {
  const item = items.find((entry) => entry.id === id);
  if (!item) throw new Error(`Missing item ${id}.`);
  return item;
}

/**
 * Answer a single queued request with the selected model, write its reply to the
 * same response file a human would write, then run the identical validation/apply path.
 */
export async function answerRequest(
  store: Store,
  requestId: string,
  modelId?: string,
): Promise<{ request: GenerationRequest; problems: string[]; applied: boolean }> {
  const state = await store.read();
  const request = required(state.requests, requestId);
  if (request.status === 'done' || request.status === 'superseded')
    return { request, problems: [], applied: false };
  const folder = required(state.folders, request.folderId);
  const model = AiModel.create(modelId ?? process.env.FOLIO_AI_MODEL);
  const prompt = await readFile(store.generationPath(folder, `${request.id}.prompt.md`), 'utf8');
  const text = await model.complete({ prompt });
  const file = store.generationPath(folder, `${request.id}.response.json`);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, text, { mode: 0o600 });
  const result = await ingestRequest(store, requestId);
  return { request: result.request, problems: result.problems, applied: result.applied };
}
