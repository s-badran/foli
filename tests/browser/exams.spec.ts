import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { Store } from '../../server/store';

const fixtureNames = [
  'AWS Certified Solutions Architect Slides v49.pdf',
  'solutions-architect-associate-03-Exam-Guide.pdf',
];
let pdfFixtures: { name: string; mimeType: string; buffer: Buffer }[];

test.describe.serial('exam workspaces', () => {
  test.beforeAll(async ({ request }) => {
    pdfFixtures = [];
    for (const name of fixtureNames) {
      let buffer: Buffer;
      try {
        buffer = await readFile(
          path.join(process.cwd(), 'AWS Certified Solutions Architect Associate', name),
        );
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
        const store = new Store(path.join(process.cwd(), 'data'));
        const saved = await store.read();
        const source = saved.sources.find((item) => item.name === name && item.file);
        const folder = saved.folders.find((item) => item.id === source?.folderId);
        if (!source?.file || !folder)
          throw new Error(
            `Missing local test PDF: ${name}. Supply the original source folder or retain an imported copy in data/.`,
          );
        buffer = await readFile(store.sourcePath(folder, source.file));
      }
      pdfFixtures.push({ name, mimeType: 'application/pdf', buffer });
    }
    const state = await (await request.get('/api/state')).json();
    for (const folder of state.folders) await request.delete(`/api/folders/${folder.id}`);
  });

  test('imports the AWS exam with onboarding and a chapter-first tutor curriculum', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Your exam workspaces' })).toBeVisible();
    await page.getByRole('button', { name: 'New workspace', exact: true }).click();
    await page
      .getByLabel('Exam name', { exact: true })
      .fill('AWS Certified Solutions Architect Associate');
    await page.getByLabel('First study source (optional)').setInputFiles(pdfFixtures);
    await page.getByLabel('How well do you know this content?').selectOption('basic');
    await page.getByLabel('Which best describes you?').selectOption('professional');
    await page.getByRole('button', { name: 'Create workspace', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Your chapter roadmap' })).toBeVisible();
    await expect(page.locator('details.chapter')).toHaveCount(28);
    await page.getByRole('textbox', { name: 'Search chapters and lessons' }).fill('VPC');
    await expect(page.locator('details.chapter')).toHaveCount(1);
    await page.getByRole('textbox', { name: 'Search chapters and lessons' }).fill('');
    const state = await (await page.request.get('/api/state')).json();
    expect(state.sources).toHaveLength(2);
    expect(state.chapters).toHaveLength(28);
    expect(
      state.sections.filter((section: { archived?: boolean }) => !section.archived),
    ).toHaveLength(63);
    const firstChapter = page.locator('details.chapter').first();
    await expect(firstChapter.locator('.coverage-topic')).toHaveCount(9);
    await expect(firstChapter).toContainText('Credential report and Access Advisor');
    await expect(page.locator('details.chapter').nth(1)).toContainText('Coverage audit pending');
    expect(state.folders[0].learner.familiarity).toBe('basic');
    await page.screenshot({
      path: '.cache/screenshots/exam-chapters-desktop.png',
      fullPage: false,
    });
    await page
      .locator('.breadcrumbs')
      .getByRole('link', { name: 'Workspaces', exact: true })
      .click();
    await expect(page.getByRole('heading', { name: 'Your exam workspaces' })).toBeVisible();
    await page
      .locator('.exam-tile')
      .filter({ hasText: 'AWS Certified Solutions Architect Associate' })
      .click();
    await expect(page.getByRole('heading', { name: 'Your chapter roadmap' })).toBeVisible();
  });

  test('studies architectural reasoning and retains quiz and card progress', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const state = await (await page.request.get('/api/state')).json();
    const folder = state.folders[0];
    await page.goto(`/#exam/${folder.id}/chapters`);
    await page.getByRole('button').filter({ hasText: 'IAM roles for services' }).click();
    await expect(page.locator('.reader-meta')).toContainText('Original tutor practice');
    await page.getByRole('tab', { name: 'Summary', exact: true }).click();
    await expect(page.locator('.markdown')).toContainText('instance profile');
    await expect(page.locator('.evidence-list')).toContainText('Slides v49.pdf');
    await page.getByRole('tab', { name: /Flashcards/ }).click();
    await expect(page.locator('.flashcard-text')).not.toContainText('_____');
    await page.getByRole('button', { name: 'Reveal answer', exact: true }).click();
    await expect(page.locator('.flashcard-text')).toContainText('temporary credentials');
    await page.getByRole('button', { name: 'Good', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Review saved' })).toBeVisible();
    await page.getByRole('tab', { name: /Quiz/ }).click();
    await expect(page.locator('.quiz-question').first()).toContainText('Lambda function');
    const questions = page.locator('.quiz-question');
    for (let index = 0; index < (await questions.count()); index++)
      await questions.nth(index).getByRole('radio').first().check();
    await page.getByRole('button', { name: 'Submit quiz' }).click();
    await expect(page.locator('.quiz-result')).toBeVisible();
    await expect(page.locator('.explanation').first()).toContainText('execution role');
    await page.getByRole('button', { name: 'Mark as read', exact: true }).click();
    await page.reload();
    await expect(page.getByRole('button', { name: 'Read', exact: true })).toBeVisible();
    await page.getByRole('tab', { name: 'Source', exact: true }).click();
    await expect(page.getByTitle('Original PDF')).toBeVisible();
    await page.getByRole('button', { name: 'All chapters', exact: true }).click();
    await expect(page.locator('.stats > div').first()).toContainText('0');
    await expect(page.locator('details.chapter').first()).toContainText('Practice needed');
    expect(errors).toEqual([]);
  });

  test('flags unrelated supplements and requires confirmation before changing the main PDF', async ({
    page,
  }) => {
    const state = await (await page.request.get('/api/state')).json();
    const folder = state.folders[0];
    await page.goto(`/#exam/${folder.id}/sources`);
    await page.getByRole('button', { name: 'Add sources', exact: true }).click();
    await page.locator('input[type=file]').setInputFiles({
      name: 'cooking.md',
      mimeType: 'text/markdown',
      buffer: Buffer.from(
        '# Cooking Italian food\nPasta dough uses flour, eggs and water. Simmer tomatoes with garlic and basil to prepare a sauce. Bake bread in a hot kitchen oven.',
      ),
    });
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Add sources', exact: true })
      .click();
    await expect(page.getByRole('alert')).toContainText('Insufficient shared topic vocabulary');
    const cooking = page.locator('.exam-source').filter({ hasText: 'cooking.md' });
    await expect(cooking).toContainText('Excluded from study context');
    await cooking.getByRole('button', { name: 'Review and accept' }).click();
    await page.getByRole('button', { name: 'Keep excluded', exact: true }).click();
    const guide = page.locator('.exam-source').filter({ hasText: 'Exam-Guide.pdf' });
    await guide.getByRole('button', { name: 'Make main source' }).click();
    await expect(page.getByRole('dialog')).toContainText('archived, not deleted');
    await page.getByRole('button', { name: 'Change and rebuild' }).click();
    await expect(page.getByRole('heading', { name: 'Your chapter roadmap' })).toBeVisible();
    const switched = await (await page.request.get('/api/state')).json();
    expect(switched.attempts).toHaveLength(1);
    expect(switched.reviews).toHaveLength(1);
    expect(
      switched.sections.some(
        (section: { archived?: boolean; content?: { authorship?: string } }) =>
          section.archived && section.content?.authorship === 'tutor-authored',
      ),
    ).toBe(true);
    const slides = switched.sources.find((source: { name: string }) =>
      source.name.includes('Slides'),
    );
    await page.request.put(`/api/folders/${folder.id}/main-source`, {
      data: { sourceId: slides.id, confirmRebuild: true },
    });
  });

  test('creates a workspace from an upload and saves its learner profile and tutor brief', async ({
    page,
  }) => {
    await page.goto('/#workspaces');
    await page.getByRole('button', { name: 'New workspace', exact: true }).click();
    await page.getByLabel('Exam name', { exact: true }).fill('Networking exam');
    await page.getByLabel('First study source (optional)').setInputFiles({
      name: 'networking.md',
      mimeType: 'text/markdown',
      buffer: Buffer.from(
        '# Routing\n## Routes\nA route table determines the path for IP packets through a virtual network.\n## Security\nSecurity groups control permitted connections to network interfaces.',
      ),
    });
    await page.getByLabel('How well do you know this content?').selectOption('refresh');
    await page.getByRole('button', { name: 'Create workspace', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Your chapter roadmap' })).toBeVisible();
    await expect(page.locator('details.chapter')).toHaveCount(1);
    await page.getByRole('button', { name: 'Exam settings', exact: true }).click();
    await page
      .getByLabel('Exam tutor brief')
      .fill('Emphasize packet paths, isolation boundaries and failure cases.');
    await page.getByRole('button', { name: 'Save exam settings' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Exam settings saved' })).toBeVisible();
    await page.reload();
    await expect(page.getByLabel('Exam tutor brief')).toHaveValue(
      'Emphasize packet paths, isolation boundaries and failure cases.',
    );
  });

  test('renders chapter plans and progress on mobile without overflow', async ({ page }) => {
    const state = await (await page.request.get('/api/state')).json();
    const folder = state.folders.find((item: { name: string }) => item.name.includes('AWS'));
    await page.goto(`/#exam/${folder.id}/plan`);
    await page.getByRole('button', { name: 'Create study plan', exact: true }).click();
    await page
      .getByLabel('Exam date', { exact: true })
      .fill(new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10));
    await page.getByRole('button', { name: 'Build study plan', exact: true }).click();
    await expect(page.locator('.plan-summary')).toBeVisible();
    await expect(page.locator('details.chapter')).toHaveCount(28);
    await page.setViewportSize({ width: 390, height: 844 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await page.screenshot({ path: '.cache/screenshots/exam-plan-mobile.png', fullPage: false });
    await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
    await page.getByRole('button', { name: 'Progress', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Your exam progress' })).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await page.screenshot({ path: '.cache/screenshots/exam-progress-mobile.png', fullPage: false });
  });

  test('baseline replans immediately, role stays contextual and assessments retain their IDs', async ({
    page,
  }) => {
    const before = await (await page.request.get('/api/state')).json();
    const folder = before.folders.find((item: { name: string }) => item.name.includes('AWS'));
    const contentBefore = JSON.stringify(
      before.sections
        .filter(
          (item: { folderId: string; archived?: boolean }) =>
            item.folderId === folder.id && !item.archived,
        )
        .map((item: { content: unknown }) => item.content),
    );
    await page.goto(`/#exam/${folder.id}/settings`);
    await page.getByLabel('How well do you know this content?').selectOption('new');
    await page.getByRole('button', { name: 'Save exam settings', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Exam settings saved' })).toBeVisible();
    await expect(page.locator('.baseline-impact')).toContainText('25 minutes per lesson');
    const after = await (await page.request.get('/api/state')).json();
    const newFolder = after.folders.find((item: { id: string }) => item.id === folder.id);
    expect(newFolder.plan.familiarity).toBe('new');
    expect(
      JSON.stringify(
        after.sections
          .filter(
            (item: { folderId: string; archived?: boolean }) =>
              item.folderId === folder.id && !item.archived,
          )
          .map((item: { content: unknown }) => item.content),
      ),
    ).toBe(contentBefore);
    await page.getByLabel('Which best describes you?').selectOption('student');
    await page.getByRole('button', { name: 'Save exam settings', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Exam settings saved' })).toBeVisible();
    const roleOnly = await (await page.request.get('/api/state')).json();
    expect(roleOnly.folders.find((item: { id: string }) => item.id === folder.id).plan).toEqual(
      newFolder.plan,
    );
    await page.getByRole('button', { name: 'Chapters', exact: false }).first().click();
    await page.locator('.lesson-row').first().click();
    await expect(page.getByRole('tab', { name: 'Summary', exact: true })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await page.screenshot({
      path: '.cache/screenshots/atomic-cards-and-source-topics.png',
      fullPage: false,
    });
  });
});
