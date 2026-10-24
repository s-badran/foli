import { describe, expect, it } from 'vitest';
import { emptyState } from '../shared/models';
import { assessRelevance } from '../server/relevance';
import { AWS_SLIDES_HASH, buildCurriculum, refreshRelevance } from '../server/curriculum';
import { awsChapters } from '../server/tutor/aws';
import { chapterPreparation } from '../shared/learning';

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
  it('provides complete original AWS practice without cloze filler', () => {
    const state = emptyState();
    const folder = { id: 'aws', name: 'AWS', createdAt: '', mainSourceId: 'slides' };
    state.folders.push(folder);
    state.sources.push({
      id: 'slides',
      folderId: 'aws',
      name: 'slides.pdf',
      kind: 'pdf',
      addedAt: '',
      contentHash: AWS_SLIDES_HASH,
    });
    state.sections.push({
      id: 'raw',
      folderId: 'aws',
      sourceId: 'slides',
      title: 'Source',
      text: 'Source fixture',
      pageStart: 1,
      pageEnd: 879,
      read: false,
    });
    buildCurriculum(state, folder);
    const active = state.sections.filter((section) => !section.archived);
    expect(state.chapters).toHaveLength(28);
    expect(active).toHaveLength(
      awsChapters.reduce((count, chapter) => count + chapter.lessons.length, 0),
    );
    const cards = active.flatMap((section) => section.content!.cards);
    expect(cards.length).toBeGreaterThan(active.length * 2);
    expect(
      cards.every(
        (card) => card.question.split(/\s+/).length <= 30 && card.answer.split(/\s+/).length <= 40,
      ),
    ).toBe(true);
    expect(active.flatMap((section) => section.content!.quiz)).toHaveLength(active.length);
    const coverage = chapterPreparation(state.chapters[0], state.sections, state);
    expect(coverage.total).toBe(9);
    expect(coverage.covered).toBe(9);
    expect(coverage.audited).toBe(true);
    expect(state.chapters.slice(1).every((chapter) => chapter.coverageStatus === 'draft')).toBe(
      true,
    );
    expect(active.every((section) => section.content?.authorship === 'tutor-authored')).toBe(true);
    expect(
      active
        .flatMap((section) => section.content!.cards)
        .every((card) => !card.question.includes('_____')),
    ).toBe(true);
  });
});
