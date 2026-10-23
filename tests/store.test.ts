import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { emptyState } from '../shared/models';
import { Store } from '../server/store';

describe('exam-directory storage', () => {
  it('does not silently replace an indexed but missing exam snapshot with an empty library', async () => {
    const directory = await mkdtemp(path.join(process.cwd(), '.cache-test-store-'));
    try {
      await mkdir(path.join(directory, 'exams'), { recursive: true });
      await writeFile(
        path.join(directory, 'exams/index.json'),
        JSON.stringify({ version: 2, directories: ['exams/missing-exam'] }),
      );
      await expect(new Store(directory).read()).rejects.toThrow('could not be read');
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
  it('migrates the legacy store without losing records or changing original files', async () => {
    const directory = await mkdtemp(path.join(process.cwd(), '.cache-test-store-'));
    try {
      const state = emptyState();
      state.folders.push({ id: 'exam-1', name: 'AWS Exam', createdAt: new Date().toISOString() });
      state.sources.push({
        id: 'source-1',
        folderId: 'exam-1',
        name: 'guide.md',
        kind: 'md',
        file: 'source-1.md',
        addedAt: new Date().toISOString(),
      });
      state.sections.push({
        id: 'section-1',
        folderId: 'exam-1',
        sourceId: 'source-1',
        title: 'IAM',
        text: 'Original source text',
        read: true,
      });
      await mkdir(path.join(directory, 'uploads'), { recursive: true });
      await writeFile(path.join(directory, 'uploads/source-1.md'), 'Unchanged original');
      const original = JSON.stringify(state);
      await writeFile(path.join(directory, 'study.json'), original);
      const store = new Store(directory);
      await store.update((current) => {
        current.folders[0].prompt = 'Custom exam prompt';
      });
      const loaded = await new Store(directory).read();
      const root = path.join(directory, loaded.folders[0].directory!);
      expect(loaded.sections[0].read).toBe(true);
      expect(await readFile(path.join(root, 'sources/source-1.md'), 'utf8')).toBe(
        'Unchanged original',
      );
      expect(await readFile(path.join(root, 'prompts/study.md'), 'utf8')).toBe(
        'Custom exam prompt',
      );
      expect(await readFile(path.join(directory, 'study.json'), 'utf8')).toBe(original);
      expect(
        JSON.parse(await readFile(path.join(root, 'progress.json'), 'utf8')).reading[0].read,
      ).toBe(true);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
