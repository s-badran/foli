import { expect, test } from '@playwright/test';

test.describe.serial('source-to-practice workspace', () => {
  test.beforeAll(async ({ request }) => {
    const state = await (await request.get('/api/state')).json();
    for (const folder of state.folders) await request.delete(`/api/folders/${folder.id}`);
  });

  test('imports both actual AWS PDFs and opens the original source', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /Import a study folder/ }).click();
    await page.getByRole('button', { name: /AWS Certified Solutions Architect Associate/ }).click();
    await expect(
      page.getByRole('status').filter({ hasText: 'Imported workspace sources' }),
    ).toBeVisible();
    const state = await (await page.request.get('/api/state')).json();
    expect(state.sources).toHaveLength(2);
    expect(state.sections).toHaveLength(109);
    expect(state.sections.every((section: { title: string }) => section.title !== 'Maarek')).toBe(
      true,
    );
    expect(state.sources.some((source: { pages: number }) => source.pages === 879)).toBe(true);
    await page.getByRole('button', { name: 'Sources 2', exact: true }).click();
    await page.screenshot({ path: '.cache/screenshots/aws-library-desktop.png', fullPage: false });
    const first = state.sections[0];
    await page.getByRole('button').filter({ hasText: first.title }).last().click();
    await page.getByRole('tab', { name: 'Source', exact: true }).click();
    await expect(page.getByTitle('Original PDF')).toBeVisible();
    const file = await page.request.get(`/api/sources/${state.sources[0].id}/file`);
    expect(file.headers()['content-type']).toContain('application/pdf');
    expect((await file.body()).subarray(0, 4).toString()).toBe('%PDF');
  });

  test('uploads notes, generates practice, reviews a card and completes a quiz', async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('/');
    await page.getByRole('button', { name: 'Create study folder', exact: true }).click();
    await page.getByLabel('Subject name').fill('Networking lab');
    await page.getByRole('button', { name: 'Create folder', exact: true }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await page.getByRole('button', { name: 'Add sources', exact: true }).first().click();
    await page.locator('input[type=file]').setInputFiles({
      name: 'networking.md',
      mimeType: 'text/markdown',
      buffer: Buffer.from(
        '# Network foundations\nA virtual private cloud isolates network resources in your account.\nAn availability zone contains discrete data centers with redundant power.\nAn IAM role provides temporary credentials to applications and services.\nA route table determines where network traffic is directed.',
      ),
    });
    await page.getByRole('button', { name: 'Import sources', exact: true }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await page.locator('.section-row').filter({ hasText: 'Network foundations' }).click();
    await page.getByRole('button', { name: 'Generate study pack' }).click();
    await expect(page.getByRole('heading', { name: 'Source highlights' })).toBeVisible();
    await page.screenshot({
      path: '.cache/screenshots/section-summary-desktop.png',
      fullPage: true,
    });
    await page.getByRole('tab', { name: /Flashcards/ }).click();
    await page.getByRole('button', { name: 'Reveal answer', exact: true }).click();
    await page.getByRole('button', { name: 'Good', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Review saved' })).toBeVisible();
    await page.getByRole('tab', { name: /Quiz/ }).click();
    const questions = page.locator('.quiz-question');
    const count = await questions.count();
    for (let index = 0; index < count; index++)
      await questions.nth(index).getByRole('radio').first().check();
    await page.getByRole('button', { name: 'Submit quiz' }).click();
    await expect(page.locator('.quiz-result')).toBeVisible();
    await expect(page.locator('.explanation')).toHaveCount(count);
    await page.getByRole('button', { name: 'Mark complete', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Completed', exact: true })).toBeVisible();
    const state = await (await page.request.get('/api/state')).json();
    expect(state.reviews).toHaveLength(1);
    expect(state.attempts).toHaveLength(1);
    expect(errors).toEqual([]);
  });

  test('retains progress, builds a plan and renders on mobile without overflow', async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Networking lab', exact: true }).click();
    await page.getByRole('button', { name: 'Study plan', exact: true }).click();
    await page.getByRole('button', { name: 'Create study plan', exact: true }).click();
    await page.getByLabel('Daily study time (minutes)').fill('45');
    await page.getByRole('button', { name: 'Build study plan' }).click();
    await expect(page.locator('.plan-summary')).toBeVisible();
    await page.getByRole('button', { name: 'Progress', exact: true }).click();
    await expect(page.locator('.attempt-list')).toContainText('Network foundations');
    await page.screenshot({ path: '.cache/screenshots/progress-desktop.png', fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
    await page.getByRole('button', { name: 'Overview', exact: true }).click();
    await expect(page.locator('.stats')).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await page.screenshot({ path: '.cache/screenshots/overview-mobile.png', fullPage: true });
    await page.reload();
    await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
    await page.getByRole('button', { name: 'Networking lab', exact: true }).click();
    await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
    await page.getByRole('button', { name: 'Sources 1', exact: true }).click();
    await page.locator('.section-row').first().click();
    await expect(page.getByRole('button', { name: 'Completed', exact: true })).toBeVisible();
    await page.getByRole('tab', { name: /Flashcards/ }).click();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await page.screenshot({ path: '.cache/screenshots/flashcards-mobile.png', fullPage: true });
  });
});
