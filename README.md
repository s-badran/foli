# Folio

A local-first AI study workspace: turn PDFs, Markdown, text files, or a model-generated topic into section summaries, flashcards, quizzes, and a dated study plan. Inspired by RemNote's source-to-practice approach, with an original interface and implementation.

## Run Locally

Requires Node.js 24+ and pnpm. No Docker, database service, account, or API key is required for the extractive practice mode.

```sh
pnpm install
pnpm dev
```

Vite prints the browser URL, normally `http://127.0.0.1:5173`. The API listens on `http://127.0.0.1:3001`. If the API port is occupied, use `PORT=43126 pnpm dev`; Vite follows that port automatically. Both bind only to localhost.

For a built, single-server version:

```sh
pnpm build
PORT=43126 pnpm start
```

Then open `http://127.0.0.1:43126`.

## First Study Session

1. Import the existing **AWS Certified Solutions Architect Associate** folder, or create a subject and upload PDF, MD, or TXT files.
2. Open **Sources**, select a section, and generate its study pack. Use **AI settings** first for an actual LLM; the default is explicitly labelled offline extraction.
3. Read the summary, review flashcards, and answer the quiz. Grade revealed cards **Again / Hard / Good / Easy** to schedule their next review with FSRS.
4. Set your target date and daily minutes in **Study plan**. Mark reading complete separately from practice; **Progress** shows reading, review counts, and quiz history.
5. Add an **AI topic** to study model knowledge without an uploaded document. Rebuild your plan after adding sources or topics.

The example PDFs contain 909 pages in total and currently produce 109 page-group sections. Their original files are never modified or committed. ZIP files are not imported or executed. PDF page ranges are shown alongside each section. Markdown and text documents split at headings and safe text boundaries.

This working copy has already been seeded with those PDFs, two clearly labelled extractive starter packs in the exam guide, and a **placeholder target of December 22, 2026 at 45 minutes/day**. Adjust the plan to your actual exam. Local study data is ignored by Git and is not included in a fresh clone.

## Generation Options

| Provider                 | Setup                                                                     | What It Does                                                                                                             |
| ------------------------ | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Offline extracts         | Nothing                                                                   | Extracts statements and makes fill-in-the-blank practice. **Not AI** and not a substitute for conceptual exam questions. |
| BYOK / OpenAI-compatible | API base URL, model ID, and provider key                                  | Generates summaries, conceptual cards, multiple-choice questions, and optional knowledge supplements.                    |
| GitHub Copilot SDK       | Explicit workspace-local login, subscription entitlement, available model | Uses the official local SDK, with no enabled agent tools. No VS Code tokens are extracted.                               |

### BYOK

Choose **BYOK** in **AI settings**. The default base URL is `https://api.openai.com/v1` and model ID is `gpt-4o-mini`; replace the ID with a model available to your account. Use an API base URL ending in the provider's API prefix, not `/chat/completions` itself.

The app calls the OpenAI-compatible chat-completions API. Compatible services such as OpenRouter or a local Ollama/LM Studio server can work when they implement that contract. Local example: `http://127.0.0.1:11434/v1`, with the exact model name you installed and an empty key. A local model server is not installed by this project. Native Anthropic, Azure-specific authentication, and noncompatible provider APIs are not adapters in this MVP.

Your API key is held only in React memory and sent in a request header to the local API, which forwards it to your selected provider. It is never written to disk or study exports. Reloading clears provider settings and keys. Generating a section sends **that section's extracted text**, not your whole folder, to the selected provider. Provider data-retention policies still apply. Generation is manual per section to control cost.

**Supplement** adds background from the model in a separate labelled block. Uploaded-source summaries and practice are instructed to remain grounded in the source. Topic-only sections are explicitly labelled model knowledge. Neither instruction nor schema validation guarantees factual accuracy; check high-stakes facts against current official documentation.

### GitHub Copilot

The installed official `@github/copilot-sdk` is integrated. Copilot access is **not** automatic just because VS Code has a subscription. Login, your plan's permissions, available models, organization policies, usage limits, and possible premium usage all apply. No live Copilot request or login was performed during implementation.

The app isolates Copilot session/config data under `data/copilot`, denies tool permissions, enables no agent tools, and skips repository custom instructions. To opt into interactive login, install the official CLI **locally**, not globally:

```sh
pnpm add -D @github/copilot
mkdir -p data/copilot
COPILOT_HOME="$PWD/data/copilot" pnpm exec copilot
```

In the interactive CLI, use `/login` and complete GitHub's browser flow yourself. Exit the CLI, select **GitHub Copilot** in the app, and supply an available model ID. The interactive login and live model entitlement remain user-side setup, not a verified part of this build. Never paste tokens into source files, chat, or documentation. Only run the login command when you intend to authenticate and use your subscription.

