import { expect, it } from "vitest";
import { options, replayFixture } from "../tests/harness.js";
import { recordReplay } from "./replay.js";

it("controls a replay through fixture responses and restores the user's settings", async () => {
  const f = replayFixture();
  const original = structuredClone(f.state);
  f.unavailable(1);
  const input = options();
  input.timeoutMs = 200;
  const result = await recordReplay(input, "/capture/raw", f.controls);
  expect(result).toMatchObject({ currentTime: 2, framesPerSecond: 4, replaySpeed: 2 });
  expect(f.state.playback).toEqual(original.playback);
  expect(f.state.render).toEqual(original.render);
  expect(f.calls.find((c) => c.path === "render" && c.method === "POST")?.body).toMatchObject({
    interfaceAll: true,
    interfaceMinimap: true,
    interfaceChat: false,
    healthBarChampions: false,
    fogOfWar: false,
  });
  expect(f.calls.find((c) => c.path === "recording" && c.body?.recording === true)?.body).toEqual({
    recording: true,
    codec: "png",
    path: "/capture/raw",
    startTime: 1,
    endTime: 2,
    width: 4,
    height: 4,
    framesPerSecond: 4,
    replaySpeed: 2,
    enforceFrameRate: true,
    lossless: true,
  });
  expect(f.calls.filter((c) => c.path === "game")).toHaveLength(2);
});
it("reports unavailable or malformed endpoints before modifying replay settings", async () => {
  const unavailable = replayFixture();
  unavailable.unavailable(100);
  await expect(recordReplay(options(), "/raw", unavailable.controls)).rejects.toThrow(
    "EnableReplayApi=1",
  );
  expect(unavailable.calls.every((c) => c.method === "GET")).toBe(true);
  const invalid = replayFixture();
  invalid.controls.fetch = (url) =>
    Promise.resolve(
      url.endsWith("/game")
        ? Response.json({ processID: 1 })
        : Response.json({ paused: "invalid" }),
    );
  await expect(recordReplay(options(), "/raw", invalid.controls)).rejects.toThrow();
  const http = replayFixture();
  http.controls.fetch = (url) =>
    Promise.resolve(
      url.endsWith("/game")
        ? Response.json({ processID: 1 })
        : new Response("failed", { status: 503 }),
    );
  await expect(recordReplay(options(), "/raw", http.controls)).rejects.toThrow("HTTP 503");
});
it("does not interfere with an active recording, seek, or out-of-range interval", async () => {
  for (const field of ["recording", "seeking", "length"] as const) {
    const f = replayFixture();
    if (field === "recording") f.state.recording.recording = true;
    else if (field === "seeking") f.state.playback.seeking = true;
    else f.state.playback.length = 1;
    await expect(recordReplay(options(), "/raw", f.controls)).rejects.toThrow();
    expect(f.calls.some((c) => c.method === "POST")).toBe(false);
  }
});
it("restores settings when seeking or recording stalls or requested rendering is ignored", async () => {
  for (const mode of ["seek", "recording", "render"] as const) {
    const f = replayFixture();
    const original = structuredClone(f.state);
    if (mode === "seek")
      f.onRequest = (path, method) => {
        if (path === "playback" && method === "POST") f.neverSeek = true;
        return Promise.resolve();
      };
    if (mode === "recording") f.neverFinish = true;
    if (mode === "render") f.ignoreRender = true;
    await expect(recordReplay(options(), "/raw", f.controls)).rejects.toThrow();
    expect(f.calls.at(-1)?.body).toEqual({
      paused: original.playback.paused,
      time: original.playback.time,
      speed: original.playback.speed,
    });
    expect(f.state.render).toEqual(original.render);
  }
});
it("rejects unsupported render properties and mismatched completed recording settings", async () => {
  const invalid = replayFixture();
  Object.assign(invalid.state.render, { interfaceUnknown: "bad" });
  await expect(recordReplay(options(), "/raw", invalid.controls)).rejects.toThrow(
    "Unsupported replay render property",
  );
  for (const field of [
    "width",
    "height",
    "framesPerSecond",
    "replaySpeed",
    "startTime",
    "endTime",
  ] as const) {
    const f = replayFixture();
    f.onRecording = () => {
      f.state.recording[field] += 1;
      return Promise.resolve();
    };
    await expect(recordReplay(options(), "/raw", f.controls)).rejects.toThrow("settings differ");
  }
});
it("cancels capture but still restores settings using requests without the aborted signal", async () => {
  const f = replayFixture();
  const controller = new AbortController();
  f.controls.signal = controller.signal;
  f.onSleep = () => controller.abort(new Error("cancelled"));
  await expect(recordReplay(options(), "/raw", f.controls)).rejects.toThrow("cancelled");
  expect(f.calls.slice(-3).every((c) => c.signal === undefined)).toBe(true);
  expect(f.state.recording.recording).toBe(false);
});
it("attempts every restoration and reports failures with the original capture error", async () => {
  for (const failCapture of [false, true]) {
    const f = replayFixture();
    let restoring = false;
    f.onRequest = (path, method) => {
      if (path === "recording" && method === "POST" && f.state.recording.framesPerSecond > 0)
        restoring = true;
      if (restoring) throw new Error("restore failure");
      return Promise.resolve();
    };
    if (failCapture)
      f.onRecording = () => {
        throw new Error("capture failure");
      };
    await expect(recordReplay(options(), "/raw", f.controls)).rejects.toThrow(
      "could not be fully restored",
    );
    expect(f.calls.slice(-3).map((c) => c.path)).toEqual(["recording", "render", "playback"]);
  }
});
