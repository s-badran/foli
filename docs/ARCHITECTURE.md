# Exam Workspace Architecture

## Ownership

```mermaid
flowchart TB
  Index[Workspace index / linked breadcrumb] --> Exam[Exam workspace]
  Exam --> Profile[Learner baseline / role / goal / tutor brief]
  Exam --> Sources[Exam source library]
  Sources --> Main[Selected main source]
  Sources --> Check[Supplement overlap and review]
  Check --> Accepted[Accepted related reading only]
  Check --> Excluded[Flagged/excluded - stored but not used]
  Main --> Chapters[Chapter roadmap]
  Chapters --> Lessons[Lessons / summary / cards / scenarios]
  Accepted --> Lessons
  Profile --> Plan[Chapter-ordered dated plan]
  Chapters --> Plan
  Lessons --> Progress[Reading / FSRS reviews / quizzes]
  Exam --> Directory[Own local exam directory]
  Directory --> Snapshot[Authoritative workspace.json]
  Directory --> Artifacts[Sources / prompts / chapters / plan / progress]
```

The exam is the ownership boundary, not the PDF. All entities carry the exam ID. Exactly one source can define its active curriculum; supplementary files never independently append curriculum chapters. The state API aggregates exam snapshots for the browser, but persistence is physically exam-scoped.

## Data And Storage

`Folder` is retained as the internal exam-workspace type for compatibility. It owns `mainSourceId`, learner settings, custom prompt, directory, curriculum revision and plan. `Chapter` owns its ordered title, main-source page range and description. Sections are lesson units linked to chapters. Source fragments are archived internal extraction records, not visible lessons. Historical lessons retain IDs, schedules and attempts after a revision.

Original files use server-generated names beneath each exam's `sources/`. Canonical `workspace.json` contains its source metadata, chapters, source fragments, lessons, schedules, reviews, attempts and plan. `plan.json`, `progress.json`, `prompts/study.md` and chapter files are readable projections; the application does not watch manual projection edits.

The active index is `data/exams/index.json`. If absent, the store reads the legacy `data/study.json`; the next mutation writes exam directories and copies legacy source binaries without overwriting the old file. A missing indexed workspace is an error, never silently replaced by empty state. There is no cross-process lock or atomic multi-file commit: one server owns each data directory.

## Curriculum Rules

1. First source is main by default. The learner can choose a different source from this exam only.
2. The supplied AWS slide deck is identified by its SHA-256 fingerprint. Its 28 chapter dividers are mapped to actual PDF page ranges, starting at IAM on page 24. Introductory slides are not falsely described as exam topic chapters.
3. Each mapped chapter has two original tutor-authored lessons. Each lesson has a summary, two conceptual cards and one scenario with four distinct choices and an explanation. The final chapter also consolidates architecture/exam-review topics.
4. Generic Markdown groups H2/H3 sections under their H1 chapter. Other sources use explicit Chapter/Domain/Part boundaries when present. An unreliable outline is labelled provisional; arbitrary exam questions are not fabricated.
5. Main-source changes require explicit confirmation. Active lessons are archived, chapter records are replaced and the dated plan is invalidated. Historical records are retained.
6. No current route invokes an AI provider. Old provider modules remain unused by the active product flow. Per-section cloze generation is retired.

This is a foundational authored AWS pack, not exhaustive coverage or official exam content. Main-source references are verified chapter ranges; the explanations incorporate tutor knowledge, and the provenance UI does not claim sentence-level attribution.

## Supplement Commonness

The overlap algorithm normalizes English vocabulary, removes general study/document words and compares a supplement's top distinctive terms to the main-source vocabulary. The score is shared candidate terms divided by candidate terms. Automatic acceptance requires a score of at least 0.16 plus a minimum shared-term count. This favors a narrow relevant supplement even if the main book is large.

The score is not calibrated semantic certainty. A supplement can pass vocabulary overlap yet contain incorrect claims; an unusual or multilingual source can fail despite relevance. Flagged sources are stored but excluded. Explicit acceptance/exclusion is recorded as a learner override; changing the main source resets those judgments for reassessment.

Accepted supplements are searched for chapter-topic overlap. Only matching references are attached as related reading. Exclusion immediately removes links, without replacing lesson/card IDs or destroying progress. This iteration does not dynamically rewrite tutor-authored lessons to incorporate every new document or resolve contradictions automatically.

## Personalization And Plan

The verified RemNote baseline labels are documented in its public [Guided Learn Mode](https://help.remnote.com/en/articles/15724936-guided-learn-mode) article. The article explicitly distinguishes priority from content changes. Folio follows that distinction: new learners read first; refreshers start with cards. Planning estimates are 25/15/10 minutes for new/basic/refresh lessons, with more review allocation for refreshers. Role, goal and the brief are saved tutor context, not hidden adaptive scoring.

FSRS owns card due dates; reading completion and quiz scores are independent signals. Chapter reading completion is all its lessons marked read. A recent quiz score under 80% flags a chapter for practice; this is not an automatic mastery certificate. The plan remains chapter-first and expandable, with the daily calendar secondary.

## API Map

| Route                                         | Contract                                                            |
| --------------------------------------------- | ------------------------------------------------------------------- |
| `GET /api/state`                              | Aggregate active-exam snapshots, including archived records         |
| `GET /api/workspace-folders`                  | Direct importable source folders inside the project                 |
| `POST /api/workspaces/upload`                 | Create an exam from first multipart upload and learner fields       |
| `POST /api/folders`                           | Create an empty exam with learner settings                          |
| `POST /api/import-workspace`                  | Import an existing local source folder                              |
| `POST /api/folders/:id/upload`                | Add files to the existing exam directory; return relevance warnings |
| `PATCH /api/folders/:id`                      | Save learner settings and exam brief                                |
| `PUT /api/folders/:id/main-source`            | Same-exam source ID plus `confirmRebuild: true`                     |
| `PATCH /api/folders/:id/sources/:sourceId`    | Explicitly accept or exclude a supplement                           |
| `POST /api/folders/:id/prepare`               | Upgrade legacy sources and build an exam curriculum                 |
| `PUT /api/folders/:id/plan`                   | Dated chapter-associated plan using the saved baseline              |
| `GET /api/sources/:id/file`                   | Original file from its exam directory                               |
| `PATCH /api/sections/:id`                     | Reading-completion state                                            |
| `POST /api/sections/:id/cards/:cardId/review` | Due-card FSRS grade                                                 |
| `POST /api/sections/:id/quiz`                 | Score a complete quiz server-side                                   |
| `GET /api/export`                             | JSON backup, including archived records but no binary files         |
| `DELETE /api/folders/:id`                     | Remove active index records; retain on-disk directory               |

The old generation route returns an existing tutor pack unchanged or an explicit paused/retired error; it never regenerates cloze filler. Topic-only generation returns a paused error.

## Deliberate Limits

Localhost only, no auth/profiles, no OCR, no external file paths, no public deployment, no automatic semantic chapter generation for arbitrary textbooks, no live tutor chat, no adaptive model prompt execution, no background generation queue, no cross-process transactions. These remain explicit future phases rather than simulated features.
