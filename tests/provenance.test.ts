import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MODEL_ID,
  needsRegenerate,
  type ArtifactMeta,
  type Folder,
} from '../shared/models';

function folder(overrides: Partial<Folder> = {}): Folder {
  return {
    id: 'exam',
    name: 'Exam',
    createdAt: '',
    learner: { familiarity: 'basic', role: 'student', goal: '' },
    ...overrides,
  };
}

function meta(overrides: Partial<ArtifactMeta> = {}): ArtifactMeta {
  return {
    requestId: 'request',
    promptVersion: 1,
    generatedAt: '2026-01-01',
    model: 'deepseek-chat',
    familiarity: 'basic',
    revision: 2,
    ...overrides,
  };
}

describe('needsRegenerate', () => {
  it('is false when nothing changed', () => {
    expect(needsRegenerate(folder({ modelId: 'deepseek-chat', curriculumRevision: 2 }), meta())).toBe(false);
  });
  it('is true when the model changed', () => {
    expect(needsRegenerate(folder({ modelId: 'gpt-4o-mini', curriculumRevision: 2 }), meta())).toBe(true);
  });
  it('is true when the baseline changed', () => {
    expect(
      needsRegenerate(
        folder({
          modelId: 'deepseek-chat',
          curriculumRevision: 2,
          learner: { familiarity: 'refresh', role: 'student', goal: '' },
        }),
        meta(),
      ),
    ).toBe(true);
  });
  it('is true when the source revision changed', () => {
    expect(needsRegenerate(folder({ modelId: 'deepseek-chat', curriculumRevision: 3 }), meta())).toBe(true);
  });
  it('is true when no provenance exists', () => {
    expect(needsRegenerate(folder(), undefined)).toBe(true);
  });
  it('treats missing provenance fields as unchanged', () => {
    expect(needsRegenerate(folder({ modelId: 'deepseek-chat', curriculumRevision: 2 }), meta({ model: undefined }))).toBe(false);
  });
});

describe('default model', () => {
  it('is deepseek-chat', () => {
    expect(DEFAULT_MODEL_ID).toBe('deepseek-chat');
  });
});
