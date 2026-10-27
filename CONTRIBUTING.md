# Contributing to Folio

Thanks for taking a look. Folio is a local-first exam study workspace, maintained as an open-core project: bug reports, feedback and focused fixes are welcome. Large features should be discussed before work starts.

## Before you start

- Open an issue before a non-trivial pull request. Schema changes, new artifact types, prompt rewrites and changes to preparation rules all need agreement first.
- Keep one concern per pull request and explain the behaviour change and how you verified it.
- By opening a pull request you agree to the [Contributor License Agreement](CLA.md). Say so in the PR description (see [Licensing](#licensing)).

## Development setup

Requirements: Node.js 24+ and pnpm 12 (`corepack enable` if needed).

```sh
pnpm install
pnpm dev
```

The API and Vite client start together. Open the Vite URL, normally <http://127.0.0.1:5173/>. Study data is created under `data/` on first use.

AI generation is optional. For a hosted model, create a gitignored `.env` with `DEEPSEEK_API_KEY` or `OPENAI_API_KEY` (see the README's **AI Models** section). Ollama works without a key. The test suites never need credentials.

## Quality gates

Run both before opening a pull request:

```sh
pnpm check       # ESLint, tsc --noEmit, Vitest, production build
pnpm test:e2e    # Playwright/Chromium end-to-end workflows
```

Add or update tests for behaviour changes. Check UI changes at desktop and mobile widths. Do not weaken or skip a check to make a change pass.

## Code and content conventions

- TypeScript strict mode. Keep `shared/` free of React and Node-only imports.
- Artifact schemas live in `shared/artifacts.ts`; model-output normalisation lives in `shared/normalize.ts`.
- Prompts are versioned files in `prompts/*.md`. Bump `version` in the frontmatter whenever the prompt changes so generated material can be identified and regenerated.
- Keep the app exam-neutral: AWS is sample data, never a branch in logic.
- All model access goes through `AiModel` (`server/ai/model.ts`); providers register behind the `AiProvider` interface.
- Persisted-state changes need a migration path in `server/store.ts` and a test.

## Data, secrets and licensing

- Never commit `.env` files, API keys, source PDFs or personal exam material. `.gitignore` already excludes them.
- Do not submit third-party course content or exam dumps.
- Report security issues privately through GitHub Security Advisories, not in a public issue.

## Licensing

The project is released under [AGPL-3.0-only](LICENSE). To keep future dual and commercial licensing possible, every contributor must agree to the [Contributor License Agreement](CLA.md). Add the sentence `I agree to the CLA` to your pull request description. You retain copyright to your contribution.

## Pull request checklist

- [ ] One focused change with a clear description
- [ ] `pnpm check` passes
- [ ] Relevant browser workflows pass (`pnpm test:e2e`)
- [ ] Tests cover the new behaviour
- [ ] Docs and prompt versions updated when behaviour changed
- [ ] `I agree to the CLA` included

## Community

Be respectful and constructive. Harassment, discrimination and bad-faith arguments are not welcome; maintainers may close or lock threads that ignore this.
