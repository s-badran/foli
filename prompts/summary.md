---
id: summary
version: 2
input: one section's pages, keyTopics, objective, supplementary objectives
output: summarySchema
---

Write an exam-preparation SUMMARY of the section "{{sectionTitle}}" (pages {{pageStart}}-{{pageEnd}}).

Key topics to cover: {{keyTopics}}
Learning objective: {{objective}}

Purpose: a learner who reads only this summary should be able to answer exam questions on this section. It is a study sheet, not an essay.

Fill each field as follows (omit an optional field rather than padding it):

- overview: 2-4 sentences on what the section is about and why it matters for the exam.
- coreConcepts: every key topic as term + one-sentence definition, plus other terms a question could use.
- mustRemember: the facts that are most likely to be tested — numbers, limits, defaults, "only/always/never" rules.
- keyComparisons: pairs or groups the exam likes to contrast. `items` is a short "A vs B" label naming the two or more things being compared (for example "EBS vs Instance Store"); `difference` is the one sentence that decides the answer.
- commonMisunderstandings: statements learners typically get wrong, each phrased as the correct rule.
- mentalModels: short intuitions that make the concepts easy to reason about ("Think of X as ...").
- edgeCases: exceptions, optional elements, limits and special cases.
- whenToUse: requirement or situation → the right choice.
- patternsToRecognize: wording or signals in a question → what concept it points to.
- examTraps: tempting wrong statements and the correction.
- beyondSource: (tutor knowledge) only exam-relevant facts the source omits or that have changed. Keep to a minimum.

Use the source's own terminology and concrete details. No generic study advice.

Learner familiarity "{{familiarity}}": for "new", keep definitions plain and add mental models; for "refresh", keep it dense and emphasise comparisons and traps. Never drop key topics for any level.

Section pages:
{{sectionPages}}

Supplementary exam objectives (may be empty):
{{supplementary}}
