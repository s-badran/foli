# Folio

Local, single-user **exam preparation**. One workspace per exam, one main source defining the chapter roadmap, and related supplementary sources in the same exam directory.

**AI-provider integration is paused.** The AWS example now contains original tutor-authored study material instead of the previous extractive fill-in-the-blank demo. No API key, Copilot login or model call is needed.

## Run

Requires Node.js 24+ and pnpm:

```sh
pnpm install
pnpm dev
```

Open the Vite URL, normally **http://127.0.0.1:5173/**. For the current working copy, the API runs on an alternate port:

```sh
PORT=43126 pnpm dev
```

The Vite proxy follows `PORT`. Both services bind to loopback. For one built server, run `pnpm build` followed by `PORT=43126 pnpm start`, then open that port. No global install, database service or Docker is needed.

## Workspaces And Sources

- The **Workspaces** breadcrumb and sidebar link open the workspace index. Choose an exam, create a new workspace or import an existing local source folder. Routes are bookmarkable and survive reloads.
- Creating a workspace with its first PDF/MD/TXT upload creates a local exam directory. Later **Add sources** uploads inside that exam go into the same directory. An empty workspace can also be created before uploading.
- The first source becomes the main source. In **Sources**, select **Make main source** to choose a different file. Confirmation explains that active chapters will be rebuilt, previous materials/progress archived and the dated plan cleared.
- Only the main source defines the curriculum hierarchy. Supplementary PDFs do not append a second independent course or duplicate every chapter.
- Added supplements receive a vocabulary-overlap check against the main source. Insufficient overlap produces a warning and excludes the file from study context. The source stays available for inspection. Explicit review can accept or exclude it.
- Accepted sources contribute **related reading references**, selected per chapter by topic overlap. This does not assert that a supplement verifies every tutor statement. Excluding one immediately removes its related-reading links.

The relevance score is a transparent heuristic, **not** an AI judgment, semantic probability, factual verification or guarantee against hallucination. It measures shared distinctive vocabulary, uses a 16% threshold and a minimum shared-term requirement, and can misclassify short, multilingual or unusually phrased documents. Explicit review overrides remain in force until the main source changes.

## The AWS Example

The actual supplied slide deck has been mapped to **28 chapters** using verified divider pages. Its fingerprint identifies this exact file; a similarly named unrelated PDF cannot silently receive AWS materials.

The exam contains:

- **63 tutor lessons**, with counts determined by authored topic coverage rather than a two-per-chapter quota.
- **143 atomic flashcards**: one recall target per card, short answers, longer reasoning kept in summaries and quiz explanations.
- **63 application questions**, one per lesson, with four choices and explained answers.
- Per-lesson summaries, architectural trade-offs and common traps.
- Main-source chapter page references and related supplementary reading.
- A chapter-first dated plan, FSRS card schedules, saved quizzes and separate reading progress.

IAM now has nine source-mapped topic areas: users/groups, permissions, policies, password/MFA protection, CLI, SDK, service roles, security tools and best practices. Its 35 cards and nine application questions cover those areas with source-page references. The remaining 27 chapters are explicitly **draft inventories, not source-audited**. Completing their current practice does not establish complete source coverage. More questions do not by themselves prove coverage.

Topics also include EC2, load balancing, RDS/Aurora, S3, Route 53, networking, messaging, containers, serverless, databases, analytics, security, disaster recovery and architectural trade-offs. These are **tutor-authored practice**, not official AWS exam questions, a comprehensive exam bank or a guarantee of exam readiness. Knowledge additions are labelled separately from source evidence.

## Coverage And Preparation

The methodology is topic-neutral: source topic inventory → learning objectives → mapped recall/application assessments → demonstrated preparation. Exam-specific content is registered in a content catalog; coverage, completion and planning rules do not branch on AWS topics.

Each chapter shows its objective checklist, source pages, cards/quiz mappings, coverage gaps and demonstrated topics. Supplements can add context, but must not silently replace required main-source topics. A chapter is **prepared** only when its source inventory is audited, required assessments exist, every card's latest recorded grade is Good/Easy and the latest quiz answers are all correct. Reading markers never complete preparation. Later failed practice can reopen it. This is evidence from the current assessment set, not a validated prediction of exam performance; self-rated cards and repeatable quizzes have limitations.

The former pack's fixed two-lesson quota caused the missing IAM coverage; the exam guide did not deliberately reprioritize those topics. Old paragraph cards and practice remain archived after the explicit materials upgrade. The upgrade is idempotent and does not delete historical reviews or quiz attempts.

Your real working copy has already been migrated. The slides are the main source; the 30-page exam guide is an accepted supplement (70.6% vocabulary overlap at migration). Previous records were preserved. The old December 22, 2026 target and daily time budget were used to rebuild the plan; adjust them to your actual exam.

For another exam or a different main PDF, the app produces a source-based outline using explicit chapter/domain headings, or a provisional source-introduction group if no reliable boundary is found. Markdown H1 headings group subordinate sections. **It does not fabricate tutor packs for arbitrary exams.** Those need separate tutor authoring or a future generation integration. Switching back to the verified AWS deck restores its authored curriculum as a new revision.

## Learner Setup

Before a new upload/import you choose:

- **How well do you know this content?** New, basic understanding, or refresher.
- **Which best describes you?** Professional, student, career changer, or other.
- Your exam-preparation goal.

The baseline is a workflow preference, not proof of knowledge:

| Familiarity            | Initial View                        | Estimated Lesson Time | Daily Review Reserve |
| ---------------------- | ----------------------------------- | --------------------- | -------------------- |
| Haven't learned it yet | Summary                             | 25 minutes            | 25%                  |
| Basic understanding    | Flashcards, then targeted rereading | 15 minutes            | 35%                  |
| Know it well / review  | Quiz, then weak-topic repair        | 10 minutes            | 45%                  |

