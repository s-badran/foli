import { describe, expect, it } from 'vitest';
import { emptyState, type StudyState } from '../shared/models';
import { chapterPreparation, sectionPractice } from '../shared/learning';
import { renderSummary } from '../shared/artifacts';
import {
  applyResponse,
  loadPrompt,
  renderRequest,
  renderTemplate,
  sourcePages,
} from '../server/tutor';
import type { GenerationRequest } from '../shared/models';

const footer = '© Example Press - do not copy';
const pages = [
  'Contents\nChapter 1 Basics\nChapter 2 Circuits',
  'Chapter 1 Basics\nVoltage is electric potential difference, measured in volts.',
  'Current is the flow of charge, measured in amperes.',
  'Chapter 2 Circuits\nOhm law: V = I x R.',
  'Series resistors add: R = R1 + R2.',
];

function book(): StudyState {
  const state = emptyState();
  state.folders.push({
    id: 'exam',
    name: 'Electronics Fundamentals',
    createdAt: '',
    mainSourceId: 'main',
    prompt: 'Emphasise unit conversions.',
    learner: { familiarity: 'basic', role: 'student', goal: 'Pass the certificate' },
  });
  state.sources.push({
    id: 'main',
    folderId: 'exam',
    name: 'book.pdf',
    kind: 'pdf',
    addedAt: '',
    pages: 5,
  });
  pages.forEach((text, index) =>
    state.sections.push({
      id: `page-${index + 1}`,
      folderId: 'exam',
      sourceId: 'main',
      title: `Page ${index + 1}`,
      text: `${text}\n${footer}`,
      pageStart: index + 1,
      pageEnd: index + 1,
      read: false,
      sourceFragment: true,
      archived: true,
    }),
  );
  return state;
}

function request(kind: GenerationRequest['kind'], targetId?: string): GenerationRequest {
  return {
    id: `${kind}-${targetId ?? 'all'}`,
    folderId: 'exam',
    kind,
    targetId,
    status: 'pending',
    promptVersion: 1,
    createdAt: '',
  };
}

const outline = {
  chapters: [
    { title: 'Basics', pageStart: 2, pageEnd: 3, description: 'Voltage and current.' },
    {
      title: 'Circuits',
      pageStart: 4,
      pageEnd: 5,
      description: "Ohm's law and series resistance.",
    },
  ],
  excludedPages: [{ pageStart: 1, pageEnd: 1, reason: 'Table of contents' }],
};
const sectionPlan = {
  sections: [
    {
      title: 'Voltage and current',
      pageStart: 2,
      pageEnd: 3,
      keyTopics: ['Voltage', 'Current'],
      objective: 'Distinguish voltage from current and their units.',
    },
  ],
};
const goodCards = {
  groups: [
    {
      concept: 'Units',
      cards: [
        { question: 'Unit of voltage?', answer: 'Volt', keyTopic: 'Voltage' },
        {
          question: 'What does voltage measure?',
          answer: 'Electric potential difference',
          keyTopic: 'Voltage',
        },
        { question: 'Unit of current?', answer: 'Ampere', keyTopic: 'Current' },
        {
          question: 'Which quantities define flow vs potential?',
          answer: ['Current: flow of charge', 'Voltage: potential difference'],
          keyTopic: 'Current',
        },
      ],
    },
  ],
};
const goodQuiz = {
  questions: [
    {
      question: 'A meter reads 5 A in a wire. Which quantity is being reported?',
      options: ['Current', 'Voltage', 'Resistance', 'Power'],
      correctIndex: 0,
      explanation: 'Amperes measure current; volts measure voltage; ohms resistance; watts power.',
      keyTopic: 'Current',
      kind: 'scenario',
    },
    {
      question: 'A battery is labelled 9 V. What does that value describe?',
      options: ['Charge flow', 'Potential difference', 'Resistance', 'Energy stored'],
      correctIndex: 1,
      explanation: 'Volts describe potential difference, not flow, resistance or total energy.',
      keyTopic: 'Voltage',
      kind: 'scenario',
    },
    {
      question: 'Which pair is correctly matched?',
      options: ['Current - volt', 'Voltage - ampere', 'Current - ampere', 'Voltage - ohm'],
      correctIndex: 2,
      explanation: 'Current is measured in amperes; the others mismatch quantity and unit.',
      keyTopic: 'Current',
      kind: 'comparison',
    },
  ],
};

