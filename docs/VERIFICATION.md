# Exam Revision Verification

## Final Gates

- `pnpm check`: lint, strict TypeScript, 33 unit/API tests and production build pass.
- `PLAYWRIGHT_BROWSERS_PATH=.cache/ms-playwright pnpm test:e2e`: five passing Chromium workflows using isolated `.cache/e2e-data`.
- Desktop chapter screenshot inspected at 1440 x 1000; mobile chapter plan at 390 x 844. Mobile plan/progress overflow assertions pass.
- No AI-provider call, authentication or subscription usage was performed.
- Development app remains at http://127.0.0.1:5173/ with the API on port 43126.

## Real AWS Migration

- Both original PDFs unchanged: 879-page slide deck and 30-page exam guide.
- Main source: the fingerprint-verified supplied slide deck.
- Supplement: exam guide, accepted at 70.6% vocabulary overlap against the 16% heuristic threshold.
- Active material: 28 chapters, 56 lessons, 112 conceptual cards, 56 scenario questions.
- Prior legacy records, reviews and attempts retained. The original legacy JSON is not overwritten.
- Existing exam target and daily budget used to rebuild the plan; no exam date was guessed anew.
- Actual data now lives beneath `data/exams/aws-certified-solutions-architect-associate--<id>/`, including sources, prompts, chapter packs, plan and progress.

## Acceptance Workflows

1. Import both real PDFs with learner onboarding; see 28 chapters; search the roadmap; use the Workspaces breadcrumb to return to the index and reopen the exam.
2. Read an original IAM explanation, inspect source references, review a conceptual card, answer an architectural scenario, save completion, reload and inspect the original PDF.
3. Upload an unrelated cooking document, observe a warning and exclusion, keep it excluded, change the main PDF with confirmation, preserve archived quiz/review records and switch back.
4. Create a new workspace from a Markdown upload, retain chapter/section hierarchy, save learner settings and a tutor brief, then reload to verify persistence.
5. Build a chapter-associated dated plan; navigate mobile plan and progress without horizontal overflow.

## Focused Tests

Coverage includes legacy migration and source-copy preservation; missing-indexed-snapshot errors; Markdown chapter boundaries; main-source-only chapter ownership; unrelated-source exclusion; complete tutor pack schema/counts; distinct choices; no cloze placeholders; FSRS state; server-side scoring; retained progress; plan overload/date checks; workspace traversal rejection. Historical provider contract tests use only a local mock; they do not indicate active AI integration.

## RemNote Research

Public source checked: [Guided Learn Mode](https://help.remnote.com/en/articles/15724936-guided-learn-mode).

- Verified question: “how well do you know this content?”
- Verified choices: “Haven't learned it yet”, “I have a basic understanding”, “Know it well and just want to review”.
- Verified behavior: changes priority, not the underlying sections/cards.
- Role-selection wording was not verified; Folio uses its own labels.
- No signup account was created and no private onboarding text was claimed as verified.

## Limits And Residual Risk

- Vocabulary overlap is not semantic relevance or contradiction detection. Short or multilingual files need manual judgment.
- The tutor-authored pack is original foundational practice, not a professionally certified or exhaustive exam question bank. Chapter ranges are verified; every sentence is not independently source-checked.
- Arbitrary new exams receive a source outline, not invented tutor lessons. Replacing the main source invalidates the plan and starts a new active curriculum; history remains archived.
- Learner role/goal and the brief are saved context. The brief does not execute prompts or rewrite existing content while integration is paused.
- Single-process per-exam writes are not a full transactional database; projection/index updates can be interrupted. Complete backups remain necessary.
- Current harmless Zod/Rollup annotation notices do not fail the production build.
- No push was performed. The user-configured remote remains unchanged.

## Screenshot Artifacts

Ignored files under `.cache/screenshots/` include `exam-chapters-desktop.png`, `exam-plan-mobile.png` and `exam-progress-mobile.png`. No source PDFs, study data or screenshots are committed.
