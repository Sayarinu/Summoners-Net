# Development

This guide covers running SummonersNet from source, importing data and running the checks. For the
production containers, backups and remote access, see [Self-hosting](self-hosting.md). For the rules
every change follows, see [AGENTS.md](../AGENTS.md).

## Requirements

- Node **24.12.0** and pnpm **11.10.0**. The Node version is pinned in `.nvmrc`, `.node-version` and
  `.tool-versions`; CI reads `.nvmrc`. Package engines require these exact versions, and every
  dependency is locked to an exact version.
- Docker with Compose, for the repository's PostgreSQL 18 service. Any PostgreSQL 18 server with the
  `pg_trgm` extension also works.
- Optional: a free [PandaScore](https://pandascore.co) token for schedules, results, rosters and
  broadcasts.

## Local setup

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
`pnpm dev` starts the development server instead. Both servers bind to loopback. This repository's
Compose service exposes PostgreSQL only on `127.0.0.1:55442` and owns a dedicated volume. Leave
other databases and containers alone. Never use `docker compose down -v` to stop a populated
library.

The PostgreSQL role, database and volume names (`esportsviewer`, `esportsviewer_test`,
`esportsviewer_data`) predate the project's current name. They are kept so existing libraries keep
working.

## Configuration

All settings live in the ignored `.env`; see `.env.example`.

| Variable               | Purpose                                                                                       |
| ---------------------- | --------------------------------------------------------------------------------------------- |
| `DATABASE_URL`         | The application database.                                                                     |
| `TEST_DATABASE_URL`    | A separate database ending in `/esportsviewer_test`, reset by integration and browser tests.  |
| `PANDASCORE_TOKEN`     | Enables schedule, result, roster and broadcast refreshes. Without it, history still works.    |
| `GOOGLE_DRIVE_API_KEY` | A Google Cloud API key with the Drive API enabled, used when anonymous downloads are blocked. |
| `ORACLE_CURRENT_FILE`  | Absolute path to a current-year Oracle's Elixir CSV that the daily refresh rereads.           |

Anonymous Google Drive downloads of the popular current-year CSV are often quota-blocked. With
`GOOGLE_DRIVE_API_KEY` set, the worker downloads the same official file through the Drive API first.
Quota-blocked downloads are retried later. None of these values is sent to the browser, and no
`NEXT_PUBLIC` variables are used. Data Dragon needs no key. The Sources page explains missing
refreshes.

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
continuously. Use `history:import`, or `pnpm run import`, because `pnpm import` is pnpm's own
lockfile conversion command. The Sources page accepts a local annual CSV upload and exposes queued
manual refresh. Uploaded files are stored with owner-only permissions under ignored
`.local/imports`; the worker validates and imports them.

`history:backfill-all` enqueues every reviewed official annual file ID from 2014–2026;
`history:import-dir` enqueues year-named CSVs already downloaded from the official archive. The
worker follows Google Drive's large-file confirmation only for the matching official file ID.
Content-addressed local source files and PostgreSQL import provenance retain the exact bytes,
header, warnings and row counts. The archive stores all leagues; the pages show the curated
nine-competition projection described in [Coverage](coverage.md).

Imports validate the whole file before committing atomically. Reimporting the same data does not
create duplicate games; corrected records replace the same source IDs and their participant rows.
Absent games are retained: omission from a file is not proof of deletion. HTML/quota responses and
aggregate summary exports are rejected. Files are bounded at 256 MiB. Current-year local-file
refresh rereads that file; it does not update the file itself. Older-year backfills are explicit,
never automatic.

Entity linking, local portraits and logos, and the catalog and roster commands are described in
[Entity resolution and images](entity-resolution.md).

## Checks

```sh
pnpm verify
pnpm --filter @summonersnet/web exec playwright install chromium firefox webkit
pnpm browser:test
```

`pnpm verify` runs formatting, lint and import-boundary rules, strict TypeScript, token drift, the
release script tests, unit and PostgreSQL integration tests with 80% coverage on all four metrics,
and the Next and Storybook builds. It requires `TEST_DATABASE_URL` pointing at a database named
`esportsviewer_test`. Integration and browser suites reset only that database; run them one at a
time.

`pnpm browser:test` runs the production build on port 3100 against labeled test fixtures in
Chromium, mobile Chromium, Firefox and WebKit, and blocks or mocks external players. Application
startup never seeds test data.

The GitHub workflow runs the same checks with PostgreSQL 18.4 and all browser engines on every pull
request. Local success does not by itself mean a remote CI run succeeded.

## Further reading

- [Architecture and source boundaries](architecture.md)
- [Competition and statistics coverage](coverage.md)
- [Entity resolution and images](entity-resolution.md)
- [Self-hosting, backups and restore](self-hosting.md)
- [Branches and releases](releases/README.md)
- [UI library provenance](provenance.md)