function sectioned() {
  const state = book();
  expect(applyResponse(state, request('outline'), outline)).toEqual([]);
  const chapter = state.chapters[0];
  expect(applyResponse(state, request('sections', chapter.id), sectionPlan)).toEqual([]);
  const section = state.sections.find((item) => item.chapterId === chapter.id && !item.archived)!;
  return { state, chapter, section };
}

describe('request lifecycle', () => {
  it('supersedes queued per-section requests when sections are replaced', () => {
    const { state, chapter, section } = sectioned();
    const summary = request('summary', section.id);
    state.requests.push(summary);
    expect(applyResponse(state, request('sections', chapter.id), sectionPlan)).toEqual([]);
    expect(state.requests.find((item) => item.id === summary.id)?.status).toBe('superseded');
  });
});

describe('prompt files', () => {
  it('are versioned and every template variable is supplied', async () => {
    for (const id of ['system', 'outline', 'sections', 'summary', 'flashcards', 'quiz'])
      expect((await loadPrompt(id)).version).toBeGreaterThan(0);
    const { state, chapter, section } = sectioned();
    const folder = state.folders[0];
    for (const [kind, target] of [
      ['outline', undefined],
      ['sections', chapter.id],
      ['summary', section.id],
      ['flashcards', section.id],
      ['quiz', section.id],
    ] as const) {
      const { text } = await renderRequest(state, folder, kind, target);
      expect(text).not.toMatch(/\{\{\w+\}\}/);
      expect(text).toContain('Emphasise unit conversions.');
      expect(text).toContain('Required JSON schema');
    }
    expect(() => renderTemplate('{{missing}}', {})).toThrow('missing');
  });
  it('contain no exam-specific wording', async () => {
    for (const id of ['system', 'outline', 'sections', 'summary', 'flashcards', 'quiz'])
      expect((await loadPrompt(id)).body).not.toMatch(/\bAWS\b|Amazon|IAM|S3|EC2/);
  });
  it('strips repeated footers from page text', () => {
    expect(sourcePages(book(), 'main').every((page) => !page.text.includes(footer))).toBe(true);
  });
});