## Stack And Layout

Node.js 24, strict TypeScript, pnpm, React 19, Vite, Express 5, Zod, pdf-parse, ts-fsrs, Lucide, Vitest, and Playwright. Single-user JSON storage avoids an infrastructure dependency. There is no authentication, cloud sync, or deployment.

```text
src/
  App.tsx             Navigation, dialogs, session-only provider configuration
  Dashboard.tsx       Overview, source library, dated plan, progress
  StudyView.tsx       Summary, flashcard session, quiz, original source
  components.tsx      Shared UI primitives and clock
  api.ts              Typed HTTP helpers
  styles.css          Responsive workspace styles
server/
  index.ts            Localhost server entry point
  app.ts              HTTP API and upload/import routes
  documents.ts        PDF extraction and note sectioning
  generation.ts       Offline, BYOK, and Copilot provider pipeline
  study.ts            FSRS adapter and study-plan scheduling
  store.ts            Serialized atomic JSON writes
shared/models.ts      Zod generation schemas and shared contracts
tests/                Unit, HTTP, mock-provider, and browser tests
docs/                 Architecture, verification, and implementation plan
data/                 Ignored study store, uploaded copies, optional login
```

See [the architecture and API map](docs/ARCHITECTURE.md), [implementation plan](docs/IMPLEMENTATION_PLAN.md), and [verification record](docs/VERIFICATION.md).

## Checks

```sh
pnpm check
PLAYWRIGHT_BROWSERS_PATH=.cache/ms-playwright pnpm exec playwright install chromium
PLAYWRIGHT_BROWSERS_PATH=.cache/ms-playwright pnpm test:e2e
```

`pnpm check` runs lint, strict type checking, unit/API/provider tests, and a production build. Browser tests start a separate server on port 43127 and use `.cache/e2e-data`; they do not change your real study progress. They import the actual example PDFs, so those files must remain in the workspace for that acceptance test. Chromium and package caches stay inside the project. No `sudo` or global installation is required. If a different machine lacks browser OS libraries, install those yourself using your system's approved process; the project never escalates privileges.

## Data And Backups

- `data/study.json` stores sources, sections, generated packs, plans, card schedules, reviews, and quiz attempts.
- `data/uploads/` stores copies of original imported files. Preserve this directory with the JSON file for a complete backup.
- **Export study data** downloads a JSON snapshot containing extracted text and progress, **not** original file binaries. For a full backup, stop the server and copy the whole `data/` directory to another directory inside your project or your own chosen backup location.
- To restore, stop all app processes and restore the matching `study.json` and `uploads/` directory together. There is no in-app restore workflow yet.
- Deleting a study folder deletes its active study records and progress, but leaves original workspace documents and orphaned uploaded copies untouched. This is not secure erasure.
- Do not run multiple API processes against the same data directory. Writes are serialized within one process, not across processes. Browser tests use a separate directory.
- Source PDFs, ZIP archives, caches, exported local state, IDE workspace files, and secrets are excluded from Git. No remote is configured or pushed.

## MVP Boundaries

This is a usable **local single-user MVP**, not a publicly deployable service. Keep it bound to loopback. It has basic validation, file limits, workspace path restrictions, and atomic writes, but intentionally lacks accounts, authorization, rate limits, TLS termination, malware scanning, multi-user isolation, and production operations.

- Text PDFs only. Scanned/image PDFs require external OCR. PDF sectioning uses page groups, not semantic chapter discovery; slide boundaries may not match chapters.
- Offline practice is extractive and may include unhelpful source wording. Use a real model for higher-quality conceptual questions.
- Study plans estimate 15 minutes per unread section and reserve 25% of daily time for review. They flag overload, but do not predict exam readiness, adapt to quiz weakness, or automatically replan after changes. Dates are scheduled using UTC days.
- Card reviews are due-only. Generation is locked after any card/quiz history to preserve progress. Review history remains valid across reloads.
- Generation is one section per request; no streaming, background queue, auto-retry, batch generation, or vector search. Provider requests time out after two minutes; providers may still bill timed-out requests.
- Schemas validate structure, not knowledge. No live paid-provider call was made. BYOK's contract is tested with a local mock, and live Copilot remains unverified until you authenticate.
- Uploaded PDF previews depend on your browser's PDF support; an **Open original** link is always available. Uploaded source files and study content may contain private/copyrighted material: do not publish them without permission.
- Google Fonts supplies optional fonts; system sans-serif fallback works without it. PDFs are the actual visual source assets; no external stock imagery is needed.

## Next Steps

- Connect your preferred provider and try one section before generating more.
- Adjust the starter target date and daily study budget to your actual exam.
- Create your remote repository, then configure and push it yourself when ready.
