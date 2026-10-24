import { randomUUID } from 'node:crypto';
import type { Folder, Section, StudyState } from '../shared/models';
import { assessRelevance, terms } from './relevance';

function sourceFragments(state: StudyState, sourceId: string) {
  const raw = state.sections.filter(
    (section) => section.sourceId === sourceId && !section.chapterId,
  );
  return raw.some((section) => section.sourceFragment)
    ? raw.filter((section) => section.sourceFragment)
    : raw;
}

export function sourceText(state: StudyState, sourceId: string) {
  return sourceFragments(state, sourceId)
    .map((section) => section.text)
    .join('\n');
}

export function refreshRelevance(state: StudyState, folder: Folder) {
  const main = sourceText(state, folder.mainSourceId ?? '');
  for (const source of state.sources.filter((item) => item.folderId === folder.id)) {
    if (source.id !== folder.mainSourceId && source.relevance?.method === 'Learner review override')
      continue;
    source.relevance =
      source.id === folder.mainSourceId
        ? {
            score: 1,
            threshold: 0.16,
            status: 'accepted',
            method: 'Selected main source',
            sharedTerms: [],
            reason: 'The selected main source defines the exam curriculum.',
          }
        : assessRelevance(main, sourceText(state, source.id));
  }
}

function supplementEvidence(state: StudyState, folder: Folder, keywords: string[]) {
  return state.sources
    .filter(
      (source) =>
        source.folderId === folder.id &&
        source.id !== folder.mainSourceId &&
        source.relevance?.status === 'accepted',
    )
    .flatMap((source) => {
      const matches = state.sections.filter(
        (section) =>
          section.sourceId === source.id &&
          !section.chapterId &&
          keywords.filter((term) => new Set(terms(section.text)).has(term)).length >= 2,
      );
      if (!matches.length) return [];
      const sample = matches.slice(0, 2);
      return [
        {
          sourceId: source.id,
          pageStart: sample[0].pageStart,
          pageEnd: sample.at(-1)?.pageEnd,
          note: 'Related supplementary reading selected by topic overlap; not a claim that this source verifies every statement.',
        },
      ];
    });
}

export function refreshSupplementLinks(state: StudyState, folder: Folder) {
  for (const section of state.sections.filter(
    (item) => item.folderId === folder.id && item.chapterId && !item.archived && item.content,
  )) {
    const extra = supplementEvidence(
      state,
      folder,
      terms(`${section.title} ${(section.keyTopics ?? []).join(' ')}`),
    );
    section.content!.evidence = [
      ...(section.content!.evidence ?? []).filter((item) => item.sourceId === folder.mainSourceId),
      ...extra,
    ];
  }
}

/**
 * Provisional outline from explicit headings only, used until the outline request is answered.
 * Markdown/text keep heading-based sections; PDFs get chapters without sections.
 */
export function buildCurriculum(state: StudyState, folder: Folder) {
  const main = state.sources.find(
    (source) => source.id === folder.mainSourceId && source.folderId === folder.id,
  );
  if (!main) throw new Error('Choose a main source for this exam first.');
  const raw = sourceFragments(state, main.id);
  if (!raw.length) throw new Error('This source has no extracted text.');
  for (const section of state.sections.filter((section) => section.folderId === folder.id))
    section.archived = true;
  state.chapters = state.chapters.filter((chapter) => chapter.folderId !== folder.id);
  folder.curriculumRevision = (folder.curriculumRevision ?? 0) + 1;
  folder.outline = undefined;
  folder.plan = undefined;
  const groups: { title: string; items: Section[] }[] = [];
  let current = main.kind === 'pdf' ? 'Whole source' : 'Introduction';
  for (const section of raw) {
    const explicit = section.text
      .match(/^(?:Chapter|Domain|Part|Module)\s+\d+\s*[:.-]?[^\n]{0,100}/im)?.[0]
      ?.trim();
    const title =
      section.chapterTitle ?? explicit ?? (main.kind === 'pdf' ? current : section.title);
    current = title;
    const group = groups.at(-1);
    if (group?.title === title) group.items.push(section);
    else groups.push({ title, items: [section] });
  }
  for (const [index, group] of groups.entries()) {
    const chapterId = randomUUID();
    const pageStart = group.items[0].pageStart;
    const pageEnd = group.items.at(-1)?.pageEnd ?? pageStart;
    state.chapters.push({
      id: chapterId,
      folderId: folder.id,
      title: group.title,
      order: index + 1,
      sourceId: main.id,
      pageStart,
      pageEnd,
      description:
        'Provisional grouping from explicit headings. Generate the outline for a source-structured roadmap.',
      provisional: true,
      coverageStatus: 'draft',
      objectives: [],
    });
    if (main.kind === 'pdf') continue;
    for (const item of group.items)
      state.sections.push({
        ...item,
        id: randomUUID(),
        chapterId,
        keyTopics: [item.title],
        archived: false,
        sourceFragment: false,
        read: false,
        content: undefined,
      });
  }
  folder.curriculumNote = undefined;
}
