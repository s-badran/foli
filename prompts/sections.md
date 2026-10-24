---
id: sections
version: 1
input: one chapter's pages, chapter examFocus, supplementary objectives
output: sectionsSchema
---

Split the chapter "{{chapterTitle}}" (pages {{pageStart}}-{{pageEnd}}) into SECTIONS a learner can study in one sitting (about 10-25 minutes each).

Method:

1. Follow the chapter's own sub-headings and slide titles. Merge consecutive pages about the same concept; split where the concept changes.
2. Prefer 1-6 sections per chapter. A short chapter can be a single section.
3. Sections must be contiguous, non-overlapping and cover every teaching page in the range. Skip only pages that are purely navigational (for example a hands-on demo title slide with no content).
4. keyTopics: 2-10 short noun phrases naming the testable concepts in the section, in source order. These become the coverage checklist for flashcards and quizzes, so include every concept a learner must be able to recall or apply — not only the headline.
5. objective: one sentence starting with a verb ("Distinguish...", "Choose...", "Explain...") describing what the learner should be able to do on the exam.

Chapter exam focus:
{{examFocus}}

Chapter pages:
{{chapterPages}}

Supplementary exam objectives (may be empty):
{{supplementary}}
