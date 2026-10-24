import { describe, expect, it } from 'vitest';
import { normalizeArtifact, normalizeSummary } from '../shared/normalize';

describe('normalizeSummary', () => {
  it('joins keyComparisons item arrays into a single label', () => {
    const normalized = normalizeSummary({
      keyComparisons: [
        { items: ['EBS', 'Instance Store'], difference: 'Attached vs local.' },
        { items: 'On-Demand vs Reserved', difference: 'Commitment.' },
      ],
    }) as { keyComparisons: { items: string }[] };
    expect(normalized.keyComparisons[0].items).toBe('EBS vs Instance Store');
    expect(normalized.keyComparisons[1].items).toBe('On-Demand vs Reserved');
  });

  it('passes through data without keyComparisons unchanged', () => {
    const summary = { overview: 'Just an overview.' };
    expect(normalizeSummary(summary)).toEqual(summary);
  });

  it('leaves invalid item entries alone so validation reports them', () => {
    const bad = { keyComparisons: [{ items: 42, difference: 'x' }] };
    expect(normalizeSummary(bad)).toEqual(bad);
  });
});

describe('normalizeArtifact', () => {
  it('normalizes summary kind and passes other kinds through', () => {
    expect(normalizeArtifact('summary', { keyComparisons: [{ items: ['A', 'B'], difference: 'd' }] })).toEqual({
      keyComparisons: [{ items: 'A vs B', difference: 'd' }],
    });
    expect(normalizeArtifact('flashcards', { groups: [] })).toEqual({ groups: [] });
  });
});
