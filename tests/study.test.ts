import { describe, expect, it } from 'vitest';
import { createEmptyCard } from 'ts-fsrs';
import { createPlan, reviewCard, serializeCard } from '../server/study';
import { extractiveContent, parseModelOutput } from '../server/generation';
import type { Section } from '../shared/models';

const source = 'An availability zone contains one or more discrete data centers with redundant power.\nA virtual private cloud provides network isolation for your AWS resources.\nIAM roles provide temporary security credentials to workloads running on AWS.';
describe('study packs', () => {
  it('creates grounded offline practice with four distinct choices', () => {
    const content = extractiveContent(source);
    expect(content.cards.length).toBe(3);
    expect(content.summary).toContain('network isolation');
    for (const question of content.quiz) expect(new Set(question.options).size).toBe(4);
  });
  it('rejects malformed and incomplete AI output', () => {
    expect(() => parseModelOutput('not json')).toThrow('invalid JSON');
    expect(() => parseModelOutput('{"summary":"short"}')).toThrow('incomplete');
  });
  it('supports JSON fences', () => expect(parseModelOutput(`\`\`\`json\n${JSON.stringify(extractiveContent(source))}\n\`\`\``).cards.length).toBe(3));
});
describe('spaced repetition and plans', () => {
  const now = new Date('2026-10-23T12:00:00Z');
  it('persists FSRS state and schedules successful cards in the future', () => {
    const reviewed = reviewCard(serializeCard(createEmptyCard(now)), 3, now);
    expect(reviewed.reps).toBe(1);
    expect(new Date(reviewed.due).getTime()).toBeGreaterThan(now.getTime());
    expect(reviewed.last_review).toBe(now.toISOString());
  });
  it('rejects invalid review ratings', () => expect(() => reviewCard(serializeCard(createEmptyCard()), 5)).toThrow());
  const sections = Array.from({ length: 20 }, (_, index) => ({ id: `${index}`, read: index === 0 })) as Section[];
  it('schedules every unread section exactly once, before the exam', () => {
    const plan = createPlan(sections, '2026-11-01', 60, now);
    const ids = plan.days.flatMap(day => day.sectionIds);
    expect(ids).toHaveLength(19);
    expect(new Set(ids).size).toBe(19);
    expect(ids).not.toContain('0');
    expect(plan.days.at(-1)?.date).toBe('2026-10-31');
    expect(plan.warning).toBeUndefined();
  });
  it('warns about an overloaded plan without silently losing sections', () => {
    const plan = createPlan(sections, '2026-10-24', 20, now);
    expect(plan.warning).toContain('exceeds');
    expect(plan.days.flatMap(day => day.sectionIds)).toHaveLength(19);
  });
  it('rejects past exam dates', () => expect(() => createPlan(sections, '2026-10-22', 60, now)).toThrow());
});