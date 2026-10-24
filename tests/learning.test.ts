import { describe, expect, it } from 'vitest';
import { createEmptyCard } from 'ts-fsrs';
import { baselinePolicy, chapterPreparation } from '../shared/learning';
import { createPlan, replanExam } from '../server/study';
import { emptyState, type Chapter, type Section } from '../shared/models';
import { serializeCard } from '../server/study';

const chapter: Chapter = {
  id: 'chapter',
  folderId: 'exam',
  sourceId: 'book',
  title: 'Electrical circuits',
  order: 1,
  description: '',
  coverageStatus: 'source-audited',
  objectives: [
    { id: 'voltage', title: 'Voltage', sourceId: 'book', assessment: 'both' },
    { id: 'resistance', title: 'Resistance', sourceId: 'book', assessment: 'both' },
  ],
};
function fixture() {
  const state = emptyState();
  const section: Section = {
    id: 'lesson',
    folderId: 'exam',
    sourceId: 'book',
    chapterId: chapter.id,
    title: 'Circuit principles',
    text: '',
    read: true,
    content: {
      summary: 'A concise summary of circuit principles.',
      keyPoints: [],
      supplement: '',
      provider: 'offline',
      model: 'Tutor',
      generatedAt: '',
      cards: ['voltage', 'resistance'].map((id) => ({
        id,
        question: `What is ${id}?`,
        answer: 'A concise definition.',
        objectiveIds: [id],
        schedule: serializeCard(createEmptyCard()),
      })),
      quiz: ['voltage', 'resistance'].map((id) => ({
        question: `Apply ${id} to a circuit.`,
        options: ['a', 'b', 'c', 'd'],
        correctIndex: 1,
        explanation: 'Reasoning.',
        objectiveIds: [id],
      })),
    },
  };
  state.sections.push(section);
  state.chapters.push(chapter);
  return { state, section };
}

describe('topic-neutral preparation evidence', () => {
  it('changes workflow and replans on familiarity/date changes without changing assessments', () => {
    const { state, section } = fixture();
    const now = new Date('2026-10-24T12:00:00Z');
    const learner = { familiarity: 'new' as const, role: 'student' as const, goal: '' };
    const plan = createPlan([section], '2026-11-10', 60, now, learner, state);
    const folder = {
      id: 'exam',
      name: 'Circuits',
      createdAt: '',
      learner: { ...learner, familiarity: 'basic' as const },
      plan,
    };
    const original = JSON.stringify(section.content);
    replanExam(state, folder, now);
    expect(folder.plan.familiarity).toBe('basic');
    expect(folder.plan.days[0].studyMinutes).toBe(15);
    expect(plan.days[0].studyMinutes).toBe(25);
    expect(JSON.stringify(section.content)).toBe(original);
    expect(baselinePolicy('new').initialTab).toBe('summary');
    expect(baselinePolicy('basic').initialTab).toBe('cards');
    expect(baselinePolicy('refresh').initialTab).toBe('quiz');
    const two = [section, { ...section, id: 'second' }];
    const short = createPlan(two, '2026-10-28', 60, now, learner);
    const long = createPlan(two, '2026-11-20', 60, now, learner);
    expect(short.days.find((day) => day.sectionIds.includes('second'))?.date).not.toBe(
      long.days.find((day) => day.sectionIds.includes('second'))?.date,
    );
  });
  it('does not count reading or an uncovered topic as prepared', () => {
    const { state } = fixture();
    expect(chapterPreparation(chapter, state.sections, state).complete).toBe(false);
    const added = {
      ...chapter,
      objectives: [
        ...chapter.objectives!,
        { id: 'current', title: 'Current', sourceId: 'book', assessment: 'both' as const },
      ],
    };
    const result = chapterPreparation(added, state.sections, state);
    expect(result.covered).toBe(2);
    expect(result.total).toBe(3);
  });
  it('requires successful card recall and correct quiz evidence, regardless of reading', () => {
    const { state, section } = fixture();
    section.read = false;
    state.reviews.push(
      ...['voltage', 'resistance'].map((cardId) => ({
        cardId,
        sectionId: section.id,
        rating: 3,
        date: '',
      })),
    );
    state.attempts.push({
      id: 'attempt',
      sectionId: section.id,
      date: '',
      answers: [1, 1],
      correct: 2,
      total: 2,
    });
    expect(chapterPreparation(chapter, state.sections, state).complete).toBe(true);
    state.reviews.push({ cardId: 'resistance', sectionId: section.id, rating: 1, date: '' });
    expect(chapterPreparation(chapter, state.sections, state).complete).toBe(false);
  });
  it('cannot claim source coverage for an unaudited blueprint or a failed latest quiz', () => {
    const { state, section } = fixture();
    state.reviews.push(
      ...['voltage', 'resistance'].map((cardId) => ({
        cardId,
        sectionId: section.id,
        rating: 4,
        date: '',
      })),
    );
    state.attempts.push({
      id: 'attempt',
      sectionId: section.id,
      date: '',
      answers: [1, 1],
      correct: 2,
      total: 2,
    });
    expect(
      chapterPreparation({ ...chapter, coverageStatus: 'draft' }, state.sections, state).complete,
    ).toBe(false);
    state.attempts.push({
      id: 'later',
      sectionId: section.id,
      date: '',
      answers: [1, 0],
      correct: 1,
      total: 2,
    });
    expect(chapterPreparation(chapter, state.sections, state).complete).toBe(false);
  });
});
