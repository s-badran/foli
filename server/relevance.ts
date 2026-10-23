import type { Source } from '../shared/models';

const stop = new Set(
  'about after again also another before being between both chapter could data does each exam example file first from have into know learn main more most need notes only other over page part preparation question section should some source study such than that their them then there these they this those through time topic under used user using very want well were what when where which while will with would your information system application service content guide material introduction overview'.split(
    ' ',
  ),
);

export function terms(text: string): string[] {
  return (text.toLowerCase().match(/[a-z][a-z0-9-]{2,}/g) ?? [])
    .map((word) => word.replace(/s$/, ''))
    .filter((word) => !stop.has(word) && !stop.has(`${word}s`));
}

export function assessRelevance(main: string, incoming: string): NonNullable<Source['relevance']> {
  function vocabulary(text: string, limit: number) {
    const counts = new Map<string, number>();
    for (const term of terms(text)) counts.set(term, (counts.get(term) ?? 0) + 1);
    return new Set(
      [...counts]
        .sort((left, right) => right[1] - left[1])
        .slice(0, limit)
        .map(([term]) => term),
    );
  }
  const reference = vocabulary(main, 600);
  const candidate = vocabulary(incoming, 180);
  const shared = [...candidate].filter((term) => reference.has(term));
  const score = candidate.size ? shared.length / candidate.size : 0;
  const threshold = 0.16;
  const accepted = score >= threshold && shared.length >= Math.min(3, candidate.size);
  return {
    score: Math.round(score * 1000) / 1000,
    threshold,
    status: accepted ? 'accepted' : 'needs-review',
    method: 'Distinctive vocabulary containment v1 (heuristic, not semantic certainty)',
    sharedTerms: shared.slice(0, 12),
    reason: accepted
      ? 'Shared topic vocabulary found. This is a relevance signal, not proof of factual agreement.'
      : 'Insufficient shared topic vocabulary. Excluded from curriculum context until you explicitly review it.',
  };
}
