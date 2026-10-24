import { fsrs, type Card, type Grade } from 'ts-fsrs';
import type {
  Folder,
  Learner,
  ScheduleCard,
  Section,
  StudyPlan,
  StudyState,
} from '../shared/models';
import { baselinePolicy, sectionPractice } from '../shared/learning';

export function serializeCard(card: Card): ScheduleCard {
  return { ...card, due: card.due.toISOString(), last_review: card.last_review?.toISOString() };
}

export function reviewCard(card: ScheduleCard, rating: number, now = new Date()): ScheduleCard {
  if (![1, 2, 3, 4].includes(rating)) throw new Error('Invalid review rating.');
  const current = {
    ...card,
    due: new Date(card.due),
    last_review: card.last_review ? new Date(card.last_review) : undefined,
  };
  const next = fsrs({ enable_fuzz: false }).next(current, now, rating as Grade);
  return serializeCard(next.card);
}

export function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function createPlan(
  sections: Section[],
  examDate: string,
  dailyMinutes: number,
  now = new Date(),
  learner?: Learner,
  evidence: Pick<StudyState, 'reviews' | 'attempts'> = { reviews: [], attempts: [] },
): StudyPlan {
  const today = new Date(`${dateKey(now)}T00:00:00Z`);
  const exam = new Date(`${examDate}T00:00:00Z`);
  const daysAvailable = Math.ceil((exam.getTime() - today.getTime()) / 86400000);
  if (
    !Number.isFinite(daysAvailable) ||
    dateKey(exam) !== examDate ||
    daysAvailable < 1 ||
    daysAvailable > 730
  )
    throw new Error('Choose an exam date between tomorrow and two years from today.');
  const pending = sections.filter(
    (section) => !section.archived && !sectionPractice(section, evidence).complete,
  );
  const policy = baselinePolicy(learner?.familiarity);
  const sectionMinutes = policy.lessonMinutes;
  const reviewMinutes = Math.max(5, Math.round(dailyMinutes * policy.reviewFraction));
  const slots = Math.max(1, Math.floor((dailyMinutes - reviewMinutes) / sectionMinutes));
  const learningDays = Math.max(1, Math.floor(daysAvailable * 0.8));
  const overloaded =
    pending.length > slots * learningDays || sectionMinutes + reviewMinutes > dailyMinutes;
  const assignments = new Map<number, string[]>();
  for (const [index, section] of pending.entries()) {
    const day = Math.floor((index * learningDays) / pending.length);
    assignments.set(day, [...(assignments.get(day) ?? []), section.id]);
  }
  const days: StudyPlan['days'] = [];
  for (let index = 0; index < daysAvailable; index++) {
    const date = new Date(today.getTime() + index * 86400000);
    const sectionIds = assignments.get(index) ?? [];
    days.push({
      date: dateKey(date),
      sectionIds,
      reviewMinutes,
      studyMinutes: sectionIds.length * sectionMinutes,
    });
  }
  return {
    examDate,
    dailyMinutes,
    createdAt: now.toISOString(),
    familiarity: learner?.familiarity,
    days,
    warning: overloaded
      ? `This schedule exceeds your daily budget. Increase your time or move the exam date. Each lesson budgets ${sectionMinutes} minutes plus daily review.`
      : undefined,
  };
}

export function replanExam(state: StudyState, folder: Folder, now = new Date()) {
  if (!folder.plan) return;
  const previous = folder.plan;
  const sections = state.sections.filter(
    (section) => section.folderId === folder.id && !section.archived,
  );
  if (previous.examDate <= dateKey(now)) {
    previous.warning =
      'The exam date has passed or is today. Choose a future date to rebuild the plan; preparation is not complete just because time ran out.';
    return;
  }
  folder.plan = createPlan(
    sections,
    previous.examDate,
    previous.dailyMinutes,
    now,
    folder.learner,
    state,
  );
  const chapters = state.chapters.filter((chapter) => chapter.folderId === folder.id);
  folder.plan.chapterIds = chapters.map((chapter) => chapter.id);
  if (chapters.some((chapter) => chapter.coverageStatus !== 'source-audited'))
    folder.plan.warning = [
      folder.plan.warning,
      'Some chapter topic inventories are not source-audited. Finishing their current practice cannot establish full chapter coverage.',
    ]
      .filter(Boolean)
      .join(' ');
}
