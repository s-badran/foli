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

const cards = [
  ['Which structure removes the oldest item first?', 'A queue', 'Alpha Section'],
  ['Which structure removes the newest item first?', 'A stack', 'Alpha Section'],
  ['What does a linked list node point to?', 'The next node in the chain', 'Alpha Section'],
  ['What does a hash table map?', 'Keys to slots for fast lookup', 'Alpha Section'],
].map(([question, answer, keyTopic]) => ({ question, answer, keyTopic }));

const quiz = {
  questions: [
    { question: 'A print job waits behind an earlier job. Which structure fits?', options: ['Queue', 'Stack', 'Linked list', 'Hash table'], correctIndex: 0, explanation: 'Queues serve the oldest item first, so the earlier job prints first.', keyTopic: 'Alpha Section', kind: 'scenario' },
    { question: 'An undo button removes the latest action. Which structure fits?', options: ['Queue', 'Stack', 'Graph', 'Tree'], correctIndex: 1, explanation: 'A stack removes the newest item first, which matches undo.', keyTopic: 'Alpha Section', kind: 'scenario' },
    { question: 'Which structure gives near constant time lookup by key?', options: ['Queue', 'Stack', 'Hash table', 'Linked list'], correctIndex: 2, explanation: 'A hash table maps keys to slots, so lookup does not scan every item.', keyTopic: 'Alpha Section', kind: 'concept' },
  ],
};

test.describe.serial('regenerate controls sit at the bottom of each tab', () => {
  test.beforeAll(async ({ request }) => {
    for (const folder of (await state(request)).folders)
      await request.delete(`/api/folders/${folder.id}`);
  });

  test('moves the control into each tab footer and explains when it is stale', async ({
    page,
    request,
  }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'New workspace', exact: true }).click();
    await page.getByLabel('Exam name', { exact: true }).fill('Regenerate placement');
    await page.getByLabel('First study source (optional)').setInputFiles({
      name: 'structures.md',
      mimeType: 'text/markdown',
      buffer: Buffer.from(source),
    });
    await page.getByRole('button', { name: 'Create workspace', exact: true }).click();

    // The markdown source already yields a section, so drop the unneeded outline prompt.
    for (const pending of (await state(request)).requests.filter((item) => item.kind === 'outline'))
      await request.delete(`/api/requests/${pending.id}`);

    const lesson = page.locator('button.lesson-row').first();
    await expect(lesson).toBeVisible();
    await lesson.click();
    const folder = (await state(request)).folders[0];

    await page.getByRole('button', { name: 'Generate all study materials' }).click();
    await page.getByRole('tab', { name: /Flashcards/ }).click();
    await expect(page.locator('.request-status').first()).toContainText('waiting for the tutor');
    await respond(request, 'flashcards', { groups: [{ concept: 'Structures', cards }] });
    await check(page);
    await page.getByRole('tab', { name: /Quiz/ }).click();
    await respond(request, 'quiz', quiz);
    await check(page);
    await page.getByRole('tab', { name: 'Summary', exact: true }).click();
    await respond(request, 'summary', summary);
    await check(page);
    await expect(page.locator('.markdown')).toContainText('Exam Traps');

    await expect(page.locator('.artifact-toolbar')).toHaveCount(0);

    const footer = page.locator('.artifact-footer, .reader-footer');
    await expect(footer).toHaveCount(1);

    // Fresh material: the button is present but disabled, and only the tooltip explains why.
    await expect(page.locator('.reader-footer').getByRole('button', { name: 'Practice flashcards' })).toBeVisible();
    const regenerate = page.getByRole('button', { name: 'Regenerate summary' });
    await expect(regenerate).toBeDisabled();
    await expect(regenerate).toHaveAttribute('title', 'Nothing changed since this was generated.');
    await expect(page.locator('.reader-footer .form-note')).toHaveCount(0);
    const summaryFooter = (await page.locator('.reader-footer').boundingBox())!;
    const tabRow = (await page.locator('.tab-row').boundingBox())!;
    expect(summaryFooter.y).toBeGreaterThan(tabRow.y + tabRow.height);

    await page.getByRole('tab', { name: /Flashcards/ }).click();
    const cardsFooter = (await page.locator('.artifact-footer').boundingBox())!;
    const allCards = (await page.locator('details.all-cards').boundingBox())!;
    expect(cardsFooter.y).toBeGreaterThan(allCards.y);
    await expect(page.getByRole('button', { name: 'Regenerate flashcards' })).toBeDisabled();

    // The quiz control has its own row below Previous/Next, before and after submitting.
    await page.getByRole('tab', { name: /Quiz/ }).click();
    const quizRegenerate = page.getByRole('button', { name: 'Regenerate quiz' });
    await expect(quizRegenerate).toBeVisible();
    const quizFooter = (await page.locator('.quiz-view .artifact-footer').boundingBox())!;
    const quizNav = (await page.locator('.quiz-nav').boundingBox())!;
    expect(quizFooter.y).toBeGreaterThan(quizNav.y);

    for (const [index, item] of quiz.questions.entries()) {
      await page.locator('.quiz-question').locator(`input[value="${item.correctIndex}"]`).check();
      if (index < quiz.questions.length - 1)
        await page.getByRole('button', { name: 'Next', exact: true }).click();
    }
    await page.getByRole('button', { name: 'Submit quiz' }).click();
    await expect(page.locator('.quiz-result')).toContainText('3 / 3');
    await expect(quizRegenerate).toBeVisible();
    const resultFooter = (await page.locator('.quiz-view .artifact-footer').boundingBox())!;
    const result = (await page.locator('.quiz-result').boundingBox())!;
    expect(resultFooter.y).toBeGreaterThan(result.y + result.height);

    // Changing the model makes the summary stale: the note says why and the button enables.
    await request.patch(`/api/folders/${folder.id}`, { data: { modelId: 'deepseek-reasoner' } });
    await page.reload();
    await expect(page.locator('.reader-footer .form-note')).toHaveText(
      'Generated with deepseek-chat. Current model is deepseek-reasoner.',
    );
    await expect(page.getByRole('button', { name: 'Regenerate summary' })).toBeEnabled();
    await page.screenshot({ path: '.cache/screenshots/regenerate-desktop.png', fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: '.cache/screenshots/regenerate-mobile.png', fullPage: true });
  });
});
