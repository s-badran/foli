# Folio

Local, single-user **exam preparation**. One workspace per exam, one main source defining the chapter roadmap, and related supplementary sources in the same exam directory.

**Prompt-driven, tutor-in-the-loop.** Study materials are produced by versioned prompts (outline, sections, summary, flashcards, quiz) stored in the repository. Generation is request/response: the app queues a request and writes the fully rendered prompt to disk; a configured model (`pnpm tutor run` or the UI) or a person writes the response file, which the app validates against a strict schema before applying it. Prompt quality is the product, so prompts are first-class files you revise without touching code.

## Run

Requires Node.js 24+ and pnpm:

```sh
pnpm install
cp .env.example .env   # optional: add provider keys
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

The supplied slide deck is the main source; the 30-page exam guide is an accepted supplement (70.6% vocabulary overlap). The outline follows the deck's own table of contents: **30 chapters**, each mapped to a page range and to the SAA-C03 task statements from the exam guide. Chapters 1-2 (Getting Started with AWS, IAM) have been split into sections and their summary/flashcard/quiz materials generated through the prompt pipeline as a worked example. The remaining chapters show their roadmap and exam focus and generate on request.

Materials are **tutor-authored practice**, not official AWS exam questions, a comprehensive exam bank, or a guarantee of exam readiness. Knowledge additions are labelled separately from source evidence. Sections carry a key-topic inventory, and flashcards/quizzes are validated to cover those topics.

## Coverage And Preparation

The methodology is topic-neutral: source structure → chapter outline → section key topics → mapped recall/application assessments → demonstrated preparation. Nothing in the completion, coverage or planning rules branches on AWS topics; the AWS example is only data flowing through the prompts and schemas.

Each section shows its key topics, source pages, and which cards/quiz questions map to each topic. A chapter is **prepared** only when its sections are generated, required assessments exist for the key topics, every card's latest recorded grade is Good/Easy, and the latest quiz answers are all correct. Reading markers never complete preparation, and later failed practice can reopen it. This is evidence from the current assessment set, not a validated prediction of exam performance.

## How Generation Works

1. The app queues a generation request (outline, sections, summary, flashcards or quiz). A single request targets one artifact for one chapter or section - never "everything at once".
2. The rendered prompt (system + task + the exact JSON schema + source pages + exam brief) is written to `data/exams/<id>/generation/<requestId>.prompt.md`.
3. Answer it with `pnpm tutor run` (or **Generate/Regenerate** in the UI, which uses the same pipeline), or write `.../<requestId>.response.json` yourself and run `pnpm tutor ingest` (or click **Check**).
4. The response is validated against the schema plus topic-coverage and range checks. Invalid responses are rejected with the problems listed; valid responses are applied, superseding previous pending requests for the same target.

```sh
pnpm tutor pending   # list open requests with their prompt/response paths
pnpm tutor ingest    # validate and apply every response file that exists
pnpm tutor run       # answer one pending request with an AI model, then ingest it
pnpm tutor run --limit 3 --model gpt-4o-mini
```

Per-artifact requests are deliberate: a single request that emits summary + cards + quiz at once splits the model's attention, mixes formats in one completion, and fails all-or-nothing. Separate prompts give each artifact a focused schema and isolated validation/retry, and match RemNote's separate "Generate cards" / "Generate quiz" buttons.

## AI Models

All AI access goes through one class, `AiModel`, in `server/ai/model.ts`. Callers never import a provider:

```ts
const model = AiModel.create(); // FOLIO_AI_MODEL, else deepseek-chat
const text = await model.complete({ prompt });
```

Keys live in `.env` (gitignored) and are read only by the server process; `GET /api/models` reports which providers are configured without exposing any secret. Start from the committed `.env.example`. If a `.env` file is ever force-added, `.gitattributes` routes it through git-crypt so the stored blob is encrypted; export and store the key (`git-crypt export-key <secure-path>`) before committing any encrypted file, or it cannot be recovered.

| Setting            | Purpose                                                              |
| ------------------ | -------------------------------------------------------------------- |
| `DEEPSEEK_API_KEY` | Enables `deepseek-chat` (default) and `deepseek-reasoner`             |
| `OPENAI_API_KEY`   | Enables `gpt-4o-mini`                                                 |
| `FOLIO_AI_MODEL`   | Default model id when none is passed                                  |
| Ollama             | `ollama-local` needs no key and calls `http://127.0.0.1:11434/v1`     |

