import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Store } from '../../server/store';
import type { GenerationRequest, StudyState } from '../../shared/models';

const e2eStore = new Store(path.join(process.cwd(), '.cache/e2e-data'));
const fixtureNames = [
  'AWS Certified Solutions Architect Slides v49.pdf',
  'solutions-architect-associate-03-Exam-Guide.pdf',
];
let pdfFixtures: { name: string; mimeType: string; buffer: Buffer }[];

async function realPdf(name: string) {
  try {
    return await readFile(path.join(process.cwd(), 'AWS Certified Solutions Architect Associate', name));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    const store = new Store(path.join(process.cwd(), 'data'));
    const saved = await store.read();
    const source = saved.sources.find((item) => item.name === name && item.file);
    const folder = saved.folders.find((item) => item.id === source?.folderId);
    if (!source?.file || !folder) throw new Error(`Missing local test PDF: ${name}.`);
    return readFile(store.sourcePath(folder, source.file));
  }
}

async function state(request: APIRequestContext) {
  return (await (await request.get('/api/state')).json()) as StudyState;
}

/** Plays the tutor model: writes a response file for the newest open request of a kind. */
async function respond(request: APIRequestContext, kind: GenerationRequest['kind'], payload: unknown) {
  const current = await state(request);
  const open = current.requests.filter((item) => item.kind === kind && (item.status === 'pending' || item.status === 'failed')).at(-1);
  if (!open) throw new Error(`No open ${kind} request.`);
  const folder = current.folders.find((item) => item.id === open.folderId)!;
  await writeFile(e2eStore.generationPath(folder, `${open.id}.response.json`), JSON.stringify(payload));
  return open;
}

async function check(page: Page) {
  await page.getByRole('button', { name: 'Check', exact: true }).first().click();
}

const cards = [
  ['What can an IAM group contain?', 'Users only', 'IAM groups'],
  ['Can a user belong to multiple groups?', 'Yes', 'IAM groups'],
  ['IAM policy document format?', 'JSON', 'IAM policies'],
  ['Two values of a policy Effect?', 'Allow or Deny', 'IAM policies'],
].map(([question, answer, keyTopic]) => ({ question, answer, keyTopic }));
const quiz = {
  questions: [
    { question: 'An admin wants to nest the Developers group inside another group. What happens?', options: ['It fails; groups hold users only', 'It works one level deep', 'It works for inline policies', 'It works per Region'], correctIndex: 0, explanation: 'Groups contain users only; there is no nesting, and IAM is global.', keyTopic: 'IAM groups', kind: 'scenario' },
    { question: 'An auditor needs read-only EC2 access. Which policy applies least privilege?', options: ['Allow ec2:* on *', 'Allow ec2:Describe* on *', 'Allow * on *', 'Deny ec2:Describe* on *'], correctIndex: 1, explanation: 'Describe actions grant exactly read access; the others over-grant or deny it.', keyTopic: 'IAM policies', kind: 'scenario' },
    { question: 'Which statement about policies is true?', options: ['They are YAML', 'They are JSON', 'Effect is optional', 'Version is free-form'], correctIndex: 1, explanation: 'Policies are JSON with a required Effect and a fixed Version value.', keyTopic: 'IAM policies', kind: 'concept' },
  ],
};

