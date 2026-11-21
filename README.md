<div align="center">

# Summoners Net

**A local-first League of Legends esports viewer.**

Schedules, results, more than a decade of historical games, team and player profiles, live streams
and replays for the major leagues, in a fast web app that runs on your own machine. No accounts, no
telemetry, and no made-up data: everything you see comes from PostgreSQL, filled by one coordinated
worker.

[![Latest release](https://img.shields.io/github/v/release/Sayarinu/Summoners-Net?label=release&sort=semver)](https://github.com/Sayarinu/Summoners-Net/releases/latest)
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

- **Command-line data management.** Imports, manual refreshes and the queue status run from the
  terminal (`pnpm queue`, `pnpm history:import`, `pnpm sync:status`), not from the browser.
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
git clone https://github.com/Sayarinu/Summoners-Net.git
cd Summoners-Net
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

After the first setup, `pnpm prod` runs the routine steps in one terminal: it starts PostgreSQL,
builds, applies migrations, then runs the web server and the sync worker side by side, with each
line prefixed `[web]` or `[sync]`. `pnpm prod --skip-build` reuses the last build. Ctrl+C stops
both, and if either one exits the other stops too.

Settings live in the ignored `.env` (see `.env.example`): `DATABASE_URL`, `TEST_DATABASE_URL`,
`PANDASCORE_TOKEN`, `GOOGLE_DRIVE_API_KEY` (used when anonymous Google Drive downloads are
quota-blocked) and `ORACLE_CURRENT_FILE` (a local current-year CSV that the daily refresh rereads).
Solo-queue data uses these optional Riot settings:

- `RIOT_API_KEY` and `RIOT_API_KEY_KIND` (`development`, `personal` or `production`). The worker
  checks the key with one request; `pnpm sync:status` shows whether it is valid and, for a
  development key, when it expires (24 hours after the worker first sees it). Run
  `pnpm queue riot-key` to check it again now.
- `RIOT_PLATFORMS`, such as `euw1,kr`: the apex ladders to sample.
- `RIOT_MATCH_CAP`: the most ranked matches kept per region and patch (2000 by default).
- `RIOT_RETAIN_PATCHES`: how many patches before the current one keep their matches and timelines (2
  by default). Older ones are pruned daily; raising it refetches pruned matches.

None of these settings reach the browser; only the worker reads them.

The win probability model trains daily, and the first time as soon as enough solo-queue games with
timelines are stored. To train now, run `pnpm wp:train` (it prints whether the model was published
or rejected and why) or queue it for the worker with `pnpm queue wp-train`. A sample that is too
small is stored as rejected and the active model stays. The pro model trains on every recorded
minute once at least 500 training games have a Leaguepedia timeline, and is evaluated on whole
held-out games, overall and per game phase (before 15:00, 15:00 to 25:00, after 25:00). The same job
trains the pre-game [draft model](docs/analytics/draft-model.md). `pnpm models` prints every stored
model version, and `pnpm models <id>` one model's evaluation, calibration and feature weights.

The navigation leads to **Champions** (every catalog champion, the role matchup matrices,
counter-pick values and the draft assistant), the **Tier list**, **Leaderboards** (win probability
added, pro accounts and regional ladders), **Patches** and **Drafts**. Search also finds champions
by name and sampled solo-queue players by Riot ID (`Name#TAG`).

Aggregate tables (tier list, trending, patch overview, WPA leaderboards, matchups, the role matrix,
counter-pick values and pro drafts) have a **Download CSV** link. It streams the whole table with
the page's filters, up to 10,000 rows, from `/api/export/<table>`, with sample counts and Riot or
Data Dragon identifiers. Unknown values are empty, never zero.

To import annual CSVs you already have, use `pnpm history:import 2024 /absolute/path/file.csv` or
`pnpm history:import-dir /absolute/path/to/dir` (not `pnpm import`, which is a pnpm command), then
`pnpm sync:once`. `pnpm sync:status` shows the queue.

### Missing archive years

`pnpm sync:status` lists every archive year under `archives`: `imported` (with its games), `blocked`
(Google Drive's download quota; it retries on its own after six hours, shown as `retryAt`),
`queued`, `failed` (with the error) or `missing`. `pnpm history:backfill-all` queues every missing
year. Drive's anonymous download quota is shared by everyone fetching the same file, so older years
are often blocked for a day or more. Two ways around it:

- Set `GOOGLE_DRIVE_API_KEY` in `.env`. Downloads then go through the Drive API first, which has its
  own quota.
- Download the files yourself from
  [the Oracle's Elixir archive](https://drive.google.com/drive/folders/1gLSw0RLjBbtaNy0dgnGQDAZOHIgCe-HH)
  in a browser, put them in one folder with the year in each file name (as Drive names them), and
  run `pnpm history:import-dir /absolute/path/to/that/folder`, then `pnpm sync:once`.

`pnpm queue KIND` queues other worker jobs: `matches`, `running`, `rosters`, `metadata`, `entities`,
`riot-key`, `riot-match-ids`, `pro-game-vods` and `wp-train`. Files are queued with an absolute or
relative path: `pnpm queue replay-track FILE`, `pnpm queue replay-metadata FILE [PLATFORM]` and
`pnpm queue pro-account-links FILE`.

`pnpm queue replay-track FILE` queues [replay track JSON](docs/formats/replay-track-v1.md) files up
to 64 MiB. The worker validates the whole file before replacing that game's track version. Tracks
for other games remain stored, including when Riot match retention prunes provider data. A track
links only to the exact Riot platform/game ID with matching patch, map and roster.

Replay metadata imports accept `.rofl` files up to 256 MiB. The worker validates the header and
metadata without decoding game packets, then stores the metadata in one transaction. Legacy replay
links require the embedded game ID, an explicitly selected platform and a matching patch in stored
Riot matches. ROFL2 imports remain unlinked because their supported metadata has no verified game
ID. See the [format evidence and limits](docs/formats/rofl-metadata-research.md).

`pnpm queue replay-metadata` copies the replay into the ignored `.local/imports/replays` folder for
the worker. The staged copy is deleted by default after processing, including invalid files. Set
`KEEP_REPLAY_FILES=true` for the worker to retain newly processed copies; changing this setting does
not delete earlier retained files. The original file on your computer is untouched. If database
storage fails after cleanup, queue the original again to retry.

Regional solo-queue ladders are available at `/leaderboards/euw1` (replace `euw1` with a configured
Riot platform). They show the last successful apex-tier ladder, with champion counts from retained
ranked games in that platform. These match samples are separate from season wins and losses. Open a
player from the ladder to view their stable `/summoners/[puuid]` profile, current stored Riot ID,
recent ranked games and champion pool. LP and rank history begins with successful ladder refreshes
after snapshot recording is enabled. Charts show the last 30 UTC days, using each day's latest
observed position per platform, with gaps for missing observations. Older current ladder rows are
not backfilled into historical snapshots.

Import [version 1 pro account links](docs/formats/pro-account-links-v1.md) with
`pnpm queue pro-account-links FILE` to connect Riot PUUIDs to exact stored pro player source IDs
with supporting evidence URLs. The worker validates the entire file before one transaction; unknown
or conflicting targets reject the file, and omitted links are kept. Evidence is supplied by the file
author and is not independently verified by fetching its URLs.

The `/leaderboards/pros` feed lists retained ranked solo games for these linked accounts, with team
and league filters. Affiliations mean the latest stored complete pro appearance, not current roster
membership or membership at the time of a solo game. Conflicting observations at that time remain
unknown. Multiple linked accounts for one player remain separate account observations; unlinked
accounts never appear.

Compare pick and win rates at `/trending`, using Solo queue or Pro aggregates and a role filter.
Each patch is compared with its immediate catalog predecessor; missing comparisons stay unknown.
Trend labels require the [documented sample and significance policy](docs/analytics/trending.md).
Patch summaries at `/patches/16.22` combine qualified trends, newly observed three-item builds and
pro presence leaders. See the [patch overview sample rules](docs/analytics/patch-overview.md). Solo
champion pages also list [sampled ladder players](docs/analytics/champion-players.md), with current
stored ranks, pro identity links and a visible minimum sample.
[Lane matchup aggregates](docs/analytics/matchups.md) pair opponents by role and retain raw samples
alongside estimates shrunk toward each champion’s baseline. Browse them from a champion’s lane
matchups link or the paginated role matrix at `/matchups/MIDDLE`.

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
  identifier is kept, and team and player images are cached in PostgreSQL by the worker. An Oracle's
  Elixir game without a team ID, or a renamed team, joins another team only when one of its lineups
  shares three players in the same roles with that team, in the same league within 120 days, and the
  two never played each other. Old team links lead to the surviving team. The worker refreshes
  PandaScore's past fixtures and tournament rosters for each archive year (the current year daily,
  past years monthly), so links don't rely on today's rosters alone.

## FAQ

**Do I need a PandaScore account?** No. The historical archive comes from Oracle's Elixir's public
files. A free PandaScore token adds schedules, results, rosters and broadcasts; only free-plan
endpoints are used.

**What does Summoners Net send over the network?** Only the worker goes online, to PandaScore,
Oracle's Elixir's Google Drive archive, Riot's Data Dragon, the Riot API (only when you set
`RIOT_API_KEY`) and the hosts of team and player images. Twitch and YouTube players load only after
you choose to load them. There are no accounts and no telemetry.

**Can I run it on a server?** Yes, see [Self-hosting](#self-hosting). Everything binds to loopback
and is reached over an SSH tunnel. Summoners Net has no login, so don't expose it on the public
internet.

**Why does a statistic show "—"?** The source didn't supply it. Missing values stay unknown instead
of becoming zero, and partial games are excluded from summaries.

## Contributing

Bug reports, ideas and pull requests are welcome. Please open an
[issue](https://github.com/Sayarinu/Summoners-Net/issues) first for larger changes. Read
[AGENTS.md](AGENTS.md) for the architecture rules, checks, branch, commit and PR conventions and the
release flow.

Architecture decisions: [Replay capture companion](docs/decisions/0001-replay-capture.md). Data
formats: [Replay track v1](docs/formats/replay-track-v1.md). Companion tools:
[Replay capture](tools/replay-capture/README.md) (experimental; Windows/macOS).

## License

Summoners Net is free and open-source software under the [MIT License](LICENSE).

The license covers this repository's code, including `packages/ui` and `packages/tokens`, which
carry the same license text. Provider data, team and player images, trademarks, fonts and game
assets belong to their respective owners. The neutral position icons are from Riot Games'
[League Client assets archived by CommunityDragon](https://raw.communitydragon.org/16.3/plugins/rcp-fe-lol-parties/global/default/).
The dragon, Rift Herald, Void Grub and turret icons are Riot Games'
[minimap icons](https://raw.communitydragon.org/latest/game/assets/ux/minimap/icons/), and the first
blood sword is from the
[League Client postgame assets](https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-postgame/global/default/),
both archived by CommunityDragon. The gold and damage type icons are the game's
[floating text icons](https://raw.communitydragon.org/latest/game/assets/ux/floatingtext/), from the
same archive.

## Disclaimer

Summoners Net is an independent, unofficial project. It is not affiliated with, endorsed by or
sponsored by Riot Games, Inc. League of Legends is a trademark of Riot Games, Inc. Summoners Net
isn't endorsed by Riot Games and doesn't reflect the views or opinions of Riot Games or anyone
officially involved in producing or managing Riot Games properties.

Match data comes from [PandaScore](https://pandascore.co) and historical data from
[Oracle's Elixir](https://oracleselixir.com). The worker fills in recent pro game inventories,
purchase history, gold snapshots and timed objectives where matching postgame records are available
from [Leaguepedia](https://lol.fandom.com/wiki/League_of_Legends_Esports_Wiki). It asks for five
games per request, starting with the covered competitions. It also reads each game's YouTube or
Twitch recording from Leaguepedia's match schedule, 50 games per request, so a game's VOD opens
where the game starts. Both jobs share one request budget, kept in PostgreSQL across restarts: at
most one request every two seconds and 900 in any hour. When the wiki reports that it is under load
(30 seconds) or rate limited (two minutes), or returns HTTP 429 or 503, every Leaguepedia job pauses
for that long or for the reply's Retry-After, and repeated refusals double the pause up to an hour.
`pnpm sync:status` shows the budget, any pause, and how many games have a timeline. A game without a
recording is asked for again after six hours while it is under two weeks old, and after 30 days once
older. Each source has its own terms.
