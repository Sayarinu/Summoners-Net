<div align="center">

# SummonersNet

**A local-first League of Legends esports viewer.**

Schedules, results, more than a decade of historical games, team and player profiles and consented
live watching for the major leagues, in a fast web app that runs on your own machine. No accounts,
no telemetry, and no made-up data: everything you see comes from PostgreSQL, filled by one
coordinated worker.

[![Latest release](https://img.shields.io/github/v/release/Sayarinu/SummonersNet?label=release&sort=semver)](https://github.com/Sayarinu/SummonersNet/releases/latest)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
![Node 24.12.0](https://img.shields.io/badge/node-24.12.0-339933)
![PostgreSQL 18](https://img.shields.io/badge/PostgreSQL-18-4169E1)

[Features](#features) · [Getting started](#getting-started) · [How it works](#how-it-works) ·
[FAQ](#faq) · [Contributing](#contributing)

</div>

---

## Features

### Matches

- **Live, upcoming and recent series** grouped by day in your timezone, with live matches first.
- **Filters** for league, date, status and free text, applied as you type.
- **Watch inline.** Pick the Twitch or YouTube broadcast; nothing loads until you choose to load it,
  and a direct link stays available when an embed refuses to play.
- **Spoiler control.** Hide scores, winners and game statistics until you reveal them, per match.

### History

- **A game archive** built from Oracle's Elixir annual files, from 2014 to the current season, with
  year, league and text filters on bounded, server-side pages.
- **Played lineups** for every game: teams, players, roles, champions, K/D/A and results.
- **Nine competitions:** LCK, LPL, LEC, LCS, LCP, Worlds, MSI, First Stand and the Esports World
  Cup, including their regional predecessors (such as EU LCS, NA LCS, LMS and LTA North). Academy,
  second-tier and other regional leagues are excluded.

### Teams and players

- **Directories** that list recently active teams and players first.
- **Profiles** with the latest observed roster, every historical appearance and summary statistics
  (win rate, KDA and champion usage) computed over the whole filtered sample, with sample counts.
- **Careful identity linking.** Oracle's Elixir and PandaScore records are joined only with
  corroborating lineups or fixtures; ambiguous identities stay separate. Logos and portraits are
  cached locally.
- **One search** across teams, players, matches and games.

### Your library

- **Sources & imports** shows data freshness, queues manual refreshes, accepts annual CSV uploads
  and reports identity and image coverage.
- **Preferences** for timezone (detected automatically) and spoilers, saved in a cookie.
- **Missing stays missing.** Unknown statistics are shown as unknown, never as zero, and the last
  successful data survives provider failures.

## Getting started

### Requirements

- Node **24.12.0** (pinned in `.nvmrc`) and pnpm **11.10.0** (pinned by `packageManager` in
  `package.json`; `corepack enable` picks it up).
- Docker with Compose, for the repository's PostgreSQL 18 service. Any PostgreSQL 18 server with the
  `pg_trgm` extension also works.
- Optional: a free [PandaScore](https://pandascore.co) token for schedules, results, rosters and
  broadcasts. Without it, the historical archive still works.

### Run from source

```sh
git clone https://github.com/Sayarinu/SummonersNet.git
cd SummonersNet
pnpm install --frozen-lockfile
cp .env.example .env && chmod 600 .env   # once; keep an existing .env
docker compose up -d                     # PostgreSQL on 127.0.0.1:55442
pnpm build                               # the app and CLI run from the built packages
pnpm db:migrate
pnpm history:backfill-all                # queue the official 2014–present archive
pnpm sync:once                           # process queued work once
pnpm start                               # or `pnpm dev` for the development server
```

Open <http://127.0.0.1:3000>. Keep `pnpm sync` running in another terminal for continuous refreshes.
Everything binds to loopback. Stop PostgreSQL with `docker compose stop`; never use
`docker compose down -v` on a library you want to keep.

Settings live in the ignored `.env` (see `.env.example`): `DATABASE_URL`, `TEST_DATABASE_URL`,
`PANDASCORE_TOKEN`, `GOOGLE_DRIVE_API_KEY` (used when anonymous Google Drive downloads are
quota-blocked) and `ORACLE_CURRENT_FILE` (a local current-year CSV that the daily refresh rereads).
None of them reach the browser.

To import annual CSVs you already have, use `pnpm history:import 2024 /absolute/path/file.csv` or
`pnpm history:import-dir /absolute/path/to/dir` (not `pnpm import`, which is a pnpm command), then
`pnpm sync:once`. `pnpm sync:status` shows the queue. The **Sources & imports** page also accepts
uploads.

The checks and the test database setup are in [AGENTS.md](AGENTS.md#checks).

### Self-hosting

`deploy/Dockerfile` builds a production image (Next's standalone server plus the worker), and
`deploy/compose.app.yaml` adds `migrate`, `web` and `worker` services to the root `compose.yaml`. On
a fresh server, set a new `POSTGRES_PASSWORD` and matching `DATABASE_URL` and
`CONTAINER_DATABASE_URL` in `.env` first. From the repository root:

```sh
docker compose -f compose.yaml -f deploy/compose.app.yaml build
docker compose -f compose.yaml -f deploy/compose.app.yaml up --no-build -d --wait
curl --fail http://127.0.0.1:3000/api/health
```

Migrations run before the web and worker start, and only the worker receives the PandaScore token.
Ports bind to loopback; from another machine, use an SSH tunnel
(`ssh -N -L 3000:127.0.0.1:3000 user@server`). Back up with
`docker compose exec -T postgres pg_dump -U esportsviewer -d esportsviewer --format=custom > library.dump`
and keep your annual CSVs. To build the image alone, run `docker build -f deploy/Dockerfile .` from
the repository root.

## How it works

```text
 PandaScore ──────┐
 Oracle's Elixir ─┼─▶ worker ───────▶ PostgreSQL ───────▶ Next.js app ───────▶ your browser
 Data Dragon ─────┘   packages/data   read model          apps/web
                      one queue,      games, profiles,    reads only,
                      rate-limited    images, jobs        localhost
```

- **One worker fetches everything.** A PostgreSQL-coordinated queue runs one synchronization at a
  time, retries failed requests later and never exceeds 600 PandaScore requests per hour.
- **The app only reads.** Pages query PostgreSQL through `packages/data`; a refresh button just
  queues a job. The browser never calls a provider API.
- **Imports are atomic.** A whole annual file is validated before one transaction applies it, so a
  broken download can't replace good data.

- **Identities are linked only on evidence.** Names never merge records by themselves; every source
  identifier is kept, and team and player images are cached in PostgreSQL by the worker.

## FAQ

**Do I need a PandaScore account?** No. The historical archive comes from Oracle's Elixir's public
files. A free PandaScore token adds schedules, results, rosters and broadcasts; only free-plan
endpoints are used.

**What does SummonersNet send over the network?** Only the worker goes online, to PandaScore,
Oracle's Elixir's Google Drive archive, Riot's Data Dragon and the hosts of team and player images.
Twitch and YouTube players load only after you choose to load them. There are no accounts and no
telemetry.

**Can I run it on a server?** Yes, see [Self-hosting](#self-hosting). Everything binds to loopback
and is reached over an SSH tunnel. SummonersNet has no login, so don't expose it on the public
internet.

**Why does a statistic show "—"?** The source didn't supply it. Missing values stay unknown instead
of becoming zero, and partial games are excluded from summaries.

## Contributing

Bug reports, ideas and pull requests are welcome. Please open an
[issue](https://github.com/Sayarinu/SummonersNet/issues) first for larger changes. Read
[AGENTS.md](AGENTS.md) for the architecture rules, checks, branch, commit and PR conventions and the
release flow.

## License

SummonersNet is free and open-source software under the [MIT License](LICENSE).

The license covers this repository's code, including `packages/ui` and `packages/tokens`, which
carry the same license text. Provider data, team and player images, trademarks, fonts and game
assets belong to their respective owners.

## Disclaimer

SummonersNet is an independent, unofficial project. It is not affiliated with, endorsed by or
sponsored by Riot Games, Inc. League of Legends is a trademark of Riot Games, Inc. SummonersNet
isn't endorsed by Riot Games and doesn't reflect the views or opinions of Riot Games or anyone
officially involved in producing or managing Riot Games properties.

Match data comes from [PandaScore](https://pandascore.co) and historical data from
[Oracle's Elixir](https://oracleselixir.com), each used under its own terms. Please follow those
terms when you run SummonersNet.