`pnpm tutor run` writes the model's reply to the same response file a human would write, then goes through the identical validation and application path. A bad or over-long response is rejected with its problems listed, never applied.

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

Role and goal are saved context only. Changing student/professional/career changer does not change the plan or questions, and does not imply prior subject knowledge. They are injected into generation prompts as context only.

**Exam settings** saves the baseline and an editable exam tutor brief to the exam directory. Changing the brief does not silently rewrite existing lessons; it is injected into generation prompts as context. A main-source change still requires an explicit new dated plan, while a familiarity change automatically replans the existing one.

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
      generation/                    <requestId>.prompt.md and .response.json
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
pnpm tutor pending
PLAYWRIGHT_BROWSERS_PATH=.cache/ms-playwright pnpm exec playwright install chromium
PLAYWRIGHT_BROWSERS_PATH=.cache/ms-playwright pnpm test:e2e
```

`pnpm check` runs lint, strict types, **89 unit/API tests** and a production build. **Six Chromium workflows** cover the prompt pipeline end to end with isolated test data. See [verification](docs/VERIFICATION.md) and [RemNote analysis](docs/remnote-analysis.md).

## Structure And Limits

See [architecture and API contracts](docs/ARCHITECTURE.md) and [implementation history](docs/IMPLEMENTATION_PLAN.md).

- `server/store.ts`: per-exam storage and legacy migration.
- `server/curriculum.ts`: main-source outline (provisional until the outline request is answered), relevance, supplements.
- `server/tutor.ts`: prompt loading/rendering, request queue, response validation and application.
- `server/tutor-cli.ts`: `pnpm tutor pending` / `pnpm tutor ingest` helper.
- `shared/artifacts.ts`: schemas, coverage/quality checks and summary rendering.
- `shared/learning.ts`: topic-neutral coverage, practice evidence and baseline policy.
- `prompts/*.md`: versioned, exam-neutral generation prompts.
- `server/relevance.ts`: explainable supplementary-source overlap check.
- `src/App.tsx`: workspace index, routing, uploads and onboarding.
- `src/Dashboard.tsx`: chapter roadmap, source review, plan, progress and settings.
- `src/Generation.tsx`: generate/check controls, request status and prompt library.
- `src/StudyView.tsx`: lesson summaries, cards, quiz feedback and source reader.

This remains a local single-user MVP: no accounts, public hosting controls, cloud sync, OCR, robust arbitrary-book topic extraction, diagnostic item calibration or multi-user transactions. Generation is request/response via files; a response can be written by `pnpm tutor run` (DeepSeek, OpenAI-compatible or Ollama) or by a human, and both paths share the same validation. PDF uploads are limited to 60 MB each and 12 files per request. Dates use UTC days. Fonts are optional external downloads with local fallback.

## Contributing

Feedback and focused fixes are welcome. [CONTRIBUTING.md](CONTRIBUTING.md) covers setup, quality gates and pull request expectations. Contributions are accepted under the project license and the [Contributor License Agreement](CLA.md).

## License

Folio is released under the [GNU Affero General Public License v3.0](LICENSE) (`AGPL-3.0-only`).

You may run, study, modify and share it. If you run a modified version as a network service, you must offer the corresponding source under the same license. For different commercial terms, contact the author via [GitHub](https://github.com/s-badran).

## Next Steps

- Open the AWS workspace, review its first chapter and adjust your learning baseline.
- Set your real exam date and daily budget.
- Refine the saved tutor brief and request deeper practice for specific weak chapters.
