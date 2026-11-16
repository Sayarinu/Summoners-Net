import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { createReadStream } from "node:fs";
import { access, mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { setTimeout as pause } from "node:timers/promises";
import sharp from "sharp";
import { captureOptionsSchema, type CaptureOptions } from "./options.js";
import { createReplayFetch, type ReplayFetch } from "./local-fetch.js";
import { recordReplay } from "./replay.js";

export function launchReplay(client: string, replay: string): Promise<void> {
  return new Promise((done, reject) => {
    const child = spawn(client, [replay], {
      cwd: dirname(client),
      shell: false,
      stdio: "ignore",
      detached: true,
    });
    child.once("error", reject);
    child.once("spawn", () => {
      child.unref();
      done();
    });
  });
}
export interface CaptureRuntime {
  platform?: string;
  fetch?: ReplayFetch;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  launch?: typeof launchReplay;
  signal?: AbortSignal | undefined;
}
async function requireFile(path: string, label: string) {
  if (!(await stat(path).catch(() => null))?.isFile())
    throw new Error(`${label} must be an existing regular file.`);
}

export async function captureReplay(input: CaptureOptions, runtime: CaptureRuntime = {}) {
  const options = captureOptionsSchema.parse(input);
  const platform = runtime.platform ?? process.platform;
  if (platform !== "win32" && platform !== "darwin")
    throw new Error(
      "Live replay capture requires Windows or macOS. Fixture tests and builds run on Linux.",
    );
  runtime.signal?.throwIfAborted();
  const replay = resolve(options.replay),
    output = resolve(options.output);
  await requireFile(replay, "Replay path");
  const client = options.client ? resolve(options.client) : undefined;
  if (client) {
    await requireFile(client, "Client executable");
    await access(client, constants.X_OK);
  }
  const ca = options.ca ? await readFile(resolve(options.ca), "utf8") : undefined;
  if (await stat(output).catch(() => null))
    throw new Error("Output directory already exists; choose a new directory.");
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(replay)) {
    runtime.signal?.throwIfAborted();
    hash.update(chunk as Buffer);
  }
  const replaySha256 = hash.digest("hex");
  await mkdir(dirname(output), { recursive: true });
  await mkdir(output);
  await writeFile(join(output, ".gitignore"), "*\n", { flag: "wx" });
  const raw = join(output, "raw"),
    framesDirectory = join(output, "frames");
  await mkdir(raw);
  await mkdir(framesDirectory);
  runtime.signal?.throwIfAborted();
  if (client) await (runtime.launch ?? launchReplay)(client, replay);
  const now = runtime.now ?? Date.now;
  const recording = await recordReplay(options, raw, {
    fetch: runtime.fetch ?? createReplayFetch(ca),
    now,
    sleep: runtime.sleep ?? ((ms) => pause(ms, undefined, { signal: runtime.signal })),
    signal: runtime.signal,
  });
  const entries = (await readdir(raw, { withFileTypes: true })).filter(
    (e) => e.isFile() && e.name.toLowerCase().endsWith(".png"),
  );
  const files = entries
    .map((entry) => {
      const match = /(?:^|\D)(\d+)\.png$/i.exec(entry.name);
      if (!match || !Number.isSafeInteger(Number(match[1])))
        throw new Error(
          "PNG names must end with a numeric frame index; this client output needs verification.",
        );
      return { name: entry.name, index: Number(match[1]) };
    })
    .sort((a, b) => a.index - b.index);
  const count = Math.ceil((options.end - options.start) * options.sampleRate);
  if (
    files.length < count ||
    files.length > count + 1 ||
    files.some((f, i) => i > 0 && f.index !== files[i - 1]!.index + 1)
  )
    throw new Error(
      "PNG frames are missing, duplicated or unexpected; no complete capture manifest was written.",
    );
  const frames: { file: string; sourceIndex: number; nominalTimeMs: number }[] = [];
  for (const [index, file] of files.slice(0, count).entries()) {
    runtime.signal?.throwIfAborted();
    const source = join(raw, file.name);
    const metadata = await sharp(source, {
      limitInputPixels: options.width * options.height,
    }).metadata();
    if (
      metadata.format !== "png" ||
      metadata.width !== options.width ||
      metadata.height !== options.height
    )
      throw new Error("Captured PNG dimensions differ from the requested recording.");
    const name = `frame-${String(index).padStart(6, "0")}.png`;
    const [left, top, width, height] = options.crop;
    await sharp(source, { limitInputPixels: options.width * options.height })
      .extract({ left, top, width, height })
      .png()
      .toFile(join(framesDirectory, name));
    frames.push({
      file: `frames/${name}`,
      sourceIndex: file.index,
      nominalTimeMs: Math.round(options.start * 1000 + (index * 1000) / options.sampleRate),
    });
  }
  const manifest = {
    formatVersion: 1,
    method: "replay-api-png",
    replaySha256,
    capturedAt: new Date(now()).toISOString(),
    platform,
    start: options.start,
    end: options.end,
    sampleRateHz: options.sampleRate,
    playbackSpeed: options.speed,
    sourceWidth: options.width,
    sourceHeight: options.height,
    minimap: {
      left: options.crop[0],
      top: options.crop[1],
      width: options.crop[2],
      height: options.crop[3],
    },
    timingVerified: false,
    replayIdentityVerified: false,
    recording,
    frames,
  };
  runtime.signal?.throwIfAborted();
  await writeFile(join(output, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, {
    flag: "wx",
  });
  return { output, manifest };
}
