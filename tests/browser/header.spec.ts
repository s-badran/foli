import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Store } from '../../server/store';
import type { GenerationRequest, StudyState } from '../../shared/models';

const e2eStore = new Store(path.join(process.cwd(), '.cache/e2e-data'));

async function state(request: APIRequestContext) {
  return (await (await request.get('/api/state')).json()) as StudyState;
}

/** Plays the tutor model: writes a response file for the newest open request of a kind. */
async function respond(request: APIRequestContext, kind: GenerationRequest['kind'], payload: unknown) {
  const current = await state(request);
  const open = current.requests
    .filter((item) => item.kind === kind && (item.status === 'pending' || item.status === 'failed'))
    .at(-1);
  if (!open) throw new Error(`No open ${kind} request.`);
  const folder = current.folders.find((item) => item.id === open.folderId)!;
  await writeFile(e2eStore.generationPath(folder, `${open.id}.response.json`), JSON.stringify(payload));
  return open;
}

async function check(page: Page) {
  await page.getByRole('button', { name: 'Check', exact: true }).first().click();
}

const fileName = 'data-structures-and-algorithms-revision-handbook-chapter-one-queues.md';

const source = [
  '# Alpha Section',
  '',
  'A queue keeps work in order so each task runs after the one before it.',
  'Stacks remove the newest item first while queues remove the oldest item first.',
  'A linked list stores nodes that point to the next node in the chain.',
  'Hash tables map keys to slots so a lookup takes near constant time.',
].join('\n');

const summary = {
  overview: 'Queues keep order, stacks reverse it, and hash tables trade memory for fast lookup.',
  coreConcepts: [
    { term: 'Queue', definition: 'A first in, first out collection.' },
    { term: 'Stack', definition: 'A last in, first out collection.' },
  ],
  mustRemember: ['Queues remove the oldest item first.', 'Stacks remove the newest item first.'],
  examTraps: [{ trap: 'A stack is a queue', correction: 'A stack removes the newest item first.' }],
};

test.describe.serial('section header puts the title on its own row', () => {
  test.beforeAll(async ({ request }) => {
    for (const folder of (await state(request)).folders)
      await request.delete(`/api/folders/${folder.id}`);
  });

  test('orders the rows, names the real model and keeps a long file name inside the page', async ({
    page,
    request,
  }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'New workspace', exact: true }).click();
    await page.getByLabel('Exam name', { exact: true }).fill('Header layout');
    await page.getByLabel('First study source (optional)').setInputFiles({
      name: fileName,
      mimeType: 'text/markdown',
      buffer: Buffer.from(source),
    });
    await page.getByRole('button', { name: 'Create workspace', exact: true }).click();

    // The markdown source already yields a section, so drop the unneeded outline prompt.
    for (const pending of (await state(request)).requests.filter((item) => item.kind === 'outline'))
      await request.delete(`/api/requests/${pending.id}`);

    await page.locator('button.lesson-row').first().click();
    // Pick a model that is not the default, so a hardcoded label would fail the next check.
    const folder = (await state(request)).folders[0];
    await request.patch(`/api/folders/${folder.id}`, { data: { modelId: 'deepseek-reasoner' } });
    await page.getByRole('button', { name: 'Generate all study materials' }).click();
    await expect(page.locator('.request-status').first()).toContainText('waiting for the tutor');
    await respond(request, 'summary', summary);
    await check(page);
    await expect(page.locator('.markdown')).toContainText('Exam Traps');

    // Row 1: section badge first, then the file name, then the date pushed to the right.
    const top = await page.locator('.reader-top').evaluate((node) =>
      [...node.children].map((child) => ({ className: child.className, text: child.textContent })),
    );
    expect(top[0].className).toContain('badge');
    expect(top[0].text).toContain('Section 1');
    expect(top[1].className).toContain('reader-source');
    expect(top[2].className).toContain('reader-date');
    await expect(page.locator('.reader-source')).toHaveAttribute('title', fileName);
    const topBox = (await page.locator('.reader-top').boundingBox())!;
    const dateBox = (await page.locator('.reader-date').boundingBox())!;
    expect(Math.abs(dateBox.x + dateBox.width - (topBox.x + topBox.width))).toBeLessThan(2);
    await expect(page.locator('.reader-top')).not.toContainText('pp.');

    // Title alone on its own row, with no eyebrow.
    await expect(page.locator('.reader-heading h1')).toHaveText('Alpha Section');
    await expect(page.locator('.reader-heading .eyebrow')).toHaveCount(0);
    await expect(page.locator('.reader-title')).toHaveCount(0);

    // Row 3: Mark as read, practice state, status dot, then the real model.
    const meta = page.locator('.reader-meta');
    const order = await meta.evaluate((node) =>
      [...node.children].map((child) => child.className || child.tagName),
    );
    expect(order[0]).toContain('button');
    expect(order[1]).toContain('badge');
    expect(order[2]).toContain('dot');
    expect(order[3]).toContain('reader-model');
    await expect(page.getByRole('button', { name: 'Mark as read' })).toBeVisible();
    await expect(page.locator('.reader-model')).toHaveText('AI-generated · deepseek-reasoner');
    await expect(page.locator('.reader-model')).toHaveAttribute('title', /^Prompt versions: summary v\d+/);

    await page.getByRole('button', { name: 'Mark as read' }).click();
    await expect(page.getByRole('button', { name: 'Read', exact: true })).toBeVisible();

    await page.screenshot({ path: '.cache/screenshots/header-desktop.png', fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator('.reader-date')).toBeHidden();
    await expect(page.locator('.reader-model')).toBeVisible();
    expect(await page.locator('.reader-source').evaluate((node) => node.scrollWidth > node.clientWidth)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: '.cache/screenshots/header-mobile.png', fullPage: true });
  });
});
