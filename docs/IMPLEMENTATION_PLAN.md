# Folio MVP Implementation Plan

## Exam Workspace Revision

The original single-PDF extraction demo is superseded by the exam-scoped revision requested on 2026-10-23. AI-provider integration is paused; no runtime model calls are made by the current application routes.

- ✅ Directory-owned exam state, source copies, prompts, chapter packs, plans and progress; legacy records preserved.
- ✅ Main-source selection controls the chapter outline. Source changes require confirmation and archive previous curriculum/progress.
- ✅ Supplement relevance scoring, warnings, explicit review and exclusions; accepted related reading linked to chapter packs.
- ✅ Verified AWS slide-divider map: 28 chapters, 56 original tutor lessons, 112 conceptual cards and 56 scenario questions. No cloze fillers.
- ✅ Linked workspace index, upload-created workspaces, learner baseline/role/goal and saved exam brief.
- ✅ Chapter-first plan/progress UI, familiarity-aware priorities and time budgets, mobile browser verification.
- ✅ Final handover docs and local stage commits. Remote is configured by the user; never push without explicit permission.

The sections below retain the original build record for history. Current behavior and limitations are described in the revised README and exam architecture document.

## Product

A local-first, single-user study workspace inspired by RemNote's source-to-practice workflow. Original branding and interface; no copied proprietary code or assets. The first real dataset is the AWS Certified Solutions Architect Associate folder. PDFs and archives stay untracked.

## Architecture

```mermaid
flowchart LR
  UI[React / Vite workspace] --> API[Express / TypeScript API]
  Files[PDF / Markdown / text] --> Extract[PDF parser and section splitter]
  API --> Extract
  Extract --> Store[Local JSON store / atomic writes]
  API --> Generate[Validated generation pipeline]
  Generate --> Offline[Extractive offline practice]
  Generate --> BYOK[OpenAI-compatible API / BYOK]
  Generate --> Copilot[Optional local Copilot SDK]
  Generate --> Store
  API --> FSRS[FSRS spaced repetition]
  FSRS --> Store
```

## Structure

```text
server/       API, document ingestion, generation, persistence
shared/       Validated models and browser/server contracts
src/          React study workspace and styles
tests/        Unit, API, and browser workflow tests
docs/         Architecture, decisions, implementation record
data/         Ignored local study data and uploaded sources
AWS .../      Existing user source materials, unchanged
```

## Stack And Decisions

- Node.js 24, TypeScript strict, pnpm, React 19, Vite, Express 5.
- pdf-parse for text PDFs; heading-based sections for notes, page groups for PDFs. Page references remain visible. OCR is outside this MVP.
- Zod validates API input and generated study content. Never execute uploaded content.
- JSON persistence with serialized atomic writes: no Docker or database needed for one local user. Migrate to SQLite/Postgres if concurrency grows.
- ts-fsrs implements established spaced repetition instead of a handmade algorithm.
- OpenAI-compatible BYOK endpoint supports hosted providers and local compatible servers. Keys stay in browser memory and request headers only, never persisted or logged.
- Optional official GitHub Copilot SDK uses explicitly configured local credentials; never extract VS Code session tokens. Live usage depends on login, entitlement, quota, and model availability. Tool execution is denied.
- Offline extractive mode is useful without credentials but is not LLM generation. All output records provenance. AI supplements are distinct from uploaded evidence.
- Localhost only. No auth, billing, multi-user access, cloud deployment, or public exposure.
- Tests, strict type checking, lint, build, and desktop/mobile browser checks gate completion.

## Stages

✅ 1. Foundation: architecture, project setup, PDF extraction and section tests.
✅ 2. Study engine: folder import, uploads, study plans, validated generation, FSRS, progress, persistence, API tests.
✅ 3. Study workspace: library, section reader, cards, quizzes, plan calendar, progress, provider settings, responsive UI.
✅ 4. Verification: real PDF import, complete browser workflows, lint/typecheck/tests/build, screenshots, README and stage commits.

## MVP Acceptance

- Create multiple study folders; import existing workspace folders without reading outside the project; upload PDF/MD/TXT.
- Inspect sources and section text, generate per-section summaries, flashcards and multiple-choice quizzes.
- Set exam date and daily budget; receive a dated section plan with review capacity and overload warnings.
- Read summaries, grade due flashcards, answer quizzes, and retain progress across reloads.
- Topic-only generation uses model knowledge without uploaded sources; supplement mode labels model knowledge explicitly.
- No credentials required for offline study; clear provider errors without destroying previous content.
- Initialize Git, commit completed stages, leave remote configuration to the user.

## Deferred

OCR, document annotation, nested outline editing, collaboration, accounts, cloud sync, image occlusion, background worker queues, vector retrieval, PDF layout-aware chapter extraction, streaming generation, production deployment and hardening.

## Implementation Record

- Foundation verified with four sectioning tests, strict compilation and lint. pnpm 12 uses workspace YAML for local store configuration and build approvals. The initial install used the existing machine store before this was corrected; no global package was installed.
- Both actual user PDFs parsed: exam guide 30 pages / 9 sections / 40,991 characters; slide deck 879 pages / 100 sections / 426,553 characters. Original files remain unchanged and untracked.
- Engine tests cover offline generation, model-output validation, FSRS state, plan overload, serialized persistence and end-to-end HTTP study workflow. Keys are never part of persisted data.
- Copilot integration uses the installed SDK's empty mode, no tools, denied permissions, skipped repository instructions, and workspace-local Copilot home. No live login or paid call was attempted.
- Final automated gates: 27 unit/API/mock-provider tests plus three passing Chromium workflows, lint, strict types, and production build. Screenshots checked at desktop and mobile sizes; actual PDF serving and persisted progress verified.
- Running development app: http://127.0.0.1:5173 with API on port 43126. The real local store contains the two AWS PDFs, 109 sections, two labelled extractive starter packs, and a 45-minute daily plan with placeholder target 2026-12-22. No paid generation calls were made.
- Remaining provider setup is external: the user must choose BYOK credentials or explicitly authenticate the workspace-local Copilot CLI. This does not block offline study, the implemented provider adapters, or the completed local MVP gates.
