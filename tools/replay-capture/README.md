# Replay capture companion

This experimental command records minimap frames from a completed League replay on Windows or macOS.
It follows [ADR 0001](../../docs/decisions/0001-replay-capture.md). **Live capture has not been
checked by hand on either platform.** Tests use constructed endpoint responses and tiny generated
images; they do not establish client compatibility, frame timing or detection accuracy.

## Run

Use the repository's pinned Node and pnpm versions, install dependencies, then build:

```sh
pnpm --filter @summonersnet/replay-capture build
pnpm replay:capture --help
```

Enable `[General] EnableReplayApi=1` in the installed game's `Config/game.cfg` and restart the
replay. If needed, obtain Riot's root certificate from its
[Game Client API documentation](https://developer.riotgames.com/docs/lol#game-client-api) and pass
the local file with `--ca`. The command keeps TLS validation enabled and scopes certificate trust to
its loopback transport.

For an already-open replay, a short probe might look like this (replace the example crop with your
actual minimap rectangle):

```sh
pnpm replay:capture --replay "/path/to/match.rofl" --attach \
  --output ".local/replay-probe-1" --start 60 --end 62 \
  --rate 5 --speed 1 --width 1920 --height 1080 --crop 1408,568,512,512 \
  --ca "/path/to/riotgames.pem"
```

In PowerShell, use one line or PowerShell's continuation syntax. The paths above are placeholders.

To try opening the replay automatically, replace `--attach` with
`--client "/path/to/game-executable"`. This explicit, experimental adapter invokes that executable
with the absolute replay path as a single argument, using its installation directory as the working
directory and no shell. It is not a promise of a Riot-supported launch convention. If it fails or no
replay appears, open the compatible replay through League and use `--attach`. Do not change
Vanguard, system services or administrator settings to make this command work. On macOS, supply an
actual executable file rather than an `.app` directory.

The Replay API controls an existing replay; Riot's reference workflow opens it in League first. The
recording fields and PNG codec follow Riot's reference implementation.
[Replay API](https://developer.riotgames.com/docs/lol#replay-api),
[League Director usage](https://github.com/RiotGames/leaguedirector#how-to-use),
[recording implementation](https://github.com/RiotGames/leaguedirector/blob/main/leaguedirector/app.py#L379-L479)

## Options and behavior

- Required: an existing `.rofl`, a new output directory, start/end game times in seconds, source
  width/height, and a calibrated `left,top,width,height` crop.
- Choose exactly one of `--client` and `--attach`. The replay path is hashed for provenance even in
  attach mode; it does not prove which replay is running.
- `--rate` is an integer from 1 to 10 samples per nominal game second (default 5); `--speed` is an
  integer from 1 to 8 (default 1). The request uses FPS = rate × speed and frame-rate enforcement.
  This relationship must be verified on the current client before treating timestamps as observed.
- Start/end are bounded to two hours, with end after start and within the running replay's length.
  Dimensions are positive integers up to 16384; the crop must fit inside them.
- `--timeout` is startup/seek timeout in milliseconds, 100–120000 (default 30000). The recording
  deadline adds the expected interval divided by playback speed. Each HTTPS request also has a
  five-second timeout.
- The process only calls four fixed endpoints at `https://127.0.0.1:2999/replay/`: `game`,
  `playback`, `render`, and `recording`. It rejects redirects and other destinations. It downloads
  no client, replay, image, certificate or provider data and receives no database credentials.
- Rendering keeps the global interface and minimap enabled while hiding the other reported HUD
  elements, health bars and floating text. It disables reported fog of war for post-game capture.
  Unsupported or ignored settings fail clearly.
- Existing recording/seeking operations are not interrupted. Once capture starts, success, failure
  and cancellation attempt to stop this recording and restore the original playback/render settings.
  A restoration failure tells you to check the client manually. The game process stays open.

## Output and validation limits

The output directory must not already exist. It gets a local `.gitignore` before capture starts, so
raw recordings, crops and metadata remain ignored even outside the repository's `.local` directory.
No output is committed by this command.

- `raw/` contains the client's original PNG output.
- `frames/` contains cropped PNGs named `frame-000000.png`, etc.
- `manifest.json` is written only after all frames pass validation. It retains requested settings,
  source-file hash, reported recording state, crop, source indices and nominal game timestamps.
  `timingVerified` and `replayIdentityVerified` are **false**. This manifest is not an importable
  position-track file; champion detection and the
  [track format](../../docs/formats/replay-track-v1.md) are separate steps.

PNG names must end in distinct, consecutive numeric indices. Files are sorted numerically, so index
10 follows 9. The command accepts the requested end-exclusive frame count or one extra boundary
frame, which it omits from crops. Missing indices, unexpected counts, unsupported naming and wrong
image dimensions fail without publishing a completed manifest. Partial ignored output remains for
diagnosis; choose a new output directory for a retry.

These checks detect incomplete output, not correct synchronization. Before using a real capture for
tracks, inspect the first/middle/last frame against replay game time, verify the selected replay,
repeat with a nonzero start and different speed, and confirm the minimap rectangle and image scale.
The PNG filename and frame-time convention are not established by Riot's public documentation. Never
reinterpret nominal timestamps as verified positions or fill missing frames by guessing.

## Tests and Linux

```sh
flock ~/.cache/summonersnet-tests.lock pnpm --filter @summonersnet/replay-capture test:coverage
pnpm --filter @summonersnet/replay-capture build
```

The build compiles the TypeScript on every host. Its platform check exits successfully on Linux with
a native-capture-skipped message; fixture tests still run. Invoking real capture on Linux fails
clearly before filesystem or client actions. Supported-host checks are not evidence of a live
capture.

`tests/replay-api.json` is a documentation-derived fixture based on the fields exposed in
[Riot's API wrapper](https://github.com/RiotGames/leaguedirector/blob/main/leaguedirector/api.py).
It is **not** a recorded response from a running League client. Injected fetch, clock, sleep and
launcher control protocol tests; temporary constructed PNGs test real cropping and output
validation. The
[decision record](../../docs/decisions/0001-replay-capture.md#terms-and-asset-licensing) retains the
outstanding platform and product-registration/audit limitations.
