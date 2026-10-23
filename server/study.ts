import { fsrs, type Card, type Grade } from 'ts-fsrs';
import type { ScheduleCard, Section, StudyPlan } from '../shared/models';

export function serializeCard(card: Card): ScheduleCard {
  return { ...card, due: card.due.toISOString(), last_review: card.last_review?.toISOString() };
}

export function reviewCard(card: ScheduleCard, rating: number, now = new Date()): ScheduleCard {
  if (![1, 2, 3, 4].includes(rating)) throw new Error('Invalid review rating.');
  const current = { ...card, due: new Date(card.due), last_review: card.last_review ? new Date(card.last_review) : undefined };
  const next = fsrs({ enable_fuzz: false }).next(current, now, rating as Grade);
  return serializeCard(next.card);
}

export function dateKey(date: Date): string { return date.toISOString().slice(0, 10); }

export function createPlan(sections: Section[], examDate: string, dailyMinutes: number, now = new Date()): StudyPlan {
  const today = new Date(`${dateKey(now)}T00:00:00Z`);
  const exam = new Date(`${examDate}T00:00:00Z`);
  const daysAvailable = Math.ceil((exam.getTime() - today.getTime()) / 86400000);
  if (!Number.isFinite(daysAvailable) || daysAvailable < 1 || daysAvailable > 730) throw new Error('Choose an exam date between tomorrow and two years from today.');
  const pending = sections.filter(section => !section.read);
  const reviewMinutes = Math.max(5, Math.round(dailyMinutes * 0.25));
  const slots = Math.max(1, Math.floor((dailyMinutes - reviewMinutes) / 15));
  const overloaded = pending.length > slots * daysAvailable;
  const assignedPerDay = Math.max(slots, Math.ceil(pending.length / daysAvailable));
  const days: StudyPlan['days'] = [];
  for (let index = 0; index < daysAvailable; index++) {
    const date = new Date(today.getTime() + index * 86400000);
    const sectionIds = pending.slice(index * assignedPerDay, (index + 1) * assignedPerDay).map(section => section.id);
    days.push({ date: dateKey(date), sectionIds, reviewMinutes, studyMinutes: sectionIds.length * 15 });
  }
  return { examDate, dailyMinutes, createdAt: now.toISOString(), days, warning: overloaded ? 'This schedule exceeds your daily budget. Increase your time or move the exam date. Each section budgets 15 minutes plus daily review.' : undefined };
}