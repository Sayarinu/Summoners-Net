# Lane matchup aggregates

`queries.championMatchups` reads retained aggregates for one catalog champion, role, patch and
source. It returns games, per-metric raw and shrunk values, observation counts and the champion
baseline used for shrinkage. Sources remain separate. Queries validate their inputs, sort and
paginate in SQL (25 rows by default, at most 100), and use cached catalog names and icons.

## Pairing and exclusions

Solo queue uses ranked solo (420), non-remake games. Riot's `teamPosition` assigns the five roles;
positions and item builds do not infer missing roles. Both teams must have exactly one player in the
role. A missing or ambiguous opponent excludes that role's observations, not the other valid roles
in the game. Oracle uses its normalized player positions and validated champion-name map. Only
summary-eligible Oracle games contribute. Unmapped champions exclude both sides of that pair rather
than guessing an identity.

Exclusions count distinct games and participant observations per role, with reasons for unknown
roles, ambiguous roles, missing opponents and unmapped champions. Queries also return the `UNKNOWN`
role row. A game can have more than one excluded role, so these game counts must not be summed as if
they were disjoint. The other roles can still contribute valid samples.

## Observations

- Win rate counts known participant results, independent of the other metric samples.
- Riot gold and XP differences subtract the paired opponent's totals at the stored nominal ten- and
  fifteen-minute frames. Both frames must exist and share a timestamp. CS includes lane and jungle
  minions; every required input must be present.
- Oracle uses each player's reported `golddiffat10/15`, `xpdiffat10/15` and `csdiffat10/15`
  checkpoints. Missing fields stay unknown; another checkpoint never substitutes for them.
- First blood and first tower are **team objective rates**, not the player's personal kill or tower
  participation. Riot uses the team's `objectives.champion.first` and `objectives.tower.first`
  fields; Oracle uses the unique team row's explicit binary `firstblood` and `firsttower`
  observations. The team objective fields are shown in the
  [Riot match-v5 response example](https://gist.github.com/RiotTuxedo/c8e2d29d12fc1e405ade267def036362).
  A missing objective is unknown, while a reported false is a real zero observation.

## Sample and shrinkage policy

Each metric stores its sum and observation count independently in `matchup_aggregates.metrics`. The
baseline pools that champion's valid observations across **all opponents** in the same role, patch
and source, including the selected opponent. It is calculated before pagination.

For a metric with sum `s`, count `n` and champion baseline `b`:

```
raw = s / n
shrunk = (s + 50 * b) / (n + 50)
```

The fixed prior strength of 50 observations stabilizes small samples; it is a documented product
policy, not a fitted confidence interval or evidence of causation. For rates it is a beta prior
centered on the champion baseline; for signed checkpoint differences it is a weighted mean. Both
displayed values are null below ten observations, with the actual count preserved. The stored totals
remain available for later rebuilding and recalculation. Unknown inputs are never turned into zero.
Zero and negative measured differences remain valid observations.

## Rebuilding

Migration 0041 adds the tables and champion/role indexes, and marks existing aggregate patches
dirty. Matchups and exclusions rebuild inside the existing source/patch transaction, after match,
timeline or Oracle ingestion marks it dirty. Replacement timelines replace the samples; repeated
rebuilds do not duplicate them. Read queries make no provider requests. Live provider results have
not been checked by hand for this change.

## Browsing matchups

`/champions/[championId]/matchups` lists lane opponents with all nine metrics and their own
observation counts. Source, patch, role, raw/shrunk values, sorting, direction and page are URL
filters. Sorting and pagination happen in SQL; missing values sort last. The champion overview links
to this page. Team objective rates are labelled explicitly.

`/matchups/[role]` shows the same aggregate observations in a HeatGrid with a table alternative.
Roles use `TOP`, `JUNGLE`, `MIDDLE`, `BOTTOM` and `UTILITY` in the URL. The statistic selector
includes every matchup metric. Rows and columns each page eight champions, ranked by total games
with champion keys breaking ties. Both axes can advance independently, so every observed opponent
remains reachable. Each row's baseline includes all its opponents before either axis is paged. Blank
cells preserve null values and show their real sample count in the tooltip and table; an unobserved
pair has zero observations. Rates use percentages; other metrics keep their original units. Pro and
solo queue samples remain separate, and both routes validate inputs before reading the stored
aggregates and local catalog metadata. No provider request is made by either page.
