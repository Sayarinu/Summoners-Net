import { z } from "zod";
import { captureOptionsSchema, type CaptureOptions } from "./options.js";
import { replayOrigin, type ReplayFetch } from "./local-fetch.js";

const playbackSchema = z.object({
  paused: z.boolean(),
  seeking: z.boolean(),
  time: z.number().min(0),
  speed: z.number().min(0),
  length: z.number().positive(),
});
const renderSchema = z.looseObject({ interfaceAll: z.boolean(), interfaceMinimap: z.boolean() });
const recordingSchema = z.object({
  recording: z.boolean(),
  currentTime: z.number().min(0),
  startTime: z.number().min(0),
  endTime: z.number().min(0),
  width: z.number().int().min(0),
  height: z.number().int().min(0),
  framesPerSecond: z.number().min(0),
  replaySpeed: z.number().min(0),
});
export interface ReplayControls {
  fetch: ReplayFetch;
  now: () => number;
  sleep: (ms: number) => Promise<void>;
  signal?: AbortSignal | undefined;
}

export async function recordReplay(
  input: CaptureOptions,
  rawDirectory: string,
  controls: ReplayControls,
) {
  const options = captureOptionsSchema.parse(input);
  const call = async (path: string, body?: object, cleanup = false): Promise<unknown> => {
    const response = await controls.fetch(`${replayOrigin}/replay/${path}`, {
      method: body ? "POST" : "GET",
      ...(body ? { body: JSON.stringify(body) } : {}),
      redirect: "error",
      signal: cleanup ? undefined : controls.signal,
    });
    if (!response.ok) throw new Error(`Replay API ${path} returned HTTP ${response.status}.`);
    return (await response.json()) as unknown;
  };
  const wait = async <T>(
    read: () => Promise<T>,
    ready: (value: T) => boolean,
    message: string,
    timeoutMs = options.timeoutMs,
    intervalMs = 100,
  ) => {
    const deadline = controls.now() + timeoutMs;
    for (let attempts = 0; attempts <= Math.ceil(timeoutMs / intervalMs); attempts++) {
      controls.signal?.throwIfAborted();
      const value = await read();
      if (ready(value)) return value;
      if (controls.now() >= deadline) break;
      await controls.sleep(intervalMs);
    }
    throw new Error(message);
  };
  await wait(
    async () => {
      try {
        return z.object({ processID: z.number().int().positive() }).parse(await call("game"));
      } catch {
        return null;
      }
    },
    (game) => game !== null,
    "Replay API unavailable. Open a compatible replay, enable EnableReplayApi=1, and check the local Riot certificate (--ca).",
  );
  const original = playbackSchema.parse(await call("playback"));
  if (original.seeking) throw new Error("Replay is already seeking; wait and try again.");
  if (options.end > original.length)
    throw new Error("Requested end time exceeds the replay length.");
  const render = renderSchema.parse(await call("render"));
  if (recordingSchema.parse(await call("recording")).recording)
    throw new Error("Another replay recording is already active.");
  const hidden: Record<string, boolean> = { interfaceAll: true, interfaceMinimap: true };
  const restore: Record<string, boolean> = {
    interfaceAll: render.interfaceAll,
    interfaceMinimap: render.interfaceMinimap,
  };
  for (const [key, value] of Object.entries(render)) {
    if (
      (key.startsWith("interface") && key !== "interfaceAll" && key !== "interfaceMinimap") ||
      key.startsWith("healthBar") ||
      key === "floatingText" ||
      key === "fogOfWar"
    ) {
      if (typeof value !== "boolean")
        throw new Error(`Unsupported replay render property: ${key}.`);
      hidden[key] = false;
      restore[key] = value;
    }
  }
  let started = false;
  let failure: unknown;
  let failed = false;
  let result: z.infer<typeof recordingSchema> | undefined;
  try {
    await call("render", hidden);
    const applied = renderSchema.parse(await call("render"));
    if (Object.entries(hidden).some(([key, value]) => applied[key] !== value))
      throw new Error("Replay client did not apply the requested minimap-only render settings.");
    await call("playback", { paused: true, time: options.start, speed: options.speed });
    await wait(
      async () => playbackSchema.parse(await call("playback")),
      (p) => !p.seeking && Math.abs(p.time - options.start) <= 0.05,
      "Replay seek did not settle at the requested game time.",
    );
    await call("playback", { paused: false, speed: options.speed });
    started = true;
    await call("recording", {
      recording: true,
      codec: "png",
      path: rawDirectory,
      startTime: options.start,
      endTime: options.end,
      width: options.width,
      height: options.height,
      framesPerSecond: options.sampleRate * options.speed,
      replaySpeed: options.speed,
      enforceFrameRate: true,
      lossless: true,
    });
    const completed = await wait(
      async () => recordingSchema.parse(await call("recording")),
      (r) => !r.recording && r.currentTime >= options.end - 0.05,
      "Replay recording did not finish the requested interval; partial output is not accepted.",
      ((options.end - options.start) / options.speed) * 1000 + options.timeoutMs,
      500,
    );
    if (
      completed.width !== options.width ||
      completed.height !== options.height ||
      completed.framesPerSecond !== options.sampleRate * options.speed ||
      completed.replaySpeed !== options.speed ||
      Math.abs(completed.startTime - options.start) > 0.05 ||
      Math.abs(completed.endTime - options.end) > 0.05
    )
      throw new Error("Replay recording settings differ from the requested capture.");
    result = completed;
  } catch (error) {
    failed = true;
    failure = error;
  }
  {
    const errors: unknown[] = [];
    for (const [path, body] of [
      ...(started ? [["recording", { recording: false }] as const] : []),
      ["render", restore] as const,
      [
        "playback",
        { paused: original.paused, time: original.time, speed: original.speed },
      ] as const,
    ]) {
      try {
        await call(path, body, true);
      } catch (error) {
        errors.push(error);
      }
    }
    if (errors.length)
      throw new AggregateError(
        failed ? [failure, ...errors] : errors,
        "Replay settings could not be fully restored; check playback and rendering in the client.",
      );
  }
  if (failed) throw failure;
  return result!;
}
