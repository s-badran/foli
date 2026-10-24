import { randomUUID } from 'node:crypto';
import { createEmptyCard } from 'ts-fsrs';
import {
  contentSchema,
  type Folder,
  type GeneratedContent,
  type Section,
  type Source,
  type StudyState,
} from '../shared/models';
import { serializeCard } from './study';
import { assessRelevance, terms } from './relevance';
import type { TutorLesson } from './tutor/aws';
import { findTutorPack } from './tutor/catalog';
export { AWS_SLIDES_HASH } from './tutor/catalog';

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
          note: 'Related supplementary reading selected by topic overlap; not a claim that this source verifies every tutor statement.',
        },
      ];
    });
}

export function refreshSupplementLinks(state: StudyState, folder: Folder) {
  for (const chapter of state.chapters.filter((item) => item.folderId === folder.id)) {
    const extra = supplementEvidence(
      state,
      folder,
      terms(`${chapter.title} ${chapter.description}`),
    );
    for (const section of state.sections.filter(
      (item) =>
        item.chapterId === chapter.id &&
        !item.archived &&
        item.content?.authorship === 'tutor-authored',
    )) {
      section.content!.evidence = [
        ...(section.content!.evidence ?? []).filter(
          (item) => item.sourceId === folder.mainSourceId,
        ),
        ...extra,
      ];
    }
  }
}