describe('response validation and application', () => {
  it('rejects overlapping or out-of-range outlines without changing state', () => {
    const state = book();
    const bad = {
      ...outline,
      chapters: [outline.chapters[0], { ...outline.chapters[1], pageStart: 3, pageEnd: 9 }],
    };
    expect(applyResponse(state, request('outline'), bad).join(' ')).toMatch(/overlaps|within/);
    expect(state.chapters).toHaveLength(0);
  });
  it('builds chapters from the outline and sections with a key-topic inventory', () => {
    const { state, chapter, section } = sectioned();
    expect(state.chapters.map((item) => item.title)).toEqual(['Basics', 'Circuits']);
    expect(section.keyTopics).toEqual(['Voltage', 'Current']);
    expect(section.text).toContain('Voltage is electric potential difference');
    expect(chapter.objectives?.map((item) => item.title)).toEqual(['Voltage', 'Current']);
    expect(chapter.coverageStatus).toBe('source-audited');
  });
  it('rejects paragraph flashcards, uncovered topics and yes/no-heavy decks', () => {
    const { state, section } = sectioned();
    const paragraph = {
      groups: [
        {
          concept: 'Units',
          cards: [
            {
              question: 'Explain voltage?',
              answer:
                'Voltage is the electric potential difference between two points in a circuit and it is measured in volts using a voltmeter connected in parallel',
              keyTopic: 'Voltage',
            },
          ],
        },
      ],
    };
    expect(
      applyResponse(state, request('flashcards', section.id), paragraph).length,
    ).toBeGreaterThan(0);
    const uncovered = {
      groups: [
        {
          concept: 'Units',
          cards: goodCards.groups[0].cards.map((card) => ({ ...card, keyTopic: 'Voltage' })),
        },
      ],
    };
    expect(applyResponse(state, request('flashcards', section.id), uncovered).join(' ')).toContain(
      'not covered',
    );
    const yesNo = {
      groups: [
        {
          concept: 'Units',
          cards: goodCards.groups[0].cards.map((card, index) => ({
            ...card,
            question: `Is fact ${index} true?`,
            answer: 'Yes',
          })),
        },
      ],
    };
    expect(applyResponse(state, request('flashcards', section.id), yesNo).join(' ')).toContain(
      'yes/no',
    );
    expect(section.content?.cards ?? []).toHaveLength(0);
  });
  it('maps accepted cards to objectives, keeps groups and joins list answers', () => {
    const { state, section } = sectioned();
    expect(applyResponse(state, request('flashcards', section.id), goodCards)).toEqual([]);
    const cards = section.content!.cards;
    expect(cards).toHaveLength(4);
    expect(cards[0].group).toBe('Units');
    expect(cards[3].answer).toBe('Current: flow of charge\nVoltage: potential difference');
    expect(cards.every((card) => card.objectiveIds?.[0]?.startsWith(section.id))).toBe(true);
  });
  it('rejects weak quizzes and accepts scenario-led ones', () => {
    const { state, section } = sectioned();
    const weak = {
      questions: goodQuiz.questions.map((question) => ({
        ...question,
        kind: 'concept',
        options: [...question.options.slice(0, 3), 'All of the above'],
      })),
    };
    expect(applyResponse(state, request('quiz', section.id), weak).join(' ')).toMatch(
      /all\/none|scenario/,
    );
    expect(applyResponse(state, request('quiz', section.id), goodQuiz)).toEqual([]);
    expect(section.content!.quiz).toHaveLength(3);
  });
  it('renders the summary as an exam study sheet', () => {
    const { state, section } = sectioned();
    const summary = {
      overview: 'Voltage and current are the two base quantities of every circuit question.',
      coreConcepts: [
        { term: 'Voltage', definition: 'Potential difference, in volts.' },
        { term: 'Current', definition: 'Charge flow, in amperes.' },
      ],
      mustRemember: ['Volts measure voltage.', 'Amperes measure current.'],
      examTraps: [{ trap: 'Current is measured in volts', correction: 'Current uses amperes.' }],
    };
    expect(applyResponse(state, request('summary', section.id), summary)).toEqual([]);
    expect(section.content!.summary).toContain('## Core Concepts');
    expect(section.content!.summary).toContain('## Exam Traps');
    expect(renderSummary(section.summaryData!)).not.toContain('## Key Comparisons');
  });
  it('normalizes keyComparisons item arrays before validating a summary', () => {
    const { state, section } = sectioned();
    const summary = {
      overview: 'Storage choices decide durability, latency and cost.',
      coreConcepts: [
        { term: 'EBS', definition: 'Network-attached block storage.' },
        { term: 'Instance Store', definition: 'Local ephemeral storage.' },
      ],
      mustRemember: ['EBS survives stop/start.', 'Instance Store is lost on stop.'],
      keyComparisons: [
        { items: ['EBS', 'Instance Store'], difference: 'Network-attached versus local hardware.' },
      ],
    };
    expect(applyResponse(state, request('summary', section.id), summary)).toEqual([]);
    expect(section.content!.summary).toContain('**EBS vs Instance Store:** Network-attached versus local hardware.');
  });
  it('requires recall and current-quiz evidence for chapter preparation', () => {
    const { state, chapter, section } = sectioned();
    applyResponse(state, request('flashcards', section.id), goodCards);
    applyResponse(state, request('quiz', section.id), goodQuiz);
    expect(chapterPreparation(chapter, state.sections, state).complete).toBe(false);
    for (const card of section.content!.cards)
      state.reviews.push({ cardId: card.id, sectionId: section.id, rating: 3, date: '' });
    const quizId = section.artifacts!.quiz!.requestId;
    state.attempts.push({
      id: 'a1',
      sectionId: section.id,
      date: '',
      answers: [0, 1, 2],
      correct: 3,
      total: 3,
      quizRequestId: quizId,
    });
    expect(chapterPreparation(chapter, state.sections, state).complete).toBe(true);
    applyResponse(state, { ...request('quiz', section.id), id: 'quiz-v2' }, goodQuiz);
    expect(sectionPractice(section, state).complete).toBe(false);
  });
});
