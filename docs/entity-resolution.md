# Entity resolution and images

EsportsViewer retains every Oracle and PandaScore source identifier. A derived, reversible crosswalk
connects corroborated records. Existing source URLs continue to work; directories, search, profile
statistics and internal links use one canonical profile when a link is supported. Game documents
keep the names, teams, roles and source IDs recorded for that particular appearance.

## Evidence rules

Names and provider slugs generate candidates; they never establish a link by themselves. There is no
fuzzy-name merge, abbreviation guessing, inferred contract history or generated portrait/logo.

- A team can be corroborated by at least three distinct players in distinct roles, appearing
  together in one complete Oracle game and a PandaScore roster with a matching team name or observed
  alias.
- Retired teams can also be corroborated by matching league, opposing teams and start times within
  twelve hours, in at least two fixtures on different dates against different opponents. A fixture
  with multiple matching Oracle games is rejected. These are identity evidence; Oracle games are
  **not** assigned to a PandaScore series by this rule.
- Players require a compatible role and name/observed alias inside a corroborated team's played
  lineup. Tournament roster evidence is restricted to the tournament's observed fixture period,
  allowing twelve hours at either end for scheduling differences.
- Cross-source links must be one-to-one. Conflicting source IDs, homonyms, source-ID-less
  observations and insufficient evidence remain separate. Source reuse and organization changes can
  therefore leave records unresolved even when their names look familiar.

The crosswalk records supporting game IDs, fixture IDs, tournament IDs where available, matched
players/roles and observation times. Profiles expose a concise explanation in **Names & source
records**. Import corrections can invalidate derived links. Oracle naming evidence is rebuilt from
retained game documents, and source records are never deleted to remove a link.

## Current versus historical rosters

The free LoL team catalog is private matching context, including records outside the browsing scope.
Only corroborated identities and their relevant current observations enter the library. It does not
add academy leagues to historical coverage. Teams that actually played in an included competition
retain their own identity, including academy-named teams where present in the source games.

Tournament rosters are stored separately from current roster snapshots. They describe provider
participation context; Oracle lineups describe who actually played. Loading an old tournament roster
does not make its retired players appear on the team's current roster. Current rosters remain
observations of the latest provider response, not employment claims.

## Commands

Build the data package and apply migrations first (`pnpm --filter @esportsviewer/data build`, then
`pnpm db:migrate`). The following commands use the same coordinated worker and persisted request
budget as normal refreshes, drain available work until their requested job finishes or defers, then
exit. They do not launch a continuous service.

```sh
pnpm entities:sync          # Refresh the free team catalog, derive links and cache images
pnpm entities:history 2025  # Explicit free fixture-context backfill for an imported year
pnpm entities:rosters 2025  # Tournament participation/portraits for that fixture context
pnpm entities:resolve       # Rebuild links from saved evidence and fill/refresh image cache
```

For a historical year, run the fixture command before the roster command. Normal daily scheduling
refreshes the current catalog; old tournament context is an explicit backfill. Re-run resolution
after an import correction when you need the updated crosswalk immediately.

Successful tournament observations are persisted individually and reused for one day during retries.
A failed or throttled tournament request leaves the job incomplete and resumable; it does not erase
successful observations or claim that the full year finished. A later explicit refresh can apply
provider corrections. Source and job status remain visible on **Sources & imports**.

## Local image storage

Only public PandaScore CDN images are accepted. The coordinated worker downloads them without the
API credential, checks their raster signature and MIME type, validates PNG chunk integrity, rejects
HTML/SVG and bodies above 3 MiB, and stores content-addressed bytes in PostgreSQL. Browser image
routes only read those saved bytes and return immutable cache headers, `nosniff` and a same-origin
resource policy.

The cache refreshes successful assets after seven days and retries unavailable assets after a day. A
missing URL or failed replacement retains the last successful image. Missing images keep the
reviewed component's initials treatment. Images are current source references and may show newer
portraits, uniforms or branding than the historical game. Source images are not redistributed as
committed application assets.

API pagination, historical context and retries all reserve from the persisted **600 requests per
rolling hour** ceiling. Requests within a worker are also spaced by one second to avoid bursts.
Provider cooldowns remain authoritative. Images use the public CDN without consuming API requests.

## Primary references

- [Free PandaScore context/match endpoints](https://developers.pandascore.co/docs/plan-reference).
- [Free tournament roster endpoint](https://developers.pandascore.co/reference/get_tournaments_tournamentidorslug_rosters).
- [Past LoL match context and filters](https://developers.pandascore.co/reference/get_lol_matches_past).

No paid match/game detail or statistics endpoints are used. Historical Oracle archive access and
external streaming playback remain separate acceptance items.
