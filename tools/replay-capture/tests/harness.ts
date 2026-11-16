import responses from "./replay-api.json";
import { captureOptionsSchema } from "../src/options.js";
import type { ReplayControls } from "../src/replay.js";

export const options = () =>
  captureOptionsSchema.parse({
    replay: "/fixture.rofl",
    attach: true,
    output: "/capture",
    start: 1,
    end: 2,
    sampleRate: 2,
    speed: 2,
    width: 4,
    height: 4,
    crop: [1, 1, 2, 2],
    timeoutMs: 100,
  });
export function replayFixture() {
  const state = structuredClone(responses);
  const calls: {
    path: string;
    method: string;
    body?: Record<string, unknown>;
    signal?: AbortSignal | undefined;
  }[] = [];
  let clock = Date.parse("2026-11-16T12:00:00Z");
  let unavailable = 0,
    recordingReads = 0;
  const fixture = {
    state,
    calls,
    neverFinish: false,
    ignoreRender: false,
    neverSeek: false,
    onRequest: async (_path: string, _method: string): Promise<void> => {},
    onRecording: async (_body: Record<string, unknown>): Promise<void> => {},
    onSleep: () => {},
    unavailable: (count: number) => {
      unavailable = count;
    },
    controls: {} as ReplayControls,
  };
  fixture.controls = {
    now: () => clock,
    sleep: (ms) => {
      clock += ms;
      fixture.onSleep();
      return Promise.resolve();
    },
    fetch: async (url, init) => {
      const path = new URL(url).pathname.split("/").at(-1)!;
      const body = init.body ? (JSON.parse(init.body) as Record<string, unknown>) : undefined;
      calls.push({ path, method: init.method, ...(body ? { body } : {}), signal: init.signal });
      init.signal?.throwIfAborted();
      await fixture.onRequest(path, init.method);
      if (path === "game" && unavailable-- > 0) throw new Error("Connection refused");
      if (init.method === "POST") {
        if (path === "playback") Object.assign(state.playback, body);
        if (path === "render" && !fixture.ignoreRender) Object.assign(state.render, body);
        if (path === "recording") {
          Object.assign(state.recording, body);
          if (body?.recording) await fixture.onRecording(body);
        }
      }
      if (path === "playback" && fixture.neverSeek) state.playback.seeking = true;
      if (
        path === "recording" &&
        init.method === "GET" &&
        state.recording.recording &&
        ++recordingReads >= 2 &&
        !fixture.neverFinish
      ) {
        state.recording.recording = false;
        state.recording.currentTime = state.recording.endTime;
      }
      const payload: unknown = state[path as keyof typeof state];
      return Response.json(payload);
    },
  };
  return fixture;
}
