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

/** Models occasionally dump a long essay into the optional `notes` field; clamp it. */
function truncateNotes(raw: unknown, max: number): unknown {
  const value = record(raw);
  if (!value) return raw;
  if (typeof value.notes === 'string' && value.notes.length > max)
    return { ...value, notes: value.notes.slice(0, max) };
  return value;
}

export function normalizeSections(raw: unknown): unknown {
  return truncateNotes(raw, 1000);
}

export function normalizeOutline(raw: unknown): unknown {
  return truncateNotes(raw, 1500);
}

export function normalizeArtifact(kind: ArtifactKind, raw: unknown): unknown {
  if (kind === 'summary') return normalizeSummary(raw);
  if (kind === 'quiz') return normalizeQuiz(raw);
  if (kind === 'sections') return normalizeSections(raw);
  if (kind === 'outline') return normalizeOutline(raw);
  return raw;
}
