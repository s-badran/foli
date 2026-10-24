import type { Chapter, Learner, Section, StudyState } from './models';

export function baselinePolicy(familiarity: Learner['familiarity'] = 'new') {
  if (familiarity === 'refresh')
    return {
      initialTab: 'quiz' as const,
      lessonMinutes: 10,
      reviewFraction: 0.45,
      label: 'Quiz first, then repair weak topics',
    };
  if (familiarity === 'basic')
    return {
      initialTab: 'cards' as const,
      lessonMinutes: 15,
      reviewFraction: 0.35,
      label: 'Recall first, then targeted reading',
    };
  return {
    initialTab: 'summary' as const,
    lessonMinutes: 25,
    reviewFraction: 0.25,
    label: 'Read first, then recall and apply',
  };
}

export function sectionPractice(section: Section, state: Pick<StudyState, 'reviews' | 'attempts'>) {
  const cards = section.content?.cards ?? [];
  const quiz = section.content?.quiz ?? [];
  const successfulCards = cards.filter((card) => {
    const latest = state.reviews
      .filter((review) => review.cardId === card.id && review.sectionId === section.id)
      .at(-1);
    return latest !== undefined && latest.rating >= 3;
  });
  const latestAttempt = state.attempts.filter((attempt) => attempt.sectionId === section.id).at(-1);
  const correctQuestions = quiz.filter(
    (question, index) => latestAttempt?.answers[index] === question.correctIndex,
  );
  return {
    cards,
    quiz,
    successfulCards,
    correctQuestions,
    latestAttempt,
    complete:
      cards.length > 0 &&
      quiz.length > 0 &&
      successfulCards.length === cards.length &&
      correctQuestions.length === quiz.length,
  };
}

export function chapterPreparation(
  chapter: Chapter,
  allSections: Section[],
  state: Pick<StudyState, 'reviews' | 'attempts'>,
) {
  const sections = allSections.filter(
    (section) => section.chapterId === chapter.id && !section.archived,
  );
  const objectives = chapter.objectives ?? [];
  const cards = sections.flatMap((section) => section.content?.cards ?? []);
  const questions = sections.flatMap((section) => section.content?.quiz ?? []);
  const practice = sections.map((section) => sectionPractice(section, state));
  const coverage = objectives.map((objective) => {
    const needsRecall = objective.assessment !== 'application';
    const needsApplication = objective.assessment !== 'recall';
    const recallCovered = cards.some((card) => card.objectiveIds?.includes(objective.id));
    const applicationCovered = questions.some((question) =>
      question.objectiveIds?.includes(objective.id),
    );
    const recalled = practice.some((item) =>
      item.successfulCards.some((card) => card.objectiveIds?.includes(objective.id)),
    );
    const applied = practice.some((item) =>
      item.correctQuestions.some((question) => question.objectiveIds?.includes(objective.id)),
    );
    const covered = (!needsRecall || recallCovered) && (!needsApplication || applicationCovered);
    return {
      ...objective,
      recallCovered,
      applicationCovered,
      recalled,
      applied,
      covered,
      demonstrated: covered && (!needsRecall || recalled) && (!needsApplication || applied),
    };
  });
  const audited = chapter.coverageStatus === 'source-audited' && objectives.length > 0;
  const covered = coverage.filter((objective) => objective.covered).length;
  const demonstrated = coverage.filter((objective) => objective.demonstrated).length;
  const allPracticePassed = practice.length > 0 && practice.every((item) => item.complete);
  return {
    objectives: coverage,
    audited,
    covered,
    demonstrated,
    total: objectives.length,
    coveragePercent: objectives.length ? Math.round((covered / objectives.length) * 100) : 0,
    practicePercent: objectives.length ? Math.round((demonstrated / objectives.length) * 100) : 0,
    complete:
      audited &&
      covered === objectives.length &&
      demonstrated === objectives.length &&
      allPracticePassed,
    allPracticePassed,
  };
}
