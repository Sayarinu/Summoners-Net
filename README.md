# EsportsViewer

Private, localhost-first League of Legends schedules, results, historical games, team/player
profiles, source observations and consented watching. PostgreSQL is the application’s read model;
one coordinated worker fetches provider data. There are no accounts, operator console or synthetic
fallback records. An optional production container supports local rehearsal for a later private VPS.

## Local setup

Use Node **24.12.0** and pnpm **11.10.0**. The Node version is pinned in `.nvmrc`, `.node-version`
and `.tool-versions`; CI reads `.nvmrc`. Package engines require these exact tool versions. All
dependencies are locked to exact versions. With nvm installed:

```sh
nvm install
nvm use
pnpm install --frozen-lockfile
cp .env.example .env # only for a new checkout; preserve an existing .env
chmod 600 .env
docker compose up -d
# Once, create the separate database reserved for destructive test fixtures:
docker compose exec postgres createdb -U esportsviewer esportsviewer_test
pnpm build
pnpm db:migrate
pnpm sync:once
pnpm start
```

Open <http://127.0.0.1:3000>. Run `pnpm sync` in another terminal for continuous refreshes.
`pnpm dev` starts the development server instead. Both servers bind to loopback. This repository’s
Compose service exposes PostgreSQL only on `127.0.0.1:55442` and owns a dedicated volume. Leave
other databases and containers alone. Never use `docker compose down -v` to stop a populated
library.

Set `PANDASCORE_TOKEN` in the ignored `.env`. Anonymous Google Drive downloads of the popular
current-year CSV are often quota-blocked; set `GOOGLE_DRIVE_API_KEY` to a Google Cloud API key with
the Drive API enabled and the worker downloads the same official file through the Drive API first.
Quota-blocked downloads are retried later. Set `ORACLE_CURRENT_FILE` to the absolute path of a
current annual Oracle’s Elixir game CSV if available. None of these values is sent to the browser.
No `NEXT_PUBLIC` credentials are used. Data Dragon needs no key. The application is usable with
historical imports even without a PandaScore token; the source page explains missing refreshes.

## Imports and refreshes

```sh
pnpm history:import 2024 /absolute/path/2024_LoL_esports_match_data_from_OraclesElixir.csv
pnpm history:import-dir /absolute/path/to/annual-csv-directory
pnpm history:backfill-all
pnpm backfill 2014
pnpm sync:once
pnpm sync:status
```

`history:import` and `backfill` enqueue work; `sync:once` schedules due work once and drains
currently available jobs. Deferred jobs stay queued until their retry time. `sync` runs
continuously. Use `history:import`, or `pnpm run import`, because `pnpm import` is pnpm’s own
lockfile conversion command. The Sources page accepts a local annual CSV upload and exposes queued
manual refresh. Uploaded files are stored privately under ignored `.local/imports`; the worker
validates and imports them.

`history:backfill-all` enqueues every reviewed official annual file ID from 2014–2026;
`history:import-dir` enqueues year-named CSVs already downloaded from the official archive. The
worker follows Google Drive's large-file confirmation only for the matching official file ID.
Private, content-addressed source files and PostgreSQL import provenance retain the exact bytes,
header, warnings and row counts. The archive stores all leagues; existing pages remain the curated
nine-competition projection. Exported `historicalGames`, `historicalGame`, `historicalSummary` and
`historicalCoverage` queries expose bounded, provider-neutral archive reads without raw source rows.

Imports validate the whole file before committing atomically. Reimporting the same data does not
create duplicate games; corrected records replace the same source IDs and their participant rows.
Absent games are retained: omission from a file is not proof of deletion. HTML/quota responses and
aggregate summary exports are rejected. Files are bounded at 256 MiB. Current-year local-file
refresh rereads that file; it does not update the file itself. Coverage reports the latest actual
game date. Older-year backfills are explicit, never automatic.

## Verification

```sh
pnpm verify
pnpm --filter @esportsviewer/web exec playwright install chromium firefox webkit
pnpm browser:test
```

`verify` runs formatting, lint/boundary rules, strict TypeScript, token drift, four-metric 80%
coverage, PostgreSQL tests, and Next/Storybook builds. It requires `TEST_DATABASE_URL` ending in
`/esportsviewer_test`. Integration and browser suites reset only that test database; run them
sequentially. Browser acceptance runs the production build on port 3100, uses labeled test fixtures
and blocks/mocks external players. Application startup never seeds test data.

The GitHub workflow repeats those checks with PostgreSQL 18.4 and all three browser engines. Local
success does not by itself claim a remote CI run succeeded.

- [Architecture and source boundaries](docs/architecture.md)
- [Coverage policy](docs/coverage.md)
- [Acceptance evidence and external blockers](docs/acceptance.md)
- [Official 2014–2026 archive backfill evidence](docs/oracle-archive-2026-09-23.md)
- [Reviewed library provenance](docs/provenance.md)
- [Linear reconciliation](docs/linear-reconciliation.md)
- [Local containers, backups and future VPS preparation](docs/vps-preparation.md)

Original copyright and licensing remain in [LICENSE](LICENSE).

Entity linking and local portraits/logos are described in
[Entity resolution and images](docs/entity-resolution.md), including bounded catalog refresh and
historical roster commands.
