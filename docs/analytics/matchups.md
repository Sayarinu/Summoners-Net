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

## Blindability

A champion is safe to pick blind when it has few bad matchups that opponents actually pick.
`queries.championBlindability` reads one stored score per source, patch, champion and role, and the
champion matchup page shows it above the opponent table with the method and formula.

Each aggregate rebuild scores every champion and role from the freshly rebuilt `matchup_aggregates`
rows of that source and patch, inside the same transaction, and stores the result in
`blindability_scores` (migration 0042). For champion `c`:

- `pᵢ` is the shrunk win rate against opponent `i` (the matchup policy above). Opponents with fewer
  than ten win-rate observations are excluded.
- `wᵢ` is how often opponent `i` is picked in the role: its paired lane games in that role, patch
  and source, against any champion.
- Covered pick share is `Σ wᵢ` over included opponents divided by the picks of every champion in the
  role other than `c`. The counts are stored and shown with it.

```
expected  E = Σ wᵢ·pᵢ / Σ wᵢ
worst     min pᵢ   (the enemy counter-picks optimally)
variance  Σ wᵢ·(pᵢ − E)² / Σ wᵢ
tail      mean pᵢ over the worst 20% of Σ wᵢ, worst matchups first
score     tail
```

The tail takes whole opponents from the worst matchup up and a fraction of the opponent that crosses
the 20% boundary. Every statistic is null, with the reason stored and shown, when no opponent picks
exist in the role (`no-opponent-picks`), fewer than three opponents meet the minimum
(`few-opponents`), or the covered pick share is below 50% (`low-coverage`). Sample, opponent and
pick counts are kept in every case. Like the matchups, the score describes stored samples and is not
evidence of causation. The read makes no provider requests.

## Counter-pick value

Some champions gain a lot from picking last. The same rebuild stores, next to each blindability
score (migration 0043), the champion's **best-response counter-pick win rate**:

- For each enemy `e` in the role, its best response is the champion with the highest shrunk win rate
  against `e` among those with at least ten win-rate observations (ties go to the lower champion
  key).
- A champion's counter-pick win rate is `Σ wₑ·pₑ / Σ wₑ` over the enemies it is the best response
  to, weighted by their picks.
- The **counter-pick value** is the counter-pick win rate minus the blind expected win rate `E`.

The number of enemies and their picks are stored with it. The values are null with a reason when the
blind win rate is unknown (`blind-unavailable`, under the blindability coverage rule) or the
champion is not the best response to any enemy (`never-best-response`).

The champion overview (for a lane role) and the champion matchup page show the blind and
counter-pick win rates and the difference. `/matchups/[role]/counter-picks` lists a role's champions
with every value, coverage and reason. It sorts by counter-pick value, either win rate, blindability
score or lane games in SQL, with unknown values last, and pages 25 rows by default (at most 100).
`queries.counterPickList` validates its input; the `(source, patch_key, role)` index supports it.

## Draft assistant

`/drafts/assistant` ranks candidates for one role from a partial draft. The draft lives only in the
URL: `source`, `patch`, `side`, the `role` to fill, `blue` and `red` picks (comma-separated champion
IDs, each with an optional role, such as `Ahri:MIDDLE`) and `bans`. Both the route and
`queries.draftAssistant` validate it: at most five picks per side and ten bans, each champion once,
each role once per side, and a role to fill that the user's side has not picked. Unknown champion
IDs are listed and ignored. Nothing is stored, and only stored aggregates are read.

Candidates are the champions with a stored blindability row for the source, patch and role, minus
every pick and ban. Each part is in win-rate points above 50% and needs at least ten observations:

- **Matchup**: the shrunk lane win rate against the enemy picked in the role to fill. The shrinkage
  uses the candidate's pooled win-rate counts, stored with its blindability score (migration 0044).
- **Synergy**: the mean shrunk duo delta with each ally whose role is known. This is the champion
  page's synergy rule: duo win rate minus the rate expected from both champions' own role win rates,
  times `n / (n + 50)`. Solo queue only, since duos are recorded there.
- **Blindability**: the stored lower-tail score, used only while the lane opponent is unknown.

```
score = mean of the known parts
part  = win rate − 50%
```

Unknown parts are left out of the mean rather than counted as zero, and every part keeps its sample
count. Candidates with no known part rank last, and ties go to more lane games, then the lower
champion key. Ranking runs over the bounded set of champions in one role. The reads use the
`(source, patch_key, role)` indexes and are in the query plan budget test.
