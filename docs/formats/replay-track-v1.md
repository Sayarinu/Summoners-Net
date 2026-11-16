# Replay track format, version 1

LUNE-722 defines the file boundary chosen in the
[replay capture decision](../decisions/0001-replay-capture.md). Producers and importers use the same
`replayTrackSchema` and `parseReplayTrackFile` exports from `@summonersnet/data/contracts`. The
source is `packages/data/src/domain/replay-tracks.ts`; it has no provider, database, filesystem or
UI imports. Do not maintain a separate capture-tool schema.

A file is UTF-8 JSON containing one completed, standard five-versus-five Summoner's Rift game. It
contains observations, not images or a playable replay. Version 1 does not support other maps,
mirrored champions, live tracking or identity resolution by player name.

| Field                                 | Meaning and validation                                                                                                                                                                                                         |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `formatVersion`                       | Integer `1`. Other or missing versions produce an explicit unsupported-version error; no implicit upgrade.                                                                                                                     |
| `gameId`, `platform`                  | Canonical Riot match ID, such as `EUW1_1234567890`, and the lower-case platform `euw1`. The prefix must agree. Numeric game IDs remain strings inside the identifier.                                                          |
| `patch`, `mapId`                      | Canonical major/minor patch, such as `16.22`, and map `11`.                                                                                                                                                                    |
| `sampleRateHz`                        | Nominal samples per game second, a finite number between 1 and 10. Actual timestamps remain authoritative.                                                                                                                     |
| `roster`                              | Exactly ten unique participant IDs (1–10), ten distinct positive champion IDs, and five members of each Riot team (`100`/`200`). Array order does not establish identity.                                                      |
| `capture`                             | Method `replay-api-png`, nonempty `toolVersion` and `clientVersion`, UTC `capturedAt`, and lower-case 64-character `replaySha256`. The hash identifies the source file; it does not prove a match association.                 |
| `capture.sourceWidth`, `sourceHeight` | Original PNG dimensions in pixels, integers from 1 to 16384.                                                                                                                                                                   |
| `capture.minimap`                     | Integer `left`, `top`, `width`, `height` of the calibrated crop; it must fit inside the source frame. Version 1 uses a north-up map with a top-left pixel origin.                                                              |
| `samples`                             | 1–72001 records, with strictly increasing integer `timeMs` in game time, from 0 through 7200000 (two hours). Partial capture intervals may start after zero.                                                                   |
| `samples[].positions`                 | Exactly one observation for every roster participant, identified by `participantId`, in any order.                                                                                                                             |
| `position`                            | Either `null` or `{ "x": ..., "y": ..., "pixel": { "x": ..., "y": ... } }`. Outer x/y are world units within `[-120,14870]` and `[-120,14980]`. Inner x/y are fractional pixels relative to the crop, within its width/height. |
| `confidence`                          | Finite score from 0 through 1, or `null` if no score was available. A non-null position requires a score. It is a detector score, not a probability.                                                                           |

Objects reject unknown fields and values are not coerced from strings. All numbers must be finite.
The text parser rejects malformed JSON and files exceeding **64 MiB in UTF-8 bytes** before parsing.
HTTP/file entry points must also enforce that limit while reading, before allocating the whole body.
The sample-count and byte limits apply independently: a large two-hour, ten-Hz file may need a
shorter capture interval. Consumers may use the schema directly for already bounded in-memory
objects.

## Gaps and coordinates

A missing/occluded/ambiguous observation is an explicit `position: null`. Keep a low measured
confidence if available, or `confidence: null` when no score exists. Do not omit the participant,
copy a previous position, substitute zero, or interpolate a gap into an observation. An entirely
unavailable frame still has ten null positions at its known timestamp. An unknown timestamp cannot
be fabricated; stop or delimit the capture instead. A file can contain only null observations and
still be valid.

For a calibrated crop, world coordinates follow the Minimap convention:

```text
x = -120 + pixel.x / crop.width * 14990
y = 14980 - pixel.y / crop.height * 15100
```

The schema checks bounds and structure; the producer is responsible for applying this transform and
preserving calibration. It does not establish that pixels were observed, confidence was calibrated,
or the claimed roster belongs to the game. Import linking must corroborate game/platform, roster and
patch against stored source records before attaching tracks. No credentials, local paths, portraits
or player names belong in the file.

## Fixtures and use

[The complete valid example](../../packages/data/tests/replay-tracks/valid-v1.json) contains a
detected center point, a rejected detection with a low score, and a fully missing second frame. The
adjacent invalid files cover versions, roster IDs, timestamps, world bounds and confidence. They are
constructed test data, not real captures or accuracy measurements. Nothing from them is used as
product fallback data.

```ts
import { parseReplayTrackFile, replayTrackSchema } from "@summonersnet/data/contracts";

const imported = parseReplayTrackFile(boundedUtf8Text);
const exported = replayTrackSchema.parse(captureResult);
const json = JSON.stringify(exported);
```

Validation is atomic: do not persist a valid prefix of an invalid file. A future incompatible format
gets a new explicit version and a deliberate reader/migration path. Do not reinterpret version 1
fields or silently discard unknown-version data.
