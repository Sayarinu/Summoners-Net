# ADR 0001: Capture replay tracks with a local companion

- Issue: LUNE-719
- Date: 2026-11-16
- Status: accepted for fixture-based development; live capture and distribution approval unverified

## Decision

Proceed with E7 as an experimental, post-game companion in `tools/replay-capture`, separate from the
Linux worker and web application. It controls an already installed League client, captures a
completed replay, and exports a versioned track file. Do not claim reliable live capture or measured
detection accuracy until the platform and accuracy checks below pass. This decision merges
documentation only.

League's supported desktop platforms are Windows and macOS. Linux is not a supported capture host.
[Riot system requirements](https://support.riotgames.com/en-us/league-of-legends/performance/minimum-and-recommended-system-requirements-league-of-legends)
The companion must reject live capture on Linux with an actionable message, while its pure control,
validation and detection tests remain runnable there. Windows is the first verification target;
macOS capture parity must be checked separately, since Riot's reference League Director application
is Windows-only. [League Director](https://github.com/RiotGames/leaguedirector#how-to-use)

## Terms and asset licensing

**Allowed status: conditional design fit, not confirmed product authorization.** Riot documents
replay recording and permits Data Dragon assets, but its General Policies require products and new
features to be registered and audited through the Developer Portal. They also require visible
attribution and prohibit unfair gameplay advantages and de-anonymization. No evidence of this
feature's registration or audit was available in this spike. A maintainer must establish that status
before representing the companion as authorized for distribution. Offline analysis of completed
games is our interpretation of a compatible use case, not an approval from Riot.
[Riot General Policies](https://developer.riotgames.com/policies/general)

Riot's Terms of Service reserve ownership of game content, including recordings. Capturing frames
creates no independent right to redistribute them. Its fan-content license is limited and revocable,
restricts applications and commercial use, and does not authorize republishing someone else's
esports footage. Do not distribute replay videos, portrait packs or captured frames with this
software. Keep original fixtures clearly distinguished from game assets; any real image fixture
needs its source and usage terms documented. The repository's MIT license covers original code only.
[Terms of Service §3.2](https://www.riotgames.com/en/terms-of-service),
[Legal Jibber Jabber](https://www.riotgames.com/en/legal)

Follow the API Terms as well as the game terms; registration or an API key is not an endorsement.
Keep the existing Riot disclaimer visible, preserve asset provenance, and reassess these policies
when the feature changes. League Director's Apache 2 code license does not relicense Riot's game
imagery; this design uses its documented interface without copying its implementation.
[API Terms](https://developer.riotgames.com/terms),
[League Director license](https://github.com/RiotGames/leaguedirector#license)

## Playback and capture

The user enables `[General] EnableReplayApi=1` in the installed game's `Config/game.cfg` and
restarts the replay. Use HTTPS on `127.0.0.1:2999`, with `GET /replay/game` for readiness and
GET/POST `/replay/playback` and `/replay/render` for control. Recording is available through
GET/POST `/replay/recording`. The client exposes its current API schema; probe capabilities instead
of assuming that a patch still supports every field.
[Riot Replay API](https://developer.riotgames.com/docs/lol#game-client-api_replay-api)

Choose the Replay API's PNG recording path over screen scraping or process memory access. Riot's
reference application exposes PNG and WebM recording. PNG avoids a video decoder dependency and
compression artifacts. Its recording resource includes frame rate, replay speed, time range and
output dimensions. [League Director](https://github.com/RiotGames/leaguedirector#features),
[recording resource](https://github.com/RiotGames/leaguedirector/blob/master/leaguedirector/api.py#L96-L110)

The intended control sequence is:

1. Validate an existing `.rofl` path, installed client path, output directory, crop rectangle,
   finite time range, playback speed and requested sample rate (initially 1–10 samples per game
   second). Open the replay through the installed client without a shell command assembled from user
   input. Launch arguments are platform adapters and need real-client checks; the Replay API is not
   a replay file loader. Reject incompatible replays and never download an old client automatically.
2. Connect with a bounded readiness timeout; save playback and render settings. Trust the locally
   supplied Riot certificate for this connection only. Reject redirects and non-loopback
   destinations; do not disable TLS checks globally. No Riot key is needed for this loopback
   connection.
3. Seek and wait until seeking finishes. Keep `interfaceAll` and `interfaceMinimap` enabled; disable
   the other supported interface elements individually. Request the replay's all-team view for
   post-game analysis. Read settings back and fail clearly if the needed controls are absent.
   [Render/playback fields](https://github.com/RiotGames/leaguedirector/blob/master/leaguedirector/api.py)
4. Record a short bounded PNG sequence, then crop each image to a user-calibrated minimap rectangle
   with the existing `sharp` stack. Prefer a native minimap at least 512 pixels wide; upscaling a
   small crop does not add information. Retain crop size and orientation with the capture metadata.
5. Use game time, not elapsed wall time, for sample timestamps. Verify how frame index, recording
   FPS and replay speed map to game time before accepting a capture. Missing frames or uncertain
   timing produce gaps; never silently fill them. Stop on timeout, interruption or an incomplete
   recording, and restore the saved settings in cleanup.

The PNG naming convention, synchronization, crop location, TLS trust and launch behavior are
untested client integration assumptions, not established platform support. Keep the transport,
clock, process launcher and frame reader injectable. Unsupported recording should produce an
explicit error rather than silently switching to a different capture technique. Captures, portraits
and `.rofl` files stay in ignored local storage; the repository retains only small documented test
fixtures.

## Detection and coordinate contract

Use template matching against local, patch-identified Data Dragon portraits for exactly the game's
ten champions. The capture process makes no external network calls. Portraits must already be
provisioned locally; provider downloads remain the coordinated worker's responsibility. Data Dragon
permits third-party use of its static assets, subject to Riot's terms.
[Riot Data Dragon](https://developer.riotgames.com/docs/lol#data-dragon)

Start with normalized cross-correlation over a small range of calibrated icon scales, masking the
portrait's border. Reuse `sharp` for image decoding/resizing and ordinary TypeScript for matching;
there is no evidence yet that an additional vision library or learned model is necessary. Compare
the best match with the next candidate and enforce one-to-one assignments so overlapping icons
cannot claim the same position. Restricting the roster reduces false matches but does not eliminate
them.

Keep a configurable similarity threshold and a separate ambiguity margin. A confidence score is a
match score, not a calibrated probability. Reject flat templates, weak/ambiguous matches and
occluded icons. Temporal consistency can reject an isolated jump when adjacent observations agree;
it must not invent a hidden location or smooth through recall, teleport, death or a long gap.
Missing positions are `null`, with their measured confidence retained when available.

The existing Minimap uses x bounds `[-120, 14870]`, y bounds `[-120, 14980]`, and a top-left pixel
origin. Invert its transform after subtracting the crop origin:

```text
worldX = -120 + pixelX / cropWidth * 14990
worldY = 14980 - pixelY / cropHeight * 15100
```

Extract that pure transform into a framework-free shared module when detection becomes its second
consumer; keep React out of the companion and never import UI into `packages/data`. Keep pixels,
world coordinates, orientation, calibration and source timestamps traceable. Unsupported maps or
uncalibrated crops must be rejected, not projected onto Summoner's Rift by guesswork.

LUNE-722 will define one strict Zod contract in `packages/data`, exported through
`@summonersnet/data/contracts` for both producer and importer. Include format version, platform and
source game ID, patch, participant/champion roster, sample rate, game timestamps, confidence and
explicit null gaps. Use stable participant identifiers, not names or champion names alone. A local
JSON file is the transfer boundary; the companion receives no database credentials. The existing
application import flow will validate the complete file and apply one transaction. Reject unknown
versions and mismatched game/roster metadata before linking anything.

## Accuracy and effort

No real detection accuracy has been measured. With a 512-pixel crop, one pixel represents
approximately 29.3 x-units and 29.5 y-units. A two-pixel error on both axes is about 83 world units
before timing, calibration and icon-assignment error. At 256 pixels it doubles. These are geometric
estimates, not benchmark results. Overlaps, skin/icon differences, HUD scaling, pings and fog can
cause missing samples or large errors; no precision percentage can responsibly be promised yet.

Provisional acceptance targets for LUNE-725 are median error ≤150 and 95th-percentile error ≤400
world units on paired, visible samples, with all-sample null share reported separately. Also report
mean error, number paired, missing reference positions, timestamp tolerance and per-champion
results. Use nearest samples only within half a sampling interval; never interpolate across nulls to
improve a score. Compare minute marks against the same Riot match and participant, then manually
annotate additional frames because minute-level references cannot expose every short-lived error.
Targets are engineering gates to revise from evidence, not claims about current accuracy. A low
error score with most samples missing is insufficient: inspect coverage for each champion and
capture condition.

Estimated effort for one contributor: 2–4 days for capture adapters and platform checks, 3–5 for
matching/calibration/fixtures, 2–3 for schema/import/viewer integration, and 1–2 for accuracy
evaluation. Allow 8–14 working days overall plus access to supported machines; this is an estimate,
not measured implementation time. Major risks are client changes, replay patch compatibility and
ambiguous icons.

## Proof of concept and release gates

This spike ran on Linux (`uname -s`), with no replay fixture or supported League installation
available in the worktree. Capturing frames from a real replay was therefore not feasible. No
capture was performed and no product or proof-of-concept code is merged. Future Linux fixtures must
clearly say whether they are constructed examples or recordings; neither fixture success nor a
successful build counts as a hand-checked live capture.

**Go** for E7's versioned format, fixture-driven capture/detection, atomic imports, viewer and
comparison harness. **No-go** for claiming validated capture support until a current-patch replay is
opened on each advertised platform, minimap-only frames are inspected, timing/cropping and cleanup
are checked, and detection error plus missing coverage are measured. Revisit the approach if the
official recording path is unavailable or calibrated template matching cannot meet the targets.
