import { z } from 'zod';

const wordCount = (value: string) => value.trim().split(/\s+/).filter(Boolean).length;
const text = (min: number, max: number) => z.string().trim().min(min).max(max);
const short = (maxWords: number, maxChars: number) =>
  text(1, maxChars).refine((value) => wordCount(value) <= maxWords, {
    message: `Must be ${maxWords} words or fewer.`,
  });

export const artifactKinds = ['outline', 'sections', 'summary', 'flashcards', 'quiz'] as const;
export type ArtifactKind = (typeof artifactKinds)[number];

const pageRange = { pageStart: z.number().int().min(1), pageEnd: z.number().int().min(1) };

export const outlineSchema = z.object({
  chapters: z
    .array(
      z.object({
        title: text(2, 160),
        ...pageRange,
        description: text(10, 400),
        examFocus: z.array(text(2, 240)).max(6).default([]),
      }),
    )
    .min(1)
    .max(80),
  excludedPages: z
    .array(z.object({ ...pageRange, reason: text(3, 200) }))
    .max(40)
    .default([]),
  notes: z.string().max(1500).default(''),
});

export const sectionsSchema = z.object({
  sections: z
    .array(
      z.object({
        title: text(2, 160),
        ...pageRange,
        keyTopics: z.array(text(2, 80)).min(2).max(10),
        objective: text(10, 300),
      }),
    )
    .min(1)
    .max(12),
  notes: z.string().max(1000).default(''),
});

export const summarySchema = z.object({
  overview: text(40, 900),
  coreConcepts: z
    .array(z.object({ term: text(1, 80), definition: text(5, 320) }))
    .min(2)
    .max(20),
  mustRemember: z.array(text(5, 320)).min(2).max(12),
  keyComparisons: z
    .array(z.object({ items: text(3, 140), difference: text(5, 320) }))
    .max(8)
    .default([]),
  commonMisunderstandings: z.array(text(5, 320)).max(10).default([]),
  mentalModels: z.array(text(5, 320)).max(8).default([]),
  edgeCases: z.array(text(5, 320)).max(8).default([]),
  whenToUse: z
    .array(z.object({ situation: text(5, 220), use: text(2, 220) }))
    .max(10)
    .default([]),
  patternsToRecognize: z
    .array(z.object({ signal: text(3, 220), indicates: text(2, 220) }))
    .max(10)
    .default([]),
  examTraps: z
    .array(z.object({ trap: text(3, 220), correction: text(5, 320) }))
    .max(10)
    .default([]),
  beyondSource: z.array(text(5, 320)).max(6).default([]),
});

const flashcard = z.object({
  question: short(25, 220),
  answer: z.union([short(15, 140), z.array(short(10, 90)).min(2).max(8)]),
  keyTopic: text(2, 80),
  origin: z.enum(['source', 'exam-guide', 'background']).default('source'),
});

export const flashcardsSchema = z.object({
  groups: z
    .array(z.object({ concept: text(2, 80), cards: z.array(flashcard).min(1).max(12) }))
    .min(1)
    .max(15),
});

export const quizSchema = z.object({
  questions: z
    .array(
      z.object({
        question: text(10, 700),
        options: z.array(text(1, 260)).length(4),
        correctIndex: z.number().int().min(0).max(3),
        explanation: text(20, 900),
        keyTopic: text(2, 80),
        kind: z.enum(['scenario', 'concept', 'comparison']),
      }),
    )
    .min(3)
    .max(12),
});

export type Outline = z.infer<typeof outlineSchema>;
export type SectionPlan = z.infer<typeof sectionsSchema>;
export type Summary = z.infer<typeof summarySchema>;
export type Flashcards = z.infer<typeof flashcardsSchema>;
export type Quiz = z.infer<typeof quizSchema>;

export const artifactSchemas = {
  outline: outlineSchema,
  sections: sectionsSchema,
  summary: summarySchema,
  flashcards: flashcardsSchema,
  quiz: quizSchema,
} as const;

const same = (left: string, right: string) =>
  left.trim().toLowerCase() === right.trim().toLowerCase();

export function checkRanges(
  ranges: { title?: string; pageStart: number; pageEnd: number }[],
  min: number,
  max: number,
) {
  const problems: string[] = [];
  let previousEnd = min - 1;
  for (const range of ranges) {
    const label = range.title ?? `${range.pageStart}-${range.pageEnd}`;
    if (range.pageEnd < range.pageStart) problems.push(`${label}: pageEnd precedes pageStart.`);
    if (range.pageStart < min || range.pageEnd > max)
      problems.push(`${label}: pages must stay within ${min}-${max}.`);
    if (range.pageStart <= previousEnd) problems.push(`${label}: overlaps the previous range.`);
    previousEnd = range.pageEnd;
  }
  return problems;
}

