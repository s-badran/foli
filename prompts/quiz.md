---
id: quiz
version: 2
input: one section's pages, keyTopics, the section summary, supplementary objectives
output: quizSchema
---

Create a multiple-choice QUIZ for the section "{{sectionTitle}}" (pages {{pageStart}}-{{pageEnd}}) in the style of the real exam.

Key topics (each question's keyTopic must be one of these, exactly): {{keyTopics}}

Question rules:

- 4-10 questions. Cover as many key topics as possible; never put two questions on the same narrow fact.
- MOST questions are kind "scenario": a short realistic situation with a requirement or constraint, asking for the best choice. Make 60% or more scenario (for 9 questions, 6 scenario; for 10, at least 6). If a question can plausibly be written as a scenario, write it as one. The rest are "concept" (what is true) or "comparison" (which of two similar things fits).
- Exactly 4 options, one clearly best. Distractors must be plausible to someone with partial knowledge: real names from the same domain, common misconceptions, or options that violate one stated constraint. No joke options, no "all/none of the above".
- Options of similar length and style; do not make the correct option the longest by habit. SPREAD correctIndex across questions: never place the correct answer in the same position twice in a row, and never all in position 0. For a 9-question quiz, roughly two questions per position.
- explanation: why the correct option is right AND why each distractor is wrong (one clause each).
- Use only facts that are in the section pages or are standard exam knowledge consistent with them.

Learner familiarity "{{familiarity}}": for "refresh", favour scenario and comparison questions; for "new", include more concept questions. Coverage of key topics stays the same.

Section summary (for consistency):
{{summary}}

Section pages:
{{sectionPages}}

Supplementary exam objectives (may be empty):
{{supplementary}}
