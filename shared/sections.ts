import type { Section, StudyState } from './models';

/** Active sections of a chapter, ordered by their source page range. */
export function orderedSections(state: StudyState, chapterId: string): Section[] {
  return state.sections
    .filter((item) => item.chapterId === chapterId && !item.archived)
    .sort((a, b) => (a.pageStart ?? 0) - (b.pageStart ?? 0));
}

/** A stable human label like "3.2": chapter order, then the section's position. */
export function sectionNumber(state: StudyState, section: Section): string {
  const chapterId = section.chapterId ?? '';
  const chapter = state.chapters.find((item) => item.id === chapterId);
  const order = chapter?.order ?? 0;
  const index = orderedSections(state, chapterId).findIndex((item) => item.id === section.id);
  return `${order}.${index + 1}`;
}