/** Coverage and quality rules that a schema alone cannot express. */
export function checkFlashcards(cards: Flashcards, keyTopics: string[]) {
  const all = cards.groups.flatMap((group) => group.cards);
  const problems: string[] = [];
  if (all.length < Math.max(4, keyTopics.length * 2))
    problems.push(
      `Too few cards: ${all.length} for ${keyTopics.length} key topics (need 2+ each).`,
    );
  if (all.length > 45) problems.push(`Too many cards: ${all.length} (max 45 per section).`);
  for (const card of all)
    if (!keyTopics.some((topic) => same(topic, card.keyTopic)))
      problems.push(`Unknown keyTopic "${card.keyTopic}" on: ${card.question}`);
  for (const topic of keyTopics)
    if (!all.some((card) => same(card.keyTopic, topic)))
      problems.push(`Key topic not covered by any card: ${topic}`);
  const questions = all.map((card) => card.question.toLowerCase());
  if (new Set(questions).size !== questions.length) problems.push('Duplicate card questions.');
  const yesNo = all.filter(
    (card) => typeof card.answer === 'string' && /^(yes|no)\b/i.test(card.answer),
  );
  if (yesNo.length > Math.ceil(all.length * 0.2))
    problems.push(`Too many yes/no cards: ${yesNo.length} of ${all.length} (max 20%).`);
  return problems;
}

export function checkQuiz(quiz: Quiz, keyTopics: string[]) {
  const problems: string[] = [];
  for (const question of quiz.questions) {
    if (!keyTopics.some((topic) => same(topic, question.keyTopic)))
      problems.push(`Unknown keyTopic "${question.keyTopic}".`);
    if (new Set(question.options.map((option) => option.toLowerCase())).size !== 4)
      problems.push(`Duplicate options in: ${question.question.slice(0, 80)}`);
    if (question.options.some((option) => /all of the above|none of the above/i.test(option)))
      problems.push('Avoid "all/none of the above" options.');
  }
  const covered = new Set(quiz.questions.map((question) => question.keyTopic.toLowerCase()));
  if (covered.size < Math.min(quiz.questions.length, Math.ceil(keyTopics.length / 2)))
    problems.push(`Quiz covers only ${covered.size} of ${keyTopics.length} key topics.`);
  const positions = new Set(quiz.questions.map((question) => question.correctIndex));
  if (quiz.questions.length >= 4 && positions.size < 2)
    problems.push('Correct answers all use the same option position.');
  if (
    quiz.questions.filter((question) => question.kind === 'scenario').length <
    Math.ceil(quiz.questions.length / 2)
  )
    problems.push('At least half of the questions must be scenario-based.');
  return problems;
}

export function renderSummary(summary: Summary, options = { mustRemember: true }) {
  const list = (items: string[]) => items.map((item) => `- ${item}`).join('\n');
  const blocks: [string, string][] = [
    ['Overview', summary.overview],
    [
      'Core Concepts',
      list(summary.coreConcepts.map((item) => `**${item.term}:** ${item.definition}`)),
    ],
    ['Must Remember', options.mustRemember ? list(summary.mustRemember) : ''],
    [
      'Key Comparisons',
      list(summary.keyComparisons.map((item) => `**${item.items}:** ${item.difference}`)),
    ],
    ['Common Misunderstandings', list(summary.commonMisunderstandings)],
    ['Mental Models', list(summary.mentalModels)],
    ['Exceptions & Edge Cases', list(summary.edgeCases)],
    [
      'When to Use Which',
      list(summary.whenToUse.map((item) => `${item.situation} → **${item.use}**`)),
    ],
    [
      'Patterns to Recognize',
      list(summary.patternsToRecognize.map((item) => `${item.signal} → **${item.indicates}**`)),
    ],
    ['Exam Traps', list(summary.examTraps.map((item) => `“${item.trap}” — ${item.correction}`))],
    ['Beyond the Source (tutor knowledge)', list(summary.beyondSource)],
  ];
  return blocks
    .filter(([, body]) => body.trim())
    .map(([heading, body]) => `## ${heading}\n\n${body}`)
    .join('\n\n');
}
