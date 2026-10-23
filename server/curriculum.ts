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
import { awsChapters, type TutorLesson } from './tutor/aws';

export const AWS_SLIDES_HASH = 'e95a915c20193e621e3773fefb98b4ad4bae53a8477fea0b9f07d7b552d5c06b';

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
): GeneratedContent {
  const correct = index % 4;
  const options = [...lesson.options];
  const answer = options.shift()!;
  options.splice(correct, 0, answer);
  const content = contentSchema.parse({
    summary: `## ${lesson.title}\n\n${lesson.rule}\n\n### Reasoning and trade-offs\n\n${lesson.reasoning}\n\n### Avoid this trap\n\n${lesson.trap}\n\n### Apply it\n\n${lesson.scenario}\n\n**Recommended design:** ${answer}\n\n${lesson.explanation}`,
    keyPoints: [lesson.rule, lesson.reasoning, lesson.trap],
    supplement:
      'Tutor-authored explanation using architectural knowledge alongside the cited main-source chapter. These are original practice questions, not official AWS exam questions. Supplementary reading is listed separately; vocabulary overlap does not establish factual agreement.',
    cards: [
      { question: lesson.recall, answer: `${lesson.rule} ${lesson.reasoning}` },
      { question: lesson.contrast, answer: lesson.trap },
    ],
    quiz: [
      {
        question: lesson.scenario,
        options,
        correctIndex: correct,
        explanation: lesson.explanation,
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
    model: 'Tutor-authored AWS SAA-C03 v1',
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
  folder.plan = undefined;
  const curated = main.contentHash === AWS_SLIDES_HASH;
  let inferredChapter = 'Source introduction';
  const definitions = curated
    ? awsChapters
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
      ? (definition.pageEnd ?? (awsChapters[index + 1]?.pageStart ?? 880) - 1)
      : main.kind === 'pdf'
        ? (definitions[index + 1]?.pageStart ?? (main.pages ?? raw.at(-1)?.pageEnd ?? 1) + 1) - 1
        : definition.pageEnd;
    state.chapters.push({
      id: chapterId,
      folderId: folder.id,
      title: definition.title,
      order: index + 1,
      sourceId: main.id,
      pageStart: definition.pageStart,
      pageEnd,
      description: definition.description,
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
          pageStart: definition.pageStart,
          pageEnd,
          read: false,
          content: tutorContent(
            lesson,
            main,
            definition.pageStart!,
            pageEnd!,
            extra,
            index * 2 + lessonIndex,
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
    ? '28 tutor-curated chapters follow verified divider pages in the main slide deck. Each chapter has two original lessons with scenario questions and architectural trade-offs.'
    : 'Source-based outline only. No generic fill-in-the-blank practice is generated. Tutor-authored materials are currently available only for the supplied AWS slide deck.';
}
