# Replay track accuracy

Detected replay tracks are checked against Riot timeline positions, which record every champion's
position once a minute. The comparison is in `compareTrack`
(`packages/data/src/domain/track-accuracy.ts`).

## Method

- For each timeline frame with a position, the track sample nearest the frame's timestamp is used if
  it is at most one second away. Without one the mark is **unsampled**; if that sample's observation
  is `null` the mark is **missed**; otherwise the straight-line distance between the two positions,
  in game units, is one **comparison**.
- Errors are reported as the mean, the median and the 95th percentile (nearest rank), per champion
  and overall. With no comparisons they are `null`, never zero.
- The **null share** is the share of all the track's observations with no position, per champion and
  overall.

The timeline position is itself a single sample at the frame time, so a small error is expected even
for a perfect detector when a champion moves quickly around a minute mark.

## Thresholds

A track is acceptable when, over the whole game:

| Measure               | Threshold          |
| --------------------- | ------------------ |
| Minute marks compared | at least 10        |
| Median error          | at most 400 units  |
| 95th percentile error | at most 1200 units |
| Null share            | at most 0.25       |

The thresholds are `accuracyThresholds` in the same module, and tests check them against the
committed fixtures.

## Fixtures

`packages/data/tests/replay-tracks/accuracy-euw1.json` is a constructed track, not a real capture,
for the game in `packages/data/tests/riot/timeline-euw1.json`. It has one sample a second. Each
position is offset from the timeline by `(50p, -40p)` for participant `p`, an error of about `64p`
units. Participant 10 is never seen, participant 9 is missing at 1:00, and participant 3 has no
position where the timeline has none. The domain test and the PostgreSQL integration test both
reproduce the same report from it: 25 comparisons, mean 315.0, median 320.2, 95th percentile 576.3
and a null share of 0.1256.

## Real games

For an imported track linked to its stored Riot match, with the match timeline stored:

```sh
pnpm --filter @summonersnet/data build
pnpm tracks:accuracy EUW1_1234567890
```

The command only reads the database. It prints the report, the verdict and the thresholds as JSON.
It exits with 1 when no linked track exists and 2 when the track fails a threshold. Measured results
for real captures depend on the capture tool and the detector. They have not been produced on this
repository's Linux development host.
