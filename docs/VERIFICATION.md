# Exam Revision Verification

## Final Gates

- `pnpm check`: lint, strict TypeScript, 48 unit/API tests and production build pass.
- `PLAYWRIGHT_BROWSERS_PATH=.cache/ms-playwright pnpm test:e2e`: five passing Chromium workflows using isolated `.cache/e2e-data`.
- `pnpm tutor pending` / `pnpm tutor ingest` exercise the request/response pipeline end to end.
- Desktop chapter screenshot inspected at 1440 x 1000; mobile chapter plan at 390 x 844. Mobile plan/progress overflow assertions pass.
- No AI-provider call, authentication or subscription usage was performed; generation is answered out-of-band via response files.
- Development app remains at http://127.0.0.1:5173/ with the API on port 43126.

## Real AWS Migration

- Both original PDFs unchanged: 879-page slide deck and 30-page exam guide.
- Main source: the fingerprint-verified supplied slide deck.
- Supplement: exam guide, accepted at 70.6% vocabulary overlap against the 16% heuristic threshold.
- Active material after the prompt-driven upgrade: a 30-chapter outline from the deck's table of contents, each chapter mapped to SAA-C03 task statements. Chapters 1-2 (Getting Started with AWS, IAM) have sections plus summary/flashcard/quiz generated through the prompt pipeline; the remaining chapters generate on request.
- IAM is generated against its actual pages (24-40); a fixed amount of authored material is not treated as proof of coverage. Section key topics drive card/quiz coverage validation.
- Prior legacy records, reviews and attempts retained. The original legacy JSON is not overwritten.
- Existing exam target and daily budget used to rebuild the plan; no exam date was guessed anew.
- Actual data now lives beneath `data/exams/aws-certified-solutions-architect-associate--<id>/`, including sources, prompts, generation request/response files, chapter packs, plan and progress.

## Acceptance Workflows

1. Import both real PDFs with learner onboarding; see 30 chapters with exam focus; search the roadmap; use the Workspaces breadcrumb to return to the index and reopen the exam.
2. Open a generated chapter (1 or 2), read the structured summary, review a grouped card, answer a quiz, save completion, reload and inspect the original PDF.
3. Generate per artifact: queue a sections request, write the response file, ingest and see the sections appear; queue summary/flashcards/quiz and confirm an invalid response is rejected with its problems surfaced in the UI.
4. Upload an unrelated cooking document, observe a warning and exclusion, keep it excluded, change the main PDF with confirmation, preserve archived quiz/review records and switch back.
5. Create a new workspace from a Markdown upload, retain chapter/section hierarchy, save learner settings and a tutor brief, then reload to verify persistence.
6. Build a chapter-associated dated plan; navigate mobile plan and progress without horizontal overflow; save changed familiarity and verify immediate replanning and a changed initial view while assessment IDs/content remain stable. Reading markers do not claim preparation.

## Focused Tests

Coverage includes legacy migration and source-copy preservation; missing-indexed-snapshot errors; Markdown chapter boundaries; main-source-only chapter ownership; unrelated-source exclusion; prompt versioning and exam-neutrality; source-page footer stripping; outline-overlap rejection; key-topic coverage enforcement (uncovered topics reject cards/quiz); concise-card enforcement (rejects paragraph answers, yes-no spam, duplicates); quiz weakness rejection (no all/none, distinct options, scenario share); summary rendering; version-gated quiz evidence; distinct choices; FSRS state; server-side scoring; retained progress; plan overload/date checks; workspace traversal rejection. Browser tests cover the real PDF → queued outline prompt → per-artifact generation with rejected-response surfacing → supplement warning and brief injection → plan estimates and mobile overflow.

Topic-neutral circuit fixtures verify missing-coverage blocking, read-only noncompletion, successful recall plus quiz evidence, later failure reopening, unaudited-inventory blocking, baseline time changes and date-dependent spacing. API tests verify automatic familiarity replanning, role-only non-effects, stable assessments and request/ingest application with retained history.

The original root PDF folder was no longer present during this revision. Browser tests were adapted to use read-only copies already retained by the app, rather than recreating a user-removed folder or altering real study records.

## RemNote Research

Public source checked: [Guided Learn Mode](https://help.remnote.com/en/articles/15724936-guided-learn-mode).

- Verified question: “how well do you know this content?”
- Verified choices: “Haven't learned it yet”, “I have a basic understanding”, “Know it well and just want to review”.
- Verified behavior: changes priority, not the underlying sections/cards.
- Role-selection wording was not verified; Folio uses its own labels.
- No signup account was created and no private onboarding text was claimed as verified.
- Full feature-by-feature screenshot analysis is in [docs/remnote-analysis.md](remnote-analysis.md).

## Limits And Residual Risk

- Vocabulary overlap is not semantic relevance or contradiction detection. Short or multilingual files need manual judgment.
- The tutor-authored pack is original foundational practice, not a professionally certified or exhaustive exam question bank. Chapter ranges are verified; every sentence is not independently source-checked.
- Arbitrary new exams receive a source outline, not invented tutor lessons. Replacing the main source invalidates the plan and starts a new active curriculum; history remains archived.
- Learner role/goal and the brief are saved context. The brief is injected into generation prompts; nothing executes automatically, and responses are validated before application.
- Single-process per-exam writes are not a full transactional database; projection/index updates can be interrupted. Complete backups remain necessary.
- Current harmless Zod/Rollup annotation notices do not fail the production build.
- No push was performed. The user-configured remote remains unchanged.

## Screenshot Artifacts

Ignored files under `.cache/screenshots/` include `exam-chapters-desktop.png`, `exam-plan-mobile.png` and `exam-progress-mobile.png`. No source PDFs, study data or screenshots are committed.
