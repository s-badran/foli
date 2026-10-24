import { access, copyFile, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { emptyState, type Folder, type StudyState } from '../shared/models';

export function workspaceDirectory(folder: Folder): string {
  const slug =
    folder.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 65) || 'exam';
  return `exams/${slug}--${folder.id.replace(/[^a-zA-Z0-9-]/g, '')}`;
}

export class Store {
  private queue: Promise<unknown> = Promise.resolve();
  constructor(readonly directory: string) {}

  async read(): Promise<StudyState> {
    await this.queue;
    return this.load();
  }

  private async load(): Promise<StudyState> {
    try {
      let index: { directories: string[] };
      try {
        index = JSON.parse(
          await readFile(path.join(this.directory, 'exams', 'index.json'), 'utf8'),
        );
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
        try {
          const legacy = JSON.parse(
            await readFile(path.join(this.directory, 'study.json'), 'utf8'),
          ) as StudyState;
          legacy.chapters ??= [];
          legacy.requests ??= [];
          return legacy;
        } catch (legacyError) {
          if ((legacyError as NodeJS.ErrnoException).code === 'ENOENT') return emptyState();
          throw legacyError;
        }
      }
      const state = emptyState();
      for (const directory of index.directories) {
        if (
          !directory.startsWith('exams/') ||
          directory.includes('..') ||
          path.isAbsolute(directory)
        )
          throw new Error('Invalid workspace directory.');
        const exam = JSON.parse(
          await readFile(path.join(this.directory, directory, 'workspace.json'), 'utf8'),
        ) as StudyState;
        for (const key of [
          'folders',
          'sources',
          'sections',
          'attempts',
          'reviews',
          'chapters',
          'requests',
        ] as const)
          state[key].push(...((exam[key] ?? []) as never[]));
      }
      return state;
    } catch (error) {
      void error;
      throw new Error(
        'Study data could not be read. Restore the affected exam workspace from a backup before continuing.',
      );
    }
  }

  sourcePath(folder: Folder, file: string) {
    return path.join(
      this.directory,
      folder.directory ?? workspaceDirectory(folder),
      'sources',
      path.basename(file),
    );
  }

  generationPath(folder: Folder, file: string) {
    return path.join(
      this.directory,
      folder.directory ?? workspaceDirectory(folder),
      'generation',
      path.basename(file),
    );
  }

  private async atomic(file: string, value: unknown) {
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(
      `${file}.tmp`,
      typeof value === 'string' ? value : JSON.stringify(value, null, 2),
      { mode: 0o600 },
    );
    await rename(`${file}.tmp`, file);
  }

  private async persist(state: StudyState) {
    for (const folder of state.folders) {
      folder.directory ??= workspaceDirectory(folder);
      const root = path.join(this.directory, folder.directory);
      const sources = state.sources.filter((source) => source.folderId === folder.id);
      for (const source of sources) {
        if (!source.file) continue;
        const target = this.sourcePath(folder, source.file);
        await mkdir(path.dirname(target), { recursive: true });
        try {
          await access(target);
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
          await copyFile(path.join(this.directory, 'uploads', path.basename(source.file)), target);
        }
      }
      const sections = state.sections.filter((section) => section.folderId === folder.id);
      const sectionIds = new Set(sections.map((section) => section.id));
      const exam = {
        ...emptyState(),
        folders: [folder],
        sources,
        sections,
        chapters: state.chapters.filter((chapter) => chapter.folderId === folder.id),
        attempts: state.attempts.filter((attempt) => sectionIds.has(attempt.sectionId)),
        reviews: state.reviews.filter((review) => sectionIds.has(review.sectionId)),
        requests: state.requests.filter((request) => request.folderId === folder.id),
      };
      await this.atomic(path.join(root, 'workspace.json'), exam);
      await this.atomic(path.join(root, 'plan.json'), folder.plan ?? null);
      await this.atomic(path.join(root, 'progress.json'), {
        reading: sections.map((section) => ({ id: section.id, read: section.read })),
        reviews: exam.reviews,
        attempts: exam.attempts,
      });
      await this.atomic(
        path.join(root, 'prompts', 'study.md'),
        folder.prompt ??
          '# Exam tutor brief\n\n(Optional) Tell the tutor what to emphasise for this exam, e.g. weak areas, question style or depth.\n',
      );
      for (const chapter of exam.chapters)
        await this.atomic(path.join(root, 'chapters', `${chapter.id}.json`), {
          chapter,
          sections: sections.filter(
            (section) => section.chapterId === chapter.id && !section.archived,
          ),
        });
    }
    await this.atomic(path.join(this.directory, 'exams', 'index.json'), {
      version: 2,
      directories: state.folders.map((folder) => folder.directory),
    });
  }

  update<Result>(mutate: (state: StudyState) => Result): Promise<Result> {
    const operation = this.queue.then(async () => {
      const state = await this.load();
      const result = mutate(state);
      await this.persist(state);
      return result;
    });
    this.queue = operation.catch(() => undefined);
    return operation;
  }
}
