# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

This is the OpenAPI Initiative's tooling repository. It has two halves:

1. **Data build** — collects OpenAPI-related tooling info from multiple sources (GitHub topics, curated markdown lists, GitHub issues), merges/normalises/classifies it, and writes the result to `src/_data/tools.yaml`.
2. **Site build** — a static site (Eleventy + Webpack/Tailwind) that reads `src/_data/tools.yaml` and renders it, publishing to `docs/` for GitHub Pages at https://tools.openapis.org/.

Package manager is Yarn (`packageManager: yarn@1.22.19`).

## Commands

```bash
yarn install

# Data build (writes src/_data/tools.yaml)
yarn run build:data:full       # gulp full: pull from all sources, merge, classify, write tools.yaml
yarn run build:data:metadata   # gulp metadata: refresh GitHub metadata for existing entries only, no new sources

# Site build (reads src/_data/tools.yaml, writes docs/)
yarn run build:site            # clean + webpack + eleventy + CNAME, all together
yarn run build:all             # build:data:full then build:site

# Local dev server (watches and rebuilds site on change)
yarn run serve

# Tests
yarn test                      # mocha over test/unit, recursive, 10s timeout
yarn run coverage               # nyc + mocha, HTML+text reports in coverage/
yarn run coverage:desktop       # coverage, then opens coverage/index.html

# Run a single test file
NODE_ENV=test npx mocha --exit --timeout 10000 test/unit/lib/data/transform/normalise-sources.js

# Lint
npx eslint .                   # airbnb-base config (.eslintrc.yml); node+mocha envs, no-console and radix rules off
```

### Required environment variables (data build only)

The data build calls the GitHub API and needs basic auth credentials:

| Variable | Purpose |
|---|---|
| `GH_API_USERNAME` | GitHub username |
| `GH_API_TOKEN` | Personal access token |
| `GH_API_CONCURRENCY_TOKEN` (a.k.a. `GH_API_CONCURRENCY_LIMIT`) | Concurrent API connections; keep at 2 or the API starts returning 403s |

Non-sensitive build config lives in `gulpfile.js/.env` (loaded via `dotenv`, path overridable with `--env-file`). Site-build-only var: `HOSTED_AT` sets the root URI for the "Home" link (needed because GitHub Pages serves this at a subpath); leave unset for normal local work.

Useful gulp CLI flags (see `gulpfile.js/index.js`): `--metadata <file>` (alternate source config, default `gulpfile.js/metadata.json`), `--env-file <file>`, `--output-dir <dir>` (default `src/_data`), `--dry-run` (skip closing GitHub issues during the build).

## Architecture

### Data build: Gulp as a thin wrapper over `lib/data`

Gulp is intentionally kept dumb so the build tool can be swapped later. `gulpfile.js/index.js` only wires together pipeline stages defined in `lib/data/`; **all actual logic belongs in `lib/`, never in `gulpfile.js`**. Pipeline stages are plain `(data) => data` transform functions run through `gulp-transform`, chained with `.pipe()`, and the data flowing between them is always YAML (readable/diffable by humans at every stage).

Two gulp tasks share most of the same pipeline shape:

- **`full`** (`build:data:full`): `validateMetadata → readSourceData → [dump raw-sources.yaml to build/] → mergeSources → normaliseSources → getRepositoryMetadata → classifyTools → purgeSources → closeToolingIssues → tools.yaml`
- **`metadata`** (`build:data:metadata`): `validateMetadata → readLocalSourceData → getRepositoryMetadata → purgeSources → tools.yaml` — refreshes metadata for existing entries without pulling in new sources.

Key modules under `lib/data/`:
- `processors/` — one file per data source (e.g. `tagged-repository-processor.js` for GitHub-topic-tagged repos, `openapi-implementations-md-processor.js` for a curated markdown list, `open-tooling-repository-issues.js` for issue-sourced submissions, `master-processor.js` for the existing `tools.yaml`). Which processors run is driven entirely by `gulpfile.js/metadata.json` (array of `{ title, processor, ...source-specific config }`), validated against the JSON Schema in `lib/data/transform/validate-metadata.js`. Adding a source means writing a new processor and registering it here — no gulpfile changes needed.
- `transform/` — the pipeline stage implementations: `merge-sources.js` (dedupes/combines by repo name), `normalise-sources.js` (reconciles differing property names across sources using Sørensen–Dice / Damerau–Levenshtein string similarity), `get-repository-metadata.js` (GitHub API enrichment), `classifer.js`/`classify-tools.js` (Bayesian categorisation, via the `bayes` package), `purge-sources.js`, `close-tooling-repo-issues.js`.
- `repo/github.js` — GitHub API access (GraphQL via `graphql-request`).

To test a source or transform in isolation, point `--metadata` at a custom config file containing just the processor(s) you want, and optionally point the `master` processor's `url` at a smaller local `tools.yaml`.

### Site build: Eleventy + Webpack, driven by JS in `src/_data`

- Eleventy (`.eleventy.js`) reads `src/` and writes `docs/`. It loads `.yaml` data files via a custom data extension, and exposes `lib/site` helpers as Nunjucks filters (`categoriesWithCount` → `get-categories-with-count.js`).
- `src/_data/tools.yaml` is the build artifact produced by the data build above; `src/_data/tooling.js` and `src/_data/categories.js` are JS data files that transform it further for template consumption (e.g. `categories.js` uses `lib/site/get-tools-by-category.js` to drive per-category pages).
- Page templates are Nunjucks (`.njk`) — `src/index.njk`, `src/categories.njk`, plus shared partials in `src/_includes/`.
- Same separation-of-concerns as the data build applies: put transformation logic in `lib/site/*.js`, wire it into a `src/_data/*.js` file, and unit test the `lib/site` package in `test/unit/lib/site`.
- Webpack (`webpack.config.js`) bundles `src/scripts/index.js` and CSS (Tailwind via `postcss.config.js`, config in `tailwind.config.js`) into `docs/assets/`.
- `yarn run serve` runs Webpack (watch mode) and Eleventy (`--serve`) in parallel against `src/`.

### CI

GitHub Actions workflows in `.github/workflows/`: `full.yaml` runs the full data build weekly (Sunday), `metadata.yaml` runs the metadata-only refresh daily, `site.yaml` handles the site build/publish. Both data workflows commit the regenerated `src/_data/tools.yaml` and trigger a site rebuild.

## Testing conventions

- Framework: Mocha + Chai (`chai-as-promised` for promise assertions) + Sinon for stubs, run with `NODE_ENV=test`.
- Test layout mirrors source layout: `test/unit/lib/data/...` and `test/unit/lib/site/...` map 1:1 to `lib/data/...` and `lib/site/...`.
- Fixture/sample data lives under `test/data/`, mirroring the same `lib/data` / `site` split.
- New `lib/data` or `lib/site` packages should come with a corresponding unit test in the matching `test/unit/...` path — this is the established pattern, not an incidental convention.
