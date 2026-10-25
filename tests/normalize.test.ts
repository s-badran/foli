import { describe, expect, it } from 'vitest';
import {
  normalizeArtifact,
  normalizeOutline,
  normalizeQuiz,
  normalizeSections,
  normalizeSummary,
} from '../shared/normalize';

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

  it('normalizes misunderstanding key variants to mistake and correction', () => {
    const normalized = normalizeSummary({
      commonMisunderstandings: [
        {
          misconception: 'Users must belong to a group',
          correction: 'Users do not have to belong to a group',
        },
        { mistake: 'A wrong claim', correction: 'The right rule' },
      ],
    }) as { commonMisunderstandings: { mistake: string; correction: string }[] };
    expect(normalized.commonMisunderstandings[0]).toEqual({
      mistake: 'Users must belong to a group',
      correction: 'Users do not have to belong to a group',
    });
    expect(normalized.commonMisunderstandings[1]).toEqual({
      mistake: 'A wrong claim',
      correction: 'The right rule',
    });
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

describe('notes truncation', () => {
  it('clamps an oversized notes field to the schema limit', () => {
    const long = 'x'.repeat(1600);
    const sections = normalizeSections({ notes: long }) as { notes: string };
    expect(sections.notes.length).toBe(1000);
    const outline = normalizeOutline({ notes: long }) as { notes: string };
    expect(outline.notes.length).toBe(1500);
    const short = normalizeSections({ notes: 'brief' }) as { notes: string };
    expect(short.notes).toBe('brief');
  });
});

describe('sections clamping', () => {
  it('trims key topics to 10 and truncates long fields', () => {
    const raw = {
      sections: [
        {
          title: 'T'.repeat(200),
          objective: 'O'.repeat(400),
          keyTopics: Array.from({ length: 12 }, (_, index) => `topic ${index} ${'x'.repeat(100)}`),
        },
      ],
      notes: 'n'.repeat(1500),
    };
    const out = normalizeSections(raw) as {
      notes: string;
      sections: { title: string; objective: string; keyTopics: string[] }[];
    };
    expect(out.sections[0].keyTopics).toHaveLength(10);
    expect(out.sections[0].keyTopics[0].length).toBe(80);
    expect(out.sections[0].title.length).toBe(160);
    expect(out.sections[0].objective.length).toBe(300);
    expect(out.notes.length).toBe(1000);
  });
});

describe('outline clamping', () => {
  it('trims exam focus to 6 and truncates chapter fields', () => {
    const raw = {
      chapters: [
        {
          title: 'T'.repeat(200),
          description: 'D'.repeat(500),
          examFocus: Array.from({ length: 8 }, (_, index) => `focus ${index} ${'f'.repeat(300)}`),
          pageStart: 1,
          pageEnd: 5,
        },
      ],
      notes: 'n'.repeat(1600),
    };
    const out = normalizeOutline(raw) as {
      notes: string;
      chapters: { title: string; description: string; examFocus: string[] }[];
    };
    expect(out.chapters[0].examFocus).toHaveLength(6);
    expect(out.chapters[0].examFocus[0].length).toBe(240);
    expect(out.chapters[0].title.length).toBe(160);
    expect(out.chapters[0].description.length).toBe(400);
    expect(out.notes.length).toBe(1500);
  });
});