Saving a changed familiarity **automatically rebuilds an existing plan** without regenerating materials or changing card IDs, topics, difficulty or history. New quiz/review evidence also refreshes the remaining-work plan. The exam date spreads or compresses unprepared lessons over the first 80% of available days, leaving the remainder for review; overload is warned about rather than dropping topics. Time estimates are fixed MVP defaults, not measured predictions.

Role and goal are saved context only. Changing student/professional/career changer does not change the plan or questions, and does not imply prior subject knowledge. AI integration is paused, so none of these settings secretly modifies model prompts or generates new content.

**Exam settings** saves the baseline and an editable exam tutor brief to the exam directory. Changing the brief does not silently rewrite existing lessons. It is stored for tutor work and later prompt integration. A main-source change still requires an explicit new dated plan, while a familiarity change automatically replans the existing one.

The baseline wording is grounded in RemNote's public [Guided Learn Mode article](https://help.remnote.com/en/articles/15724936-guided-learn-mode). It documents “how well do you know this content?” with “Haven't learned it yet,” “I have a basic understanding,” and “Know it well and just want to review.” It says priority changes, not the underlying facts/cards. Exact role-onboarding wording could not be verified; the role labels here are Folio's own.

## Local Directory Layout

```text
data/
  study.json                         Legacy store retained unchanged when migrating
  uploads/                           Legacy copies retained for recovery
  exams/
    index.json                       Active exam-directory index
    aws-...--<workspace-id>/
      workspace.json                 Authoritative exam snapshot
      sources/                       Original PDF/MD/TXT copies
      prompts/study.md               Saved exam tutor brief
      chapters/<chapter-id>.json     Chapter and its lesson packs
      plan.json                      Dated plan snapshot
      progress.json                  Reading, reviews and quiz attempts
```

Everything for an exam lives beneath its directory; its path appears in **Exam settings**. `workspace.json` is authoritative. Other files are readable projections written after it; edit the brief through the app rather than expecting manual file edits to be watched. Older chapter files can remain after curriculum revisions, while the authoritative snapshot identifies active chapters.

The original workspace PDFs and ZIP archive are not changed. PDFs, archives, local study data, caches, environment files and IDE workspace files remain ignored by Git. Runtime API keys are not used in this revision.

## Backup And History

- Stop the API before making a consistent backup. Back up the entire `data/exams/` tree, including its index, rather than only the old global JSON file.
- **Export study data** downloads all active-workspace records, including archived lessons and progress, but not source binary files. Back up `sources/` too for original-file previews.
- Main-source switches archive old lessons and retain their card/quiz history. The progress page reports active curriculum progress and provides an archived-history count; exports contain full retained records.
- Deleting a workspace removes it from the active index but leaves its exam directory and original files on disk. This is not secure erasure or an in-app undo function.
- Legacy `data/study.json` is not overwritten by migration. Stop the server and restore a complete matching backup to roll back. There is no in-app restore screen yet.
- One API process must own a data directory. Writes are serialized in-process and each authoritative exam file is atomically renamed; cross-exam index/projection updates are not a multi-file database transaction. Multi-process use is unsupported.

## Stack And Checks

Node.js, strict TypeScript, pnpm, React/Vite, Express, Zod, pdf-parse, ts-fsrs, Lucide, Vitest and Playwright. Original branding and interface; no copied proprietary RemNote code or assets.

```sh
pnpm check
PLAYWRIGHT_BROWSERS_PATH=.cache/ms-playwright pnpm exec playwright install chromium
PLAYWRIGHT_BROWSERS_PATH=.cache/ms-playwright pnpm test:e2e
```

`pnpm check` runs lint, strict types, **39 unit/API tests** and a production build. **Six Chromium workflows** include topic coverage, concise cards, reading-versus-preparation and baseline/content stability. Browser tests use separate data under `.cache/e2e-data`, not your exam records. If the original source folder is absent, tests read retained PDF copies without modifying real study data. See [verification](docs/VERIFICATION.md).

## Structure And Limits

See [architecture and API contracts](docs/ARCHITECTURE.md) and [implementation history](docs/IMPLEMENTATION_PLAN.md).

- `server/store.ts`: per-exam storage and legacy migration.
- `server/curriculum.ts`: main-source outline, tutor packs, revisions and source references.
- `shared/learning.ts`: topic-neutral objective coverage, practice evidence and baseline policy.
- `server/tutor/catalog.ts`: source-fingerprinted content-pack lookup, separate from methodology.
- `server/relevance.ts`: explainable supplementary-source overlap check.
- `server/tutor/aws.ts`: original AWS lessons and scenario practice.
- `src/App.tsx`: workspace index, routing, uploads and onboarding.
- `src/Dashboard.tsx`: chapter roadmap, source review, plan, progress and settings.
- `src/StudyView.tsx`: lesson summaries, cards, quiz feedback and source reader.

This remains a local single-user MVP: no accounts, public hosting controls, cloud sync, OCR, robust arbitrary-book topic extraction, diagnostic item calibration or multi-user transactions. Practice-based remaining-work replanning is implemented, but there is no predictive adaptive tutor or automated full-source coverage audit. PDF uploads are limited to 60 MB each and 12 files per request. Dates use UTC days. Fonts are optional external downloads with local fallback. Model-provider modules remain inactive; generic cloze generation is retired.

Git commits are local development milestones. The user has configured the remote; **never push without explicit permission**.

## Next Steps

- Open the AWS workspace, review its first chapter and adjust your learning baseline.
- Set your real exam date and daily budget.
- Refine the saved tutor brief and request deeper practice for specific weak chapters.
