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
  Cup, including their regional predecessors. See [Coverage](docs/coverage.md).

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

You need Node 24.12.0, pnpm 11.10.0 and Docker (for PostgreSQL 18).

```sh
git clone https://github.com/Sayarinu/SummonersNet.git
cd SummonersNet
pnpm install --frozen-lockfile
cp .env.example .env && chmod 600 .env
docker compose up -d
pnpm build
pnpm db:migrate
pnpm history:backfill-all   # queue the official 2014–present archive
pnpm sync:once              # process queued work once
pnpm start
```

Open <http://127.0.0.1:3000>. Keep `pnpm sync` running in another terminal for continuous refreshes.

> **Tip:** Add a free PandaScore token as `PANDASCORE_TOKEN` in `.env` for schedules, results,
> rosters and broadcasts. Without it, the historical archive still works.

Development setup, configuration and checks are in [docs/development.md](docs/development.md). To
run the production containers on a machine you control, see
[docs/self-hosting.md](docs/self-hosting.md).

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

More detail is in [Architecture](docs/architecture.md) and
[Entity resolution and images](docs/entity-resolution.md).

## FAQ

**Do I need a PandaScore account?** No. The historical archive comes from Oracle's Elixir's public
files. A free PandaScore token adds schedules, results, rosters and broadcasts; only free-plan
endpoints are used.

**What does SummonersNet send over the network?** Only the worker goes online, to PandaScore,
Oracle's Elixir's Google Drive archive, Riot's Data Dragon and the hosts of team and player images.
Twitch and YouTube players load only after you choose to load them. There are no accounts and no
telemetry.

**Can I run it on a server?** Yes, with the [self-hosting guide](docs/self-hosting.md). Everything
binds to loopback and is reached over an SSH tunnel. SummonersNet has no login, so don't expose it
on the public internet.

**Why does a statistic show "—"?** The source didn't supply it. Missing values stay unknown instead
of becoming zero, and partial games are excluded from summaries.

## Contributing

Bug reports, ideas and pull requests are welcome. Please open an
[issue](https://github.com/Sayarinu/SummonersNet/issues) first for larger changes. Read
[AGENTS.md](AGENTS.md) for the architecture rules, checks and branch, commit and PR conventions, and
[docs/development.md](docs/development.md) for setup.

## License

SummonersNet is free and open-source software under the [MIT License](LICENSE).

The license covers this repository's code. Provider data, team and player images, trademarks and
game assets belong to their respective owners.

## Disclaimer

SummonersNet is an independent, unofficial project. It is not affiliated with, endorsed by or
sponsored by Riot Games, Inc. League of Legends is a trademark of Riot Games, Inc. SummonersNet
isn't endorsed by Riot Games and doesn't reflect the views or opinions of Riot Games or anyone
officially involved in producing or managing Riot Games properties.

Match data comes from [PandaScore](https://pandascore.co) and historical data from
[Oracle's Elixir](https://oracleselixir.com), each used under its own terms. Please follow those
terms when you run SummonersNet.
