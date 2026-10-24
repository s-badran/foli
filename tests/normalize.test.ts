import { describe, expect, it } from 'vitest';
import { normalizeArtifact, normalizeQuiz, normalizeSummary } from '../shared/normalize';

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

describe('normalizeQuiz', () => {
  it('spreads correct-answer positions when they are all the same', () => {
    const quiz = {
      questions: [
        { question: 'q1', options: ['a1', 'b1', 'c1', 'd1'], correctIndex: 0 },
        { question: 'q2', options: ['a2', 'b2', 'c2', 'd2'], correctIndex: 0 },
        { question: 'q3', options: ['a3', 'b3', 'c3', 'd3'], correctIndex: 0 },
        { question: 'q4', options: ['a4', 'b4', 'c4', 'd4'], correctIndex: 0 },
      ],
    };
    const normalized = normalizeQuiz(quiz) as {
      questions: { options: string[]; correctIndex: number }[];
    };
    expect(normalized.questions.map((item) => item.correctIndex)).toEqual([0, 1, 2, 3]);
    // The correct answer (first option) is preserved at its new position.
    expect(normalized.questions[1].options[1]).toBe('a2');
  });

  it('leaves quizzes with varied positions untouched', () => {
    const quiz = {
      questions: [
        { question: 'q1', options: ['a', 'b', 'c', 'd'], correctIndex: 0 },
        { question: 'q2', options: ['a', 'b', 'c', 'd'], correctIndex: 1 },
        { question: 'q3', options: ['a', 'b', 'c', 'd'], correctIndex: 2 },
        { question: 'q4', options: ['a', 'b', 'c', 'd'], correctIndex: 0 },
      ],
    };
    expect(normalizeQuiz(quiz)).toEqual(quiz);
  });
});
