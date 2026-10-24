import { describe, expect, it } from 'vitest';
import { emptyState } from '../shared/models';
import { assessRelevance } from '../server/relevance';
import { buildCurriculum, refreshRelevance } from '../server/curriculum';

describe('exam-scoped curriculum', () => {
  it('warns on unrelated documents rather than inventing a shared topic', () => {
    const main =
      'AWS networking VPC subnets route tables security groups EC2 IAM policies S3 encryption availability zones load balancers';
    expect(
      assessRelevance(
        main,
        'Italian cooking pasta tomato sauce baking dough garlic basil recipes nutrition kitchen',
      ).status,
    ).toBe('needs-review');
    expect(
      assessRelevance(
        main,
        'VPC networking subnets route tables security groups availability zones',
      ).status,
    ).toBe('accepted');
  });
  it('uses only the main source for the outline and archives old progress on rebuild', () => {
    const state = emptyState();
    const folder = { id: 'exam', name: 'Networks', createdAt: '', mainSourceId: 'main' };
    state.folders.push(folder);
    state.sources.push(
      { id: 'main', folderId: 'exam', name: 'networks.md', kind: 'md', addedAt: '' },
      { id: 'extra', folderId: 'exam', name: 'cookbook.md', kind: 'md', addedAt: '' },
    );
    state.sections.push(
      {
        id: 'one',
        folderId: 'exam',
        sourceId: 'main',
        title: 'Routing',
        text: 'VPC networking route tables subnets',
        read: true,
      },
      {
        id: 'two',
        folderId: 'exam',
        sourceId: 'extra',
        title: 'Pasta',
        text: 'Cooking pasta tomato garlic sauce',
        read: false,
      },
    );
    refreshRelevance(state, folder);
    buildCurriculum(state, folder);
    expect(state.chapters.map((chapter) => chapter.title)).toEqual(['Routing']);
    expect(state.sections.find((section) => section.id === 'one')?.read).toBe(true);
    expect(state.sections.find((section) => section.id === 'one')?.archived).toBe(true);
    expect(state.sections.filter((section) => !section.archived)).toHaveLength(1);
    expect(state.sources[1].relevance?.status).toBe('needs-review');
  });
  it('keeps a PDF provisional and section-free until the outline is generated', () => {
    const state = emptyState();
    const folder = { id: 'book', name: 'Circuits', createdAt: '', mainSourceId: 'pdf' };
    state.folders.push(folder);
    state.sources.push({
      id: 'pdf',
      folderId: 'book',
      name: 'circuits.pdf',
      kind: 'pdf',
      addedAt: '',
      pages: 3,
    });
    for (const page of [1, 2, 3])
      state.sections.push({
        id: `p${page}`,
        folderId: 'book',
        sourceId: 'pdf',
        title: `Page ${page}`,
        text:
          page === 2
            ? 'Chapter 1: Ohm law\nVoltage equals current times resistance.'
            : 'Resistors limit current.',
        pageStart: page,
        pageEnd: page,
        read: false,
        sourceFragment: true,
        archived: true,
      });
    buildCurriculum(state, folder);
    expect(state.chapters.every((chapter) => chapter.provisional)).toBe(true);
    expect(state.chapters.map((chapter) => chapter.title)).toEqual([
      'Whole source',
      'Chapter 1: Ohm law',
    ]);
    expect(state.sections.filter((section) => !section.archived)).toHaveLength(0);
    expect((folder as { outline?: unknown }).outline).toBeUndefined();
  });
});
