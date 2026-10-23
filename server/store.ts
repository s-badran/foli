import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { emptyState, type StudyState } from '../shared/models';

export class Store {
  private queue: Promise<unknown> = Promise.resolve();
  constructor(readonly directory: string) {}

  async read(): Promise<StudyState> {
    await this.queue;
    return this.load();
  }

  private async load(): Promise<StudyState> {
    try {
      return JSON.parse(
        await readFile(path.join(this.directory, 'study.json'), 'utf8'),
      ) as StudyState;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return emptyState();
      throw new Error(
        'Study data could not be read. Restore data/study.json from a backup before continuing.',
      );
    }
  }

  update<Result>(mutate: (state: StudyState) => Result): Promise<Result> {
    const operation = this.queue.then(async () => {
      const state = await this.load();
      const result = mutate(state);
      await mkdir(this.directory, { recursive: true });
      const target = path.join(this.directory, 'study.json');
      await writeFile(`${target}.tmp`, JSON.stringify(state), { mode: 0o600 });
      await rename(`${target}.tmp`, target);
      return result;
    });
    this.queue = operation.catch(() => undefined);
    return operation;
  }
}