function tutorContent(
  lesson: TutorLesson,
  source: Source,
  start: number,
  end: number,
  extra: NonNullable<GeneratedContent['evidence']>,
  index: number,
  objectiveId: string,
  label: string,
): GeneratedContent {
  if (
    lesson.cards.length < 2 ||
    lesson.cards.some(
      (card) => card.question.split(/\s+/).length > 30 || card.answer.split(/\s+/).length > 40,
    )
  )
    throw new Error(`Author concise single-target flashcards before publishing: ${lesson.title}`);
  const correct = index % 4;
  const options = [...lesson.options];
  const answer = options.shift()!;
  options.splice(correct, 0, answer);
  const content = contentSchema.parse({
    summary: `## ${lesson.title}\n\n${lesson.rule}\n\n### Reasoning and trade-offs\n\n${lesson.reasoning}\n\n### Avoid this trap\n\n${lesson.trap}\n\n### Apply it\n\n${lesson.scenario}\n\n**Recommended design:** ${answer}\n\n${lesson.explanation}`,
    keyPoints: [lesson.rule, lesson.reasoning, lesson.trap],
    supplement:
      'Tutor-authored explanation using architectural knowledge alongside the cited main-source chapter. These are original practice questions, not official AWS exam questions. Supplementary reading is listed separately; vocabulary overlap does not establish factual agreement.',
    cards: lesson.cards.map((card) => ({ ...card, objectiveIds: [objectiveId] })),
    quiz: [
      {
        question: lesson.scenario,
        options,
        correctIndex: correct,
        explanation: lesson.explanation,
        objectiveIds: [objectiveId],
      },
    ],
  });
  return {
    ...content,
    cards: content.cards.map((card) => ({
      ...card,
      id: randomUUID(),
      schedule: serializeCard(createEmptyCard()),
    })),
    provider: 'offline',
    model: label,
    authorship: 'tutor-authored',
    generatedAt: new Date().toISOString(),
    evidence: [
      {
        sourceId: source.id,
        pageStart: start,
        pageEnd: end,
        note: 'Verified chapter page range in the supplied main PDF. The explanation and scenarios are tutor-authored, not source quotations.',
      },
      ...extra,
    ],
  };
}

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
  folder.materialsVersion = 2;
  folder.plan = undefined;
  const pack = findTutorPack(main.contentHash);
  const curated = pack !== undefined;
  let inferredChapter = 'Source introduction';
  const definitions = curated
    ? pack.chapters
    : raw
        .map((section, index) => {
          const explicit = section.text
            .match(/^(?:Chapter|Domain|Part)\s+\d+\s*[:.-]?[^\n]{0,100}/im)?.[0]
            ?.trim();
          if (explicit) inferredChapter = explicit;
          const title =
            section.chapterTitle ?? (main.kind === 'pdf' ? inferredChapter : section.title);
          return {
            title,
            pageStart: section.pageStart,
            pageEnd: section.pageEnd,
            description:
              'Source heading or domain boundary. Tutor practice has not been authored for this source.',
            lessons: [] as TutorLesson[],
            raw: section,
            order: index,
          };
        })
        .filter(
          (definition, index, all) =>
            all.findIndex((item) => item.title === definition.title) === index,
        );
  for (const [index, definition] of definitions.entries()) {
    const chapterId = randomUUID();
    const pageEnd = curated
      ? (definition.pageEnd ??
        (pack.chapters[index + 1]?.pageStart ?? (main.pages ?? raw.at(-1)?.pageEnd ?? 1) + 1) - 1)
      : main.kind === 'pdf'
        ? (definitions[index + 1]?.pageStart ?? (main.pages ?? raw.at(-1)?.pageEnd ?? 1) + 1) - 1
        : definition.pageEnd;
    const objectiveDefinitions =
      pack?.chapters[index].objectives ??
      definition.lessons.map((lesson) => ({
        key: lesson.objectiveKey ?? lesson.title,
        title: lesson.title,
        pageStart: definition.pageStart,
        pageEnd,
      }));
    const objectives = objectiveDefinitions.map((item) => ({
      id: `${chapterId}/${item.key}`,
      title: item.title,
      sourceId: main.id,
      pageStart: item.pageStart,
      pageEnd: item.pageEnd,
      assessment: 'both' as const,
    }));
    state.chapters.push({
      id: chapterId,
      folderId: folder.id,
      title: definition.title,
      order: index + 1,
      sourceId: main.id,
      pageStart: definition.pageStart,
      pageEnd,
      description: definition.description,
      objectives,
      coverageStatus: pack?.chapters[index].coverageStatus ?? 'draft',
    });
    const chapterText = raw
      .filter((section) =>
        definition.pageStart
          ? (section.pageEnd ?? 0) >= definition.pageStart &&
            (section.pageStart ?? 0) <= (pageEnd ?? 0)
          : section.title === definition.title,
      )
      .map((section) => section.text)
      .join('\n');
    if (curated) {
      const extra = supplementEvidence(
        state,
        folder,
        terms(`${definition.title} ${definition.description}`),
      );
      for (const [lessonIndex, lesson] of definition.lessons.entries())
        state.sections.push({
          id: randomUUID(),
          folderId: folder.id,
          sourceId: main.id,
          chapterId,
          title: lesson.title,
          objective: lesson.recall,
          text: chapterText,
          pageStart: lesson.pages?.[0] ?? definition.pageStart,
          pageEnd: lesson.pages?.[1] ?? pageEnd,
          read: false,
          content: tutorContent(
            lesson,
            main,
            lesson.pages?.[0] ?? definition.pageStart!,
            lesson.pages?.[1] ?? pageEnd!,
            extra,
            index * 2 + lessonIndex,
            `${chapterId}/${lesson.objectiveKey ?? lesson.title}`,
            pack.label,
          ),
        });
    } else {
      const original = 'raw' in definition ? (definition.raw as Section) : raw[index];
      const matching = raw.filter((item) =>
        item.chapterTitle
          ? item.chapterTitle === definition.title
          : main.kind !== 'pdf'
            ? item.id === original.id
            : (item.pageStart ?? 0) >= (definition.pageStart ?? 0) &&
              (item.pageStart ?? 0) <
                (definitions[index + 1]?.pageStart ?? Number.MAX_SAFE_INTEGER),
      );
      for (const item of matching.length ? matching : [original])
        state.sections.push({
          ...item,
          id: randomUUID(),
          chapterId,
          archived: false,
          sourceFragment: false,
          read: false,
          content: undefined,
        });
    }
  }
  folder.curriculumNote = curated
    ? `${definitions.length} source-mapped chapters. Topic counts follow authored coverage, not a fixed lessons-per-chapter quota. Draft chapter inventories are not yet source-audited and cannot count as fully prepared.`
    : 'Source-based outline only. Its topic inventory and assessments need authoring and source audit before preparation can be claimed.';
}
