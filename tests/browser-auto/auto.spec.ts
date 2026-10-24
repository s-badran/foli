import { expect, test, type APIRequestContext } from '@playwright/test';
import type { StudyState } from '../../shared/models';

async function state(request: APIRequestContext) {
  return (await (await request.get('/api/state')).json()) as StudyState;
}

test.describe.serial('auto-run generation with the mock model', () => {
  test.beforeAll(async ({ request }) => {
    for (const folder of (await state(request)).folders)
      await request.delete(`/api/folders/${folder.id}`);
  });

  test('clicking Generate runs the model inline and surfaces a rejected response', async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'New workspace', exact: true }).click();
    await page.getByLabel('Exam name', { exact: true }).fill('Auto test');
    await page.getByLabel('First study source (optional)').setInputFiles({
      name: 'auto.md',
      mimeType: 'text/markdown',
      buffer: Buffer.from('# Chapter One\n## Section A\nSome study content about IAM users.\n'),
    });
    await page.getByRole('button', { name: 'Create workspace', exact: true }).click();

    const lesson = page.locator('button.lesson-row').first();
    await expect(lesson).toBeVisible();
    await lesson.click();

    await page.getByRole('button', { name: 'Generate summary' }).click();
    // The mock model always returns an invalid object, so the run is rejected and surfaced.
    await expect(page.locator('.request-status').first()).toContainText(
      'did not pass validation',
    );
  });
});