test.describe.serial('prompt-driven exam workflow', () => {
  test.beforeAll(async ({ request }) => {
    pdfFixtures = [];
    for (const name of fixtureNames) pdfFixtures.push({ name, mimeType: 'application/pdf', buffer: await realPdf(name) });
    for (const folder of (await state(request)).folders) await request.delete(`/api/folders/${folder.id}`);
  });

  test('uploads real PDFs, queues an outline prompt and builds the roadmap from the response', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'New workspace', exact: true }).click();
    await page.getByLabel('Exam name', { exact: true }).fill('AWS Certified Solutions Architect Associate');
    await page.getByLabel('First study source (optional)').setInputFiles(pdfFixtures);
    await page.getByLabel('How well do you know this content?').selectOption('basic');
    await page.getByRole('button', { name: 'Create workspace', exact: true }).click();
    await expect(page.locator('.outline-banner')).toContainText('waiting for the tutor');
    const pending = (await state(page.request)).requests.find((item) => item.kind === 'outline')!;
    const prompt = await (await page.request.get(`/api/requests/${pending.id}/prompt`)).text();
    expect(prompt).toContain('[Page 3]');
    expect(prompt).toContain('Table of Contents');
    expect(prompt).toContain('Required JSON schema');
    await respond(page.request, 'outline', {
      chapters: [
        { title: 'Getting Started with AWS', pageStart: 14, pageEnd: 23, description: 'Global infrastructure basics.' },
        { title: 'AWS Identity & Access Management (AWS IAM)', pageStart: 24, pageEnd: 40, description: 'Users, groups, policies and roles.' },
      ],
    });
    await check(page);
    await expect(page.locator('.outline-banner')).toHaveCount(0);
    await expect(page.locator('details.chapter')).toHaveCount(2);
    await expect(page.locator('details.chapter').nth(1)).toContainText('Sections not generated');
  });

  test('generates sections on request and they are clickable', async ({ page }) => {
    const folder = (await state(page.request)).folders[0];
    await page.goto(`/#exam/${folder.id}/chapters`);
    const iam = page.locator('details.chapter').nth(1);
    await iam.locator('summary').click();
    await iam.getByRole('button', { name: 'Generate sections' }).click();
    await expect(iam).toContainText('waiting for the tutor');
    await respond(page.request, 'sections', {
      sections: [{ title: 'IAM Users, Groups & Policies', pageStart: 24, pageEnd: 28, keyTopics: ['IAM groups', 'IAM policies'], objective: 'Explain how groups and policies grant permissions.' }],
    });
    await check(page);
    await expect(iam.locator('.lesson-row')).toHaveCount(1);
    await expect(iam.locator('.lesson-row')).toContainText('IAM groups · IAM policies');
    await iam.locator('.lesson-row').click();
    await expect(page.getByRole('heading', { name: 'IAM Users, Groups & Policies' })).toBeVisible();
    await expect(page.locator('.topic-chip')).toHaveCount(2);
  });

  test('generates all materials at once and surfaces rejected responses', async ({ page }) => {
    const current = await state(page.request);
    const section = current.sections.find((item) => !item.archived && item.chapterId)!;
    await page.goto(`/#exam/${section.folderId}/section/${section.id}`);

    await page.getByRole('button', { name: 'Generate all study materials' }).click();
    await page.getByRole('tab', { name: /Flashcards/ }).click();
    await expect(page.locator('.request-status').first()).toContainText('waiting for the tutor');
    await respond(page.request, 'flashcards', { groups: [{ concept: 'IAM', cards: [{ question: 'Explain IAM?', answer: 'IAM is a global service that manages users, groups, roles and permissions for every account in the organisation', keyTopic: 'IAM groups' }] }] });
    await check(page);
    await expect(page.locator('.request-status.failed')).toContainText('did not pass validation');
    await respond(page.request, 'flashcards', { groups: [{ concept: 'Groups and policies', cards }] });
    await check(page);
    await page.getByRole('button', { name: 'Reveal answer', exact: true }).click();
    await expect(page.locator('.flashcard-text')).toHaveText('Users only');
    await page.getByRole('button', { name: 'Good', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Review saved' })).toBeVisible();
    await page.getByRole('tab', { name: /Quiz/ }).click();
    await respond(page.request, 'quiz', quiz);
    await check(page);
    const questions = page.locator('.quiz-question');
    await expect(questions).toHaveCount(3);
    for (let index = 0; index < 3; index++) await questions.nth(index).getByRole('radio').nth(quiz.questions[index].correctIndex).check();
    await page.getByRole('button', { name: 'Submit quiz' }).click();
    await expect(page.locator('.quiz-result')).toContainText('3 / 3');
    await page.getByRole('tab', { name: 'Summary', exact: true }).click();
    await respond(page.request, 'summary', {
      overview: 'IAM groups collect users, and JSON policies attached to them grant permissions.',
      coreConcepts: [{ term: 'IAM group', definition: 'A collection of users.' }, { term: 'IAM policy', definition: 'A JSON permissions document.' }],
      mustRemember: ['Groups contain users only.', 'Effect is Allow or Deny.'],
      examTraps: [{ trap: 'Groups can contain groups', correction: 'Groups contain users only.' }],
    });
    await check(page);
    await expect(page.locator('.markdown')).toContainText('Exam Traps');
    await expect(page.locator('.key-points')).toContainText('Groups contain users only.');
  });

  test('flags unrelated supplements and saves the exam brief into new prompts', async ({ page }) => {
    const folder = (await state(page.request)).folders[0];
    await page.goto(`/#exam/${folder.id}/sources`);
    await page.getByRole('button', { name: 'Add sources', exact: true }).click();
    await page.locator('input[type=file]').setInputFiles({ name: 'cooking.md', mimeType: 'text/markdown', buffer: Buffer.from('# Cooking\nPasta dough uses flour, eggs and water. Simmer tomatoes with garlic and basil.') });
    await page.getByRole('dialog').getByRole('button', { name: 'Add sources', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('Insufficient shared topic vocabulary');
    await page.getByRole('button', { name: 'Exam settings', exact: true }).click();
    await page.getByLabel('Exam tutor brief').fill('Emphasise policy evaluation traps.');
    await page.getByRole('button', { name: 'Save exam settings' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Exam settings saved' })).toBeVisible();
    await expect(page.locator('.prompt-library')).toContainText('prompts/flashcards.md');
    const section = (await state(page.request)).sections.find((item) => !item.archived && item.chapterId)!;
    const queued = await (await page.request.post(`/api/folders/${folder.id}/requests`, { data: { kind: 'flashcards', targetId: section.id } })).json();
    const prompt = await (await page.request.get(`/api/requests/${queued.id}/prompt`)).text();
    expect(prompt).toContain('Emphasise policy evaluation traps.');
    expect(prompt).not.toContain('cooking');
    await page.request.delete(`/api/requests/${queued.id}`);
  });

  test('plans every chapter, estimating unsectioned ones, without mobile overflow', async ({ page }) => {
    const folder = (await state(page.request)).folders[0];
    await page.goto(`/#exam/${folder.id}/plan`);
    await page.getByRole('button', { name: 'Create study plan', exact: true }).click();
    await page.getByLabel('Exam date', { exact: true }).fill(new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10));
    await page.getByRole('button', { name: 'Build study plan', exact: true }).click();
    await expect(page.locator('.warning')).toContainText('not yet split into sections');
    await page.locator('.daily-schedule summary').click();
    await expect(page.locator('.day-section.estimated').first()).toContainText('Getting Started with AWS');
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: '.cache/screenshots/v3-plan-mobile.png' });
  });
});
