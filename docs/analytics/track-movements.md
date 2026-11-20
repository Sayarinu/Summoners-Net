# Replay track viewing and movements

The solo game map (`/solo-games/[matchId]/map`) shows an imported
[replay track](../formats/replay-track-v1.md) when one is linked to the game's stored Riot match,
inside the interval the track sampled. Outside that interval, or without a linked track, it shows
the Riot timeline's one position per minute. The page names the source for the current time.

## Drawing

- Each champion is drawn at its latest sample at or before the current time, if that sample is no
  older than one and a half sample intervals (at least one second). Track samples are never
  interpolated.
- A `null` observation, or no current sample, is a gap: the champion is not drawn and the position
  table says "Gap: no sample".
- Trails show the last 10 seconds of samples and break at gaps.
- Detections scored below 0.5, or without a score, are drawn hollow and dashed and labelled low
  confidence. The score is a detector score, not a probability.
- The viewer reads samples in aligned one-minute chunks around the scrubber through
  `GET /api/solo-games/[matchId]/track?fromMs=&toMs=`. A request spans at most two minutes and
  returns at most 1,201 samples, read by key from `replay_track_samples` (migration `0048`).

## Movement rules

Movements are detected once, when the worker imports a track (`detectMovements` in
`packages/data/src/domain/track-movements.ts`). Tracks imported before detection existed show a
prompt to import them again. Only samples with a detector score of at least 0.5 are used.
Coordinates are absolute, so lane names mean the same lane for both teams.

Zones: blue base where `x + y < 4500`, red base where `x + y > 25000`; mid within 1,500 units of the
`x = y` diagonal; top where `x < 2500` or `y > 12300`; bot where `y < 2500` or `x > 12300`; anything
else is the jungle.

- **Recall**: two consecutive confident samples no more than 4 seconds apart, the first outside the
  champion's own base and the second inside it. A longer gap, such as a death and respawn, is not a
  recall.
- **Roam**: a champion stays in one lane for at least 30 seconds, then reaches a different lane
  within 60 seconds and stays there for at least 10 seconds, without passing through a base. A lane
  stay is a run of confident samples in that lane lasting at least 10 seconds.
- **Rotation**: roams by three or more teammates to the same lane that arrive within 20 seconds of
  the first. They are listed as one rotation instead of separate roams.

Each movement lists its team, champions, origin and destination, when it started and when it was
confirmed. Selecting it moves the scrubber to its start.
