# Early jungle paths

The champion page shows how junglers start the game: the side of the first camp, the first clear
route and the lane of the first gank. They are inferred from solo-queue Riot timelines by
`packages/data/src/domain/jungle-paths.ts`, stored per game in `jungle_paths` and clustered per
champion and patch in `jungle_path_clusters` (migration `0047`) by the aggregate job.

## Which games

The jungler is the participant whose team position is `JUNGLE`, in non-remake games with a stored
timeline. Timelines hold one position per minute, so every rule below works from minute frames and
champion kill events only.

## Side normalization

Red side is rotated half a turn about the map centre, `x' = 14750 - x` and `y' = 14860 - y`, using
the minimap bounds. Every rule and every drawn path is in blue side's frame: the jungler's own base
is bottom left, its blue buff is above the mid-lane diagonal (`y > x`) and its red buff below it.

## Rules

- **Start side** comes from the minute 1 frame, when the jungler waits at the first camp before it
  spawns at 1:30.
  - More than 1,000 units past the river (`x + y > 15750`) is an **invade**; past 16,750 the
    confidence is high, otherwise low.
  - Otherwise `y > x` is the **blue buff side** and `y < x` the **red buff side**. At least 2,000
    units from the diagonal is high confidence; under 600 units is too close to mid and the start is
    unknown.
- **First clear route** compares the start side with the side at the minute 3 frame: the same side,
  the other side (**cross**), or **invade** when either point is in the enemy jungle. Unknown when
  either side is unknown.
- **First gank** is the earliest champion kill up to 10:00 with coordinates in a lane, where the
  jungler is the killer (high confidence) or an assister (low confidence). Mid is within 1,500 units
  of the diagonal; top is `x < 2500` or `y > 12300`; bot is `y < 2500` or `x > 12300`. Kills in
  either base or in the jungle are skipped. Unknown when there is no such kill.

A missing frame or missing coordinates leave the part they decide unknown. Nothing is guessed.

## Clusters

Games are grouped per champion and patch by start side, route and gank lane, with unknown parts
grouped as unknown. Each cluster shows its games and its win rate over games with a result; the win
rate is `null` below 10 such games (the shared minimum sample). The drawn path is the mean position
at minutes 1, 2 and 3 over the cluster's games that have that minute; the page draws the three most
played clusters on the minimap path layer, and the table lists up to ten.
