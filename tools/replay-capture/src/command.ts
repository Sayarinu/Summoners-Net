import { captureReplay, type CaptureRuntime } from "./capture.js";
import { parseCaptureArgs } from "./options.js";

export const usage = `Replay capture (Windows/macOS; live integration unverified)
Usage: pnpm replay:capture --replay FILE.rofl (--client EXECUTABLE | --attach)
  --output NEW_DIRECTORY --start SECONDS --end SECONDS
  --width PIXELS --height PIXELS --crop LEFT,TOP,WIDTH,HEIGHT
  [--rate 1..10] [--speed 1..8] [--ca RIOT_CERTIFICATE] [--timeout MILLISECONDS]
The client adapter passes the replay path to an installed executable. If unavailable,
open the replay in League and use --attach. No anti-cheat or service settings are changed.
PNG frame times and running-replay identity remain unverified in the capture manifest.
--check-platform reports native availability without starting a client.\n`;
export async function runCommand(
  args: string[],
  io: {
    out: (text: string) => void;
    error: (text: string) => void;
    platform: string;
    capture?: typeof captureReplay;
    runtime?: CaptureRuntime;
  },
): Promise<number> {
  if (args.length === 1 && args[0] === "--help") {
    io.out(usage);
    return 0;
  }
  if (args.length === 1 && args[0] === "--check-platform") {
    io.out(
      io.platform === "win32" || io.platform === "darwin"
        ? "Replay capture host supported; a compatible installed client and live verification are still required.\n"
        : "Native replay capture skipped: requires Windows or macOS. Pure fixture tests remain enabled.\n",
    );
    return 0;
  }
  try {
    const options = parseCaptureArgs(args);
    const result = await (io.capture ?? captureReplay)(options, {
      ...io.runtime,
      platform: io.platform,
    });
    io.out(
      `Captured ${result.manifest.frames.length} minimap frames in ${result.output}. Frame timing and replay identity require verification.\n`,
    );
    return 0;
  } catch (error) {
    io.error(`${error instanceof Error ? error.message : "Replay capture failed."}\n`);
    return 1;
  }
}
