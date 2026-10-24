---
id: outline
version: 1
input: whole main source (page-numbered), supplementary exam objectives
output: outlineSchema
---

Build the CHAPTER outline of the main source.

Method:

1. Look for the source's own table of contents, chapter/section dividers, numbered headings or "Part"/"Module"/"Domain" markers. If one exists, follow it exactly: same order, same chapter granularity, the source's own titles (lightly cleaned).
2. Locate each chapter's first page in the page-numbered text and set pageStart/pageEnd so chapters are contiguous and non-overlapping.
3. Front matter (cover, disclaimer, author bio, course logistics, coupons), "congratulations"/closing pages and pure navigation pages go into excludedPages with a short reason. An introductory chapter that teaches examinable content (for example foundational concepts) is a real chapter — do not exclude it.
4. Only if the source has no usable structure: group pages into coherent chapters of roughly similar size by topic shifts.
5. description: one or two sentences on what the chapter teaches.
6. examFocus: up to 6 short bullets naming what the exam objectives emphasise for this chapter (from supplementary sources). Empty if none apply.

Page-numbered main source:
{{sourcePages}}

Supplementary exam objectives (may be empty):
{{supplementary}}
