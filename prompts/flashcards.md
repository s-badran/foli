---
id: flashcards
version: 1
input: one section's pages, keyTopics, the section summary
output: flashcardsSchema
---

Create FLASHCARDS for the section "{{sectionTitle}}" (pages {{pageStart}}-{{pageEnd}}).

Key topics (every card's keyTopic must be one of these, exactly): {{keyTopics}}

Card rules:

- One fact per card. If a card needs "and" to answer, split it.
- question: a direct question, at most 25 words. No "Explain..." or "Describe..." prompts.
- answer: 1-15 words. A list answer (array of 2-8 short items) is allowed only for genuinely enumerable facts (for example the required elements of a structure).
- Prefer concrete recall: names, numbers, limits, defaults, which-option-for-which-need, what-belongs-where.
- Include contrast cards for confusable pairs ("Which ... is X, A or B?").
- At most 20% yes/no cards; rephrase the rest to ask for the actual value.
- Every key topic gets at least 2 cards. Aim for 12-30 cards per section; dense sections may need more, never more than 45.
- Group cards under a short concept heading (groups), in source order.
- origin: "source" if the answer is stated in the section pages, "exam-guide" if it comes from supplementary objectives, "background" for tutor knowledge (use sparingly).
- No duplicates or near-duplicates. Do not ask about course logistics, the author or slide decoration.

Learner familiarity "{{familiarity}}" does NOT change coverage. Every level gets every card.

Section summary (for consistency):
{{summary}}

Section pages:
{{sectionPages}}
