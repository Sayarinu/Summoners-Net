# Contributing to SummonersNet

These rules apply to everyone who changes this repository, and to any coding agent working on their
behalf. Read them before starting. Setup and commands are in
[docs/development.md](docs/development.md); the release flow is in
[docs/releases/README.md](docs/releases/README.md).

## Product rules

- SummonersNet is a local-first application. It has no accounts, no operator console, no paid
  telemetry and no synthetic fallback data. Do not add any of them.
- Every value shown comes from a real source. Preserve source identifiers. When a provider fails,
  keep the last successful data and its timestamps. Missing statistics stay `null`, with explicit
  sample counts; never turn unknown values into zero.
- The browser reads PostgreSQL through the application. All provider fetches belong to the
  coordinated worker in `packages/data`; a browser action may only queue a job.

## Stack

- Node **24.12.0** and pnpm **11.10.0**, pinned in `.nvmrc` (read by CI) and in `package.json`
  (`packageManager` and `engines`). Install with `pnpm install --frozen-lockfile`.
- Exact, locked dependency versions (`save-exact`). Add a dependency only when the existing stack
  cannot reasonably do the job.
- Turborepo workspace: Next.js 16 and React 19 in `apps/web`; PostgreSQL 18 with `pg_trgm`; strict
  TypeScript 6; Vitest 4; Playwright; Storybook 10 for `packages/ui`.

## Architecture and boundaries

- `apps/web/app` routes compose feature pages and HTTP entry points only.
- Features in `apps/web/src/features` own their UI, state and presentation mappings. Feature-only
  helpers stay in the feature.
- `apps/web/src/server` owns the Next.js integration and server-only configuration, including
  cookies, environment variables and access to the data interfaces.
- `packages/data` owns the domain, providers, persistence and synchronization. It never imports
  React, Next.js or UI code. Consumers import only its exported query and sync interfaces
  (`@summonersnet/data`, `@summonersnet/data/contracts`, `@summonersnet/data/sync`). SQL and raw
  provider payloads never leave the package.
- ESLint enforces these import boundaries. Do not weaken the rules to make a change fit.
- Validate external input (HTTP bodies, query strings, files, provider responses) at the entry
  point.
- Inject clocks and `fetch` so tests control time and network.
- Reuse `packages/ui` and `packages/tokens` components and tokens before adding variants. Extract
  shared code only when there are several real consumers.
- Historical and directory queries filter and paginate in SQL, with bounded page sizes and indexes
  that support them. Schema changes are new, numbered migrations; never edit an applied migration.

## Checks

Run these before opening a pull request, and say in the PR exactly which ones ran:

```sh
pnpm verify
pnpm browser:test
```

- `pnpm verify` runs formatting, lint and boundary rules, strict type checks, token drift, the
  release script tests, unit and PostgreSQL integration tests with 80% coverage on every metric, and
  the Next.js and Storybook builds.
- PostgreSQL tests need `TEST_DATABASE_URL` pointing at a separate database named
  `esportsviewer_test`. The suites reset that database, so never point it at a library you care
  about, and run integration and browser suites one at a time.
- `pnpm browser:test` needs Playwright browsers:
  `pnpm --filter @summonersnet/web exec playwright install chromium firefox webkit`.
- Tests verify observable behavior through supported interfaces, not implementation details.
- Never leave a check failing or skipped without saying so in the PR.

## Secrets and data

- Keep credentials in the ignored `.env`. Never use `NEXT_PUBLIC_` variables for secrets, and never
  commit tokens, `.env` files, downloaded CSVs, database dumps or cached images.
- Do not touch databases or containers you did not create. Never run `docker compose down -v` on a
  populated library.

## Issues, branches and commits

- Every change starts from an issue in your tracker. Its key, such as `ABC-123`, is the identifier.
- Name the branch exactly after the identifier (`ABC-123`), with no prefix or suffix. Create it from
  `origin/experimental`, or from the branch below it when stacking dependent work.
- Commit subjects are `<ID> - <Change-specific message>`, for example
  `ABC-123 - Keep spoilers hidden after a refresh`. Describe the individual change in the
  imperative; the message need not repeat the issue title. Several small commits per branch are
  fine.
- Commit with your GitHub noreply email address (`<id>+<username>@users.noreply.github.com`), never
  a personal one. Check `git config user.email` in each new clone.
- Do not add AI or tool attribution anywhere: no `Co-Authored-By` trailers for tools, no "Generated
  with" lines and no tool mentions in commits, PR descriptions, code, comments or docs.

## Pull requests and releases

- One issue gets one pull request, titled like a commit subject. The description is a short
  plain-English summary, a bullet list of changes, and a `Validation:` line stating exactly which
  checks ran and passed.
- Ticket pull requests target `experimental` and are squash-merged. A release is a pull request from
  `experimental` into `main`, merged with a merge commit (never squash or rebase) so both branches
  keep the same history. Do not push directly to `experimental` or `main`.
- Label a pull request **Feature** for a minor version bump or **Major Release** for a major one;
  unlabeled changes release as a patch. Every merge publishes a release automatically, so merge only
  when the work is complete, review concerns are resolved and the required checks pass on the
  current head. Agents stop at a green pull request and leave merging to a maintainer.
