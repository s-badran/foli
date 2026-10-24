# RemNote Screenshot Analysis (AWS SAA-C03 example)

Reference screenshots live in `docs/remnote_ss/`. This document captures what RemNote does, what we already match, what is future work, and what we deliberately skip. Re-read this before each methodology revision so we compare against the same evidence.

## Screenshot inventory

| File | What it shows |
| --- | --- |
| `1-main-screen.png` | Folder "AWS Certified Solutions Architect Associate 2026" containing the slides deck and exam guide documents; AI-credit meter in sidebar. |
| `2-main-screen-practice-cards.png` | "Practice with Spaced Repetition" menu: practice all, practice in order (Pro), Priority, Exam Date, Statistics, Card Table; "48 Due" badge. |
| `3-Slides-source-learning-page-study-plan.png` | Guided Learn study plan: source broken into sections, per-section actions. |
| `4-Slides-source-learning-page-mastery-tracker.png` | Mastery tracker with per-topic breakdown and Customize Topics. |
| `5-...-summary-part1..6.png` | The section summary split into named blocks. |
| `6-Slides-source-section-sammary.png` | A single section's summary with the source reader on the side. |
| `7-Slide-source-section-flashcards1/2.png` | Section flashcards grouped by concept. |

## Feature-by-feature observations

### 1. Subject = folder of sources
RemNote creates one folder per subject that holds multiple documents (slides + exam guide). We match this: one exam workspace, one main source, accepted supplements in the same directory.

### 2. Practice menu exposes scheduling knobs
"Practice All", "Practice in order", **Priority**, **Exam Date**, **Statistics**, **Card Table**, and a due badge at document and folder level.

- Due count at document + folder level: we have chapter/section due counts; a workspace-level due total is present but could be surfaced more like this.
- **Priority + Exam Date** drive ordering. We order by exam date and plan days. Explicit per-chapter priority tagging is future work.
- Statistics / card table: future work (we have per-attempt history).

### 3. Per-section actions: one button per artifact
Each study-plan section has separate "Read summary", "Generate cards", "Generate quiz" actions — not one "generate everything" button. Sections are generated lazily ("Generate next sections") for large sources.

- We match the separate-buttons model (`Generate sections`, then per-section `Generate summary/flashcards/quiz`).
- We match lazy generation (sections per chapter on request; no batch of the whole 879-page deck at once).
- Conclusion on the user's question: separate prompts per artifact improve quality **and** control cost. A single request that emits summary + cards + quiz at once splits the model's attention, mixes formats in one completion, and makes failures all-or-nothing. Per-artifact requests give each a focused schema and isolated validation/retry. RemNote's per-button UI is consistent with both monetization and quality; the design does not require choosing one explanation.

### 4. Summary is a structured study sheet
The summary is broken into named, reusable blocks: Overview, Core Concepts (term + definition), Must Remember, Key Comparisons (A vs B → difference), Common Misunderstandings (claim + correction), Mental Models, Exceptions & Edge Cases, When to Use Which, Patterns to Recognize (signal → indicates), Exam Traps (trap → correction), plus a labelled "tutor knowledge" area.

- Our `summarySchema` + `renderSummary` already mirror this structure. Reuse this list when revising the summary prompt; do not invent new block names.
- RemNote also has a "Test Your Knowledge" side panel of short-answer questions generated from the summary. Future work: a summary-questions artifact.
- "Read PDF/Document" jumps to the exact source pages. We match via source iframe + page references.

### 5. Flashcards are grouped and concise
Cards are grouped under a concept heading and keep short Q→A, with enumeration answers where the fact is a list.

- We match: cards carry `group`, concise question/answer, list answers rendered as newline lists.
- RemNote's card explanations are optional per card; we keep explanations in quiz answers and summaries, which is sufficient for the MVP.

### 6. Mastery tracker
Overall mastery %, sections read, per-topic breakdown, and "Customize Topics" to include/exclude topics, plus "Skip section entirely".

- We have per-chapter preparation and per-section practice status. Topic-level mastery and topic/chapter include/exclude controls are future work (candidate features beyond the MVP).

### 7. Baseline question
"Set your baseline: how well do you know this content?" with "Haven't learned it yet", "I have a basic understanding", "Know it well and just want to review". Verified in RemNote's public Guided Learn Mode help article. It changes priority (which action comes first), not the content. We match this exactly; see the README personalization table.

## What we deliberately skip for the MVP

- AI-credit meter and Pro gating (we are local-first; no metering).
- Priority labels and in-order practice (ordering is exam-date driven today).
- Summary short-answer "Test Your Knowledge" panel.
- Topic customization and skip-chapter controls.
- Statistics dashboard and card table.

## Non-goals (do not copy)

- Exact UI layout, wording, or visual assets. We implement the *concept* (folder of sources → sections → per-artifact study materials → spaced practice), not the pixels.
- RemNote's product-specific copy (e.g., "Time to Get Started!").
