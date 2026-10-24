import { describe, expect, it } from 'vitest';
import { emptyState, type Section } from '../shared/models';
import { orderedSections, sectionNumber } from '../shared/sections';

function section(id: string, pageStart: number, archived = false): Section {
  return {
    id,
    folderId: 'exam',
    sourceId: 'main',
    chapterId: 'ch3',
    title: `Section ${id}`,
    text: '',
    pageStart,
    pageEnd: pageStart,
    read: false,
    archived,
  };
}

describe('sectionNumber', () => {
  it('numbers sections by chapter order and page position, skipping archived ones', () => {
    const state = emptyState();
    state.chapters.push({ id: 'ch3', folderId: 'exam', order: 3 } as never);
    state.sections.push(
      section('b', 50),
      section('a', 40),
      section('old', 45, true),
    );
    expect(orderedSections(state, 'ch3').map((item) => item.id)).toEqual(['a', 'b']);
    expect(sectionNumber(state, section('a', 40))).toBe('3.1');
    expect(sectionNumber(state, section('b', 50))).toBe('3.2');
  });
});
