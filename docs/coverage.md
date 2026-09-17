# Competition and statistics coverage

Coverage is an exact, normalized allowlist, not a substring guess. Unrecognized leagues are
excluded. Provider league names and annual CSV league codes are treated as coverage aliases only;
they do not prove identity, franchise continuity or series linkage.

| Browse group | Included source names                                                  |
| ------------ | ---------------------------------------------------------------------- |
| LCK          | LCK, OGN, Champions, League of Legends Champions Korea                 |
| LPL          | LPL, League of Legends Pro League                                      |
| LEC          | LEC, EU LCS, League of Legends EMEA Championship                       |
| LCS          | LCS, NA LCS, LCS NA/North America, LTA, LTA N/North                    |
| LCP          | LCP; historical LMS and GPL; PCS, VCS, LJL, LCO and OPL through 2024   |
| Worlds       | Worlds, WLDs, World Championship, League of Legends World Championship |
| MSI          | MSI, Mid-Season Invitational                                           |
| First Stand  | FST, First Stand, First Stand Tournament                               |
| EWC          | EWC, Esports World Cup                                                 |

LTA covers the northern conference and shared interconference competition; LTA South is excluded.
Regional predecessors are grouped for navigation, not relabeled in their original event/source
identifiers. Korea/China/Europe/NA academy competitions, LCKC/CL, LDL, LCSA/NACL, European regional
leagues, CBLOL/LTA South and exhibition competitions are outside this scope.

PCS, VCS and LJL became domestic second-tier routes below LCP in 2025. Including those names without
year context would silently import academy/tier-two data. See Riot’s
[LCP format announcement](https://lolesports.com/en-SG/news/league-of-legends-championship-pacific-format-update)
and [2025 primer](https://lolesports.com/en-SG/news/lcp-2025-season-primer). LCO/OPL are included
only as historical Oceania predecessors, through 2024. A scheduled record without a date uses the
worker’s current year for coverage; it never fabricates a date.

A game is eligible only when the source marks it complete (or the older schema omits that field), it
contains ten distinct player observations in the expected five roles per side, and each side has one
consistent team identity. Missing values do not become zero. Eligible team-game counts use played
lineups even when a team summary row is missing. Team result and KDA summaries use supplied team
rows; player summaries use their played rows. Team champion usage counts distinct games from the
played lineup. Result sample counts include only known results; KDA sample counts include only rows
with kills, deaths and assists. Win rate is wins / known results. KDA is aggregate (kills + assists)
/ aggregate deaths and remains null when the denominator is zero.

Partial games remain browseable and their available lineups are shown, but they do not contribute to
summaries. Unidentified players/teams remain separate observation identities rather than being
merged by name. This favors correct samples over guessed continuity.

The archive supports years from 2014 onward; the Sources page shows only years actually imported and
the latest actual game date for each year. Archive support is not a claim that every older file has
been downloaded or that a local current-year CSV is up to date.
