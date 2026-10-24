import type { ArtifactKind } from './artifacts';

/**
 * Normalizers coerce a model's natural output into Folio's canonical schema before
 * validation. Each provider only speaks its own API; shape differences in the content
 * are handled here, once per artifact kind, for every provider.
 */

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

/** Pass a string through; join an array of strings into a single "A vs B" label. */
function joinItems(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (!Array.isArray(value)) return undefined;
  const parts = value.filter(
    (item): item is string => typeof item === 'string' && item.trim() !== '',
  );
  return parts.length ? parts.join(' vs ') : undefined;
}

/** Models commonly return `keyComparisons[].items` as a list of the compared things. */
export function normalizeSummary(raw: unknown): unknown {
  const value = record(raw);
  if (!value || !Array.isArray(value.keyComparisons)) return raw;
  const keyComparisons = value.keyComparisons.map((item) => {
    const entry = record(item);
    if (!entry) return item;
    const items = joinItems(entry.items);
    return items === undefined ? item : { ...entry, items };
  });
  return { ...value, keyComparisons };
}

/** Move the correct option to a rotating position, preserving the option set and answer. */
function redistributeOptions(
  question: Record<string, unknown>,
  index: number,
): Record<string, unknown> {
  const options = question.options;
  const correctIndex = question.correctIndex;
  if (
    !Array.isArray(options) ||
    options.length !== 4 ||
    typeof correctIndex !== 'number' ||
    !Number.isInteger(correctIndex) ||
    correctIndex < 0 ||
    correctIndex >= 4
  )
    return question;
  const correct = options[correctIndex];
  const rest = options.filter((_, position) => position !== correctIndex);
  const position = index % 4;
  const next = [...rest];
  next.splice(position, 0, correct);
  return { ...question, options: next, correctIndex: position };
}

/** Models often leave every correct answer in the same option position; spread them out. */
export function normalizeQuiz(raw: unknown): unknown {
  const value = record(raw);
  if (!value || !Array.isArray(value.questions) || value.questions.length < 4) return raw;
  const positions = new Set(
    value.questions
      .map((item) => record(item)?.correctIndex)
      .filter((position): position is number => typeof position === 'number'),
  );
  if (positions.size >= 2) return raw;
  const questions = value.questions.map((item, index) => {
    const question = record(item);
    return question ? redistributeOptions(question, index) : item;
  });
  return { ...value, questions };
}

/** Truncate an oversized string to the schema limit; pass anything else through. */
function truncateText(value: unknown, max: number): unknown {
  return typeof value === 'string' && value.length > max ? value.slice(0, max) : value;
}

/**
 * Clamp sections to their schema limits. Models frequently over-produce key topics
 * or run a title/objective long; dropping the overflow is safe and keeps generation
 * from failing per chapter.
 */
export function normalizeSections(raw: unknown): unknown {
  const value = record(raw);
  if (!value) return raw;
  const next: Record<string, unknown> = { ...value };
  next.notes = truncateText(next.notes, 1000);
  if (Array.isArray(next.sections))
    next.sections = next.sections.map((item) => {
      const section = record(item);
      if (!section) return item;
      const fixed: Record<string, unknown> = { ...section };
      fixed.title = truncateText(fixed.title, 160);
      fixed.objective = truncateText(fixed.objective, 300);
      if (Array.isArray(fixed.keyTopics))
        fixed.keyTopics = fixed.keyTopics.map((topic) => truncateText(topic, 80)).slice(0, 10);
      return fixed;
    });
  return next;
}

/** Clamp outline chapters and notes to their schema limits. */
export function normalizeOutline(raw: unknown): unknown {
  const value = record(raw);
  if (!value) return raw;
  const next: Record<string, unknown> = { ...value };
  next.notes = truncateText(next.notes, 1500);
  if (Array.isArray(next.chapters))
    next.chapters = next.chapters.map((item) => {
      const chapter = record(item);
      if (!chapter) return item;
      const fixed: Record<string, unknown> = { ...chapter };
      fixed.title = truncateText(fixed.title, 160);
      fixed.description = truncateText(fixed.description, 400);
      if (Array.isArray(fixed.examFocus))
        fixed.examFocus = fixed.examFocus
          .map((focus) => truncateText(focus, 240))
          .slice(0, 6);
      return fixed;
    });
  return next;
}

export function normalizeArtifact(kind: ArtifactKind, raw: unknown): unknown {
  if (kind === 'summary') return normalizeSummary(raw);
  if (kind === 'quiz') return normalizeQuiz(raw);
  if (kind === 'sections') return normalizeSections(raw);
  if (kind === 'outline') return normalizeOutline(raw);
  return raw;
}
