import { createHash } from "node:crypto";
import { EventEmitter } from "node:events";
import { spawn } from "node:child_process";
import { access, mkdir, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
import { afterEach, expect, it, vi } from "vitest";
import { captureFixture } from "../tests/files.js";
import { captureReplay, launchReplay } from "./capture.js";

vi.mock("node:child_process", () => ({ spawn: vi.fn() }));
const roots: string[] = [];
afterEach(async () => {
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
  vi.clearAllMocks();
});
async function fixture(names?: string[], width?: number) {
  const f = await captureFixture(names, width);
  roots.push(f.root);
  return f;
}

it("writes ignored calibrated crops and an explicit unverified capture manifest", async () => {
  const f = await fixture(["frame_9.png", "frame_10.png", "frame_11.png"]);
  const result = await captureReplay(f.input, {
    ...f.runtime,
    signal: new AbortController().signal,
  });
  expect(await readFile(join(result.output, ".gitignore"), "utf8")).toBe("*\n");
  expect(result.manifest).toMatchObject({
    timingVerified: false,
    replayIdentityVerified: false,
    replaySha256: createHash("sha256").update("constructed replay fixture").digest("hex"),
    sourceWidth: 4,
    sourceHeight: 4,
    minimap: { left: 1, top: 1, width: 2, height: 2 },
  });
  expect(result.manifest.frames).toEqual([
    { file: "frames/frame-000000.png", sourceIndex: 9, nominalTimeMs: 1000 },
    { file: "frames/frame-000001.png", sourceIndex: 10, nominalTimeMs: 1500 },
  ]);
  const image = sharp(join(result.output, result.manifest.frames[0]!.file));
  expect(await image.metadata()).toMatchObject({ width: 2, height: 2 });
  expect((await image.raw().toBuffer()).subarray(0, 3)).toEqual(Buffer.from([20, 20, 100]));
  expect(JSON.parse(await readFile(join(result.output, "manifest.json"), "utf8"))).toEqual(
    result.manifest,
  );
  expect(spawn).not.toHaveBeenCalled();
});
it("validates platforms and filesystem inputs before starting a client or replacing output", async () => {
  const f = await fixture();
  await expect(captureReplay(f.input, { ...f.runtime, platform: "linux" })).rejects.toThrow(
    "Windows or macOS",
  );
  await expect(
    captureReplay({ ...f.input, replay: join(f.root, "missing.rofl") }, f.runtime),
  ).rejects.toThrow("existing regular file");
  await expect(
    captureReplay({ ...f.input, attach: false, client: join(f.root, "missing") }, f.runtime),
  ).rejects.toThrow("Client executable");
  await expect(
    captureReplay({ ...f.input, ca: join(f.root, "missing-ca") }, f.runtime),
  ).rejects.toThrow();
  await mkdir(f.input.output);
  await expect(captureReplay(f.input, f.runtime)).rejects.toThrow("already exists");
  expect(spawn).not.toHaveBeenCalled();
});
it("launches only the selected executable with an argument array and reports launch errors", async () => {
  const child = Object.assign(new EventEmitter(), { unref: vi.fn() });
  vi.mocked(spawn).mockReturnValue(child as unknown as ReturnType<typeof spawn>);
  const launched = launchReplay("/game/client", "/replays/file with spaces.rofl");
  child.emit("spawn");
  await launched;
  expect(spawn).toHaveBeenCalledWith("/game/client", ["/replays/file with spaces.rofl"], {
    cwd: "/game",
    shell: false,
    stdio: "ignore",
    detached: true,
  });
  expect(child.unref).toHaveBeenCalled();
  const rejected = launchReplay("/game/client", "/replay.rofl");
  child.emit("error", new Error("cannot launch"));
  await expect(rejected).rejects.toThrow("cannot launch");
  const f = await fixture();
  const launch = vi.fn(() => Promise.resolve());
  await captureReplay(
    { ...f.input, attach: false, client: f.client },
    { ...f.runtime, platform: "darwin", launch },
  );
  expect(launch).toHaveBeenCalledWith(f.client, f.input.replay);
});
it.each([
  ["unknown.png", "frame_2.png"],
  ["frame_1.png"],
  ["frame_1.png", "frame_3.png"],
  ["frame_1.png", "frame_01.png"],
  ["frame_1.png", "frame_2.png", "frame_3.png", "frame_4.png"],
  ["frame_999999999999999999999999.png", "frame_2.png"],
])("refuses incomplete or ambiguous PNG output %j", async (...names) => {
  const f = await fixture(names);
  await expect(captureReplay(f.input, f.runtime)).rejects.toThrow();
  await expect(access(join(f.input.output, "manifest.json"))).rejects.toThrow();
});
it("rejects unexpected image dimensions and does not publish a partial manifest", async () => {
  const f = await fixture(undefined, 2);
  await expect(captureReplay(f.input, f.runtime)).rejects.toThrow("dimensions differ");
  await expect(access(join(f.input.output, "manifest.json"))).rejects.toThrow();
});

it("cancels before filesystem output or process launch when the signal is already aborted", async () => {
  const f = await fixture();
  const controller = new AbortController();
  controller.abort(new Error("cancelled before start"));
  await expect(captureReplay(f.input, { ...f.runtime, signal: controller.signal })).rejects.toThrow(
    "cancelled before start",
  );
  await expect(access(f.input.output)).rejects.toThrow();
  expect(spawn).not.toHaveBeenCalled();
});
