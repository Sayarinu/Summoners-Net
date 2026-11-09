# Application architecture

Routes in `apps/web/app` compose feature screens and HTTP entry points. Features own presentation,
filters, state and mappings to the reviewed UI library. `src/server` owns Next cookies, environment
configuration, route-segment decoding and access to the data interfaces. ESLint enforces the import
boundaries. Data has no React, Next or UI dependency.

`@summonersnet/data` exports bounded query DTOs and a query client; `@summonersnet/data/contracts`
exports browser-safe input validation; `@summonersnet/data/sync` exports validated queue requests
and the server worker lifecycle. SQL, connections and raw upstream payloads stay internal. A browser
refresh request only inserts a validated job in PostgreSQL. Read routes never invoke providers.

## Persistence and history

Migrations are transactional, advisory-locked and checksum-checked. Historical files are parsed and
validated before one transaction upserts normalized games and their participant rows. All source IDs
remain available. Corrections use content hashes; duplicates keep one game/slot. A failed parse or
transaction cannot replace good records. Missing games in a replacement file are retained because
absence is not a deletion signal.

History filtering, counts, ordering and pagination run in SQL, with a 50-row maximum and indexed
league/year/time, participant identity and trigram search paths. Count and page use the same
statement snapshot, including empty pages. Profile aggregates use the entire eligible filtered
sample in SQL, not the current displayed page. Missing statistics remain null and have explicit
result/KDA sample counts. A zero-death sample has no finite KDA ratio and displays an em dash.

Source-prefixed identities never merge by name. A derived, evidence-backed crosswalk joins
corroborated Oracle/PandaScore records for browsing, while preserving all original IDs and
appearance names. See [entity resolution](entity-resolution.md) for corroboration rules, historical
tournament rosters and local image storage. Missing Oracle IDs create game/side/slot observation
identities. Observed PandaScore rosters are timestamped snapshots; historical lineups are the people
who actually appear in a game. Neither is contractual employment history. Oracle games stay
independently addressable unless a series association has source evidence. Match-level PandaScore
game context is retained when the free list response supplies it; no paid game-detail endpoint is
called.

## Coordinated worker

A PostgreSQL session advisory lock permits one synchronization run at a time across processes.
Duplicate active jobs share a durable key. Different local files for one year retain separate queued
requests, so a newly uploaded correction cannot silently disappear behind a different file. A job
has a five-minute crash-recovery lease; the global lock prevents a second worker taking it while the
first is alive. After process loss, another worker resumes expired work. Writes are repeatable.

A separate transactional advisory lock protects the PandaScore ledger. Every attempt reserves a
request before network I/O, including pagination, network failures and retries. The rolling window
never exceeds the application’s **600 requests/hour**, even when the provider plan allows more.
`X-Rate-Limit-Remaining`, reset and Retry-After headers persist cooldowns. Workers reconstruct
allowed pagination URLs instead of following arbitrary authenticated links. Pagination is bounded at
100 pages per collection. Provider/transport retries are queued with delay and bounded attempts; a
quota wait does not spend a retry attempt. Last successful data and timestamps survive failures.

Running matches are scheduled every two minutes; upcoming and the last 30 days of results every ten
minutes. Rosters from covered recent/upcoming teams, latest versioned metadata and current-year
history refresh daily. Older history is explicit backfill. `sync:once` drains available work and
exits without waiting for deferred jobs; `sync` continues scheduling. Clocks and fetch are
injectable.

## Local controls and watching

The web server and PostgreSQL port bind to loopback. Mutation handlers require a matching localhost
Origin and Host and validate bodies. Uploads use content-derived filenames and mode 0600 in ignored
`.local/imports`. Only the worker parses and applies imports. The web API never accepts a server
file path supplied by a browser.

Timezone and spoiler preferences live in an HTTP-only SameSite cookie. Scores, winners, historical
statistics and profile summaries start hidden when spoilers are enabled. IANA timezone day filters
use local midnight boundaries in SQL, including DST days.

A match contains one selected Twitch or YouTube player. Selection resets consent and unloads the old
player. No iframe loads before consent; users can unload it or select the explicit failure fallback.
Safe provider links remain available even if the URL cannot be embedded. A browser cannot reliably
detect every cross-origin player failure, so the visible “Player not working” control is
intentional. Team/player images are fetched by the coordinated worker and cached in PostgreSQL. The
browser receives content-addressed local image URLs; it does not fetch provider APIs or the
PandaScore image CDN.

## Production packaging

The optional container setup packages the standalone web server and coordinated worker, runs
migrations before startup, and shares durable uploads between them. Only the worker receives the
provider token. Web and PostgreSQL remain bound to host loopback. `/api/health` checks database
readiness without a provider request; idle connection errors are consumed so a PostgreSQL restart
does not crash the process. Runtime connection attempts are bounded at five seconds. The
[self-hosting guide](self-hosting.md) covers running the containers, backups, restore and SSH tunnel
access.

## References

- [PandaScore plan reference](https://developers.pandascore.co/docs/plan-reference): only free list
  context/match endpoints are used.
- [PandaScore rate headers](https://developers.pandascore.co/docs/rate-and-connections-limits) and
  [pagination](https://developers.pandascore.co/docs/pagination).
- [Riot Data Dragon](https://developer.riotgames.com/docs/lol#data-dragon): versioned
  metadata/assets.
- [Oracle’s Elixir official annual archive](https://drive.google.com/drive/folders/1gLSw0RLjBbtaNy0dgnGQDAZOHIgCe-HH).
