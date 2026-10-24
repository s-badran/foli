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

export function normalizeArtifact(kind: ArtifactKind, raw: unknown): unknown {
  if (kind === 'summary') return normalizeSummary(raw);
  return raw;
}
