# MVP Verification Record

## Verified Locally

- `pnpm check`: ESLint, strict TypeScript, 27 unit/API/provider tests, and Vite production build pass.
- `PLAYWRIGHT_BROWSERS_PATH=.cache/ms-playwright pnpm test:e2e`: three serial Chromium acceptance workflows pass against isolated project-local data.
- Both provided PDFs extract successfully: 879-page slides plus 30-page exam guide, 109 combined sections. Original binary downloads begin with `%PDF`, and previews appear in the source view.
- A Markdown upload becomes a section, generates an offline study pack, reveals a flashcard, accepts a grade, records the next due date, scores a complete quiz, and saves reading progress.
- Reading completion, reviews, quizzes and the dated plan survive reloads.
- Desktop screenshots (1440 x 1000) and mobile screenshots (390 x 844) inspected. No horizontal page overflow in tested mobile overview and flashcard views. Summary text and numbered takeaways were adjusted after inspection.
- New cards are immediately reviewable rather than waiting for a clock refresh.
- The actual development app's Vite-to-API proxy was checked at http://127.0.0.1:5173 with API port 43126. Its real store contains both PDFs, 109 sections, two extractive starter packs and a placeholder 2026-12-22 target at 45 minutes/day. The embedded browser displayed the overview with no horizontal overflow at its 999-pixel viewport; repeatable desktop/mobile coverage remains in Playwright.
- The test server owns `.cache/e2e-data` on port 43127; real study data is not used by tests. Browser binaries live in `.cache/ms-playwright`.
- Git ignores PDF/ZIP materials, data, caches, IDE workspace files, and environment files. No remote or push operation was performed.

## Test Coverage

| Slice         | Verified Scenarios                                                                                                                                                                                                                     |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Documents     | Heading boundaries, empty rejection, long-content preservation, unbroken lines, UTF-8 notes                                                                                                                                            |
| Study content | Grounded extracts, distinct quiz options, JSON fences, malformed/incomplete model rejection                                                                                                                                            |
| Scheduling    | FSRS persisted state, future successful reviews, invalid grades, every unread section scheduled once, overload warning, past-date rejection                                                                                            |
| API           | Create subject, upload, persisted reload, generate, original files in hidden data directory, review/double-review prevention, quiz score, history protection, plan, completion, traversal rejection, invalid input, cascading deletion |
| Provider mock | Source context and model ID sent, authorization forwarding, no key in result, supplement provenance, topic-only prompt, invalid JSON failure, upstream quota errors                                                                    |
| Browser       | Real PDF import and binary viewing; full upload-to-quiz practice; plan/progress/reload and mobile layout                                                                                                                               |

## Not Verified / Deliberately Deferred

- Real provider response quality, spend, rate limits, and provider-specific endpoint compatibility. No paid requests were made; the OpenAI-compatible contract is exercised against a local mock.
- GitHub Copilot login, account entitlement, model availability, and live generation. The SDK code compiles, uses supported installed API types, and denies tools, but requires your explicit authentication.
- OCR/image-only PDFs, semantic chapter alignment, non-Chromium PDF viewers, multiple concurrent API processes, public deployment, crash/power-loss durability, and recovery from arbitrary schema-corrupt backups.
- Study-time estimates and quiz scores are not validated predictors of exam performance.

## Dependency Notes

The production build succeeds with harmless Rollup notices about pure annotations inside the installed Zod dependency. pnpm warns that this ESLint 9 release is deprecated in favor of a newer major. These do not fail the gates; upgrading major tool versions is separate maintenance, not part of MVP behavior.

The first pnpm install used the machine's existing package store before pnpm 12's workspace YAML configuration was added. Subsequent installs use the project-local store/cache. No global software was installed, no sudo command was run, and original materials were left unchanged.

## Screenshots

Generated, ignored artifacts under `.cache/screenshots/`:

- `aws-library-desktop.png`
- `section-summary-desktop.png`
- `progress-desktop.png`
- `overview-mobile.png`
- `flashcards-mobile.png`
