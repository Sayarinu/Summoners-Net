import { expect, it } from "vitest";
import { captureOptionsSchema, parseCaptureArgs } from "./options.js";
import { options } from "../tests/harness.js";
it("parses bounded CLI options without accepting extra flags or positional arguments", () => {
  const args = [
    "--replay",
    "a.rofl",
    "--attach",
    "--output",
    ".local/test",
    "--start",
    "1",
    "--end",
    "2",
    "--width",
    "4",
    "--height",
    "4",
    "--crop",
    "1,1,2,2",
  ];
  expect(parseCaptureArgs(args)).toMatchObject({
    attach: true,
    sampleRate: 5,
    speed: 1,
    timeoutMs: 30000,
  });
  expect(() => parseCaptureArgs([...args, "--remote", "https://example.com"])).toThrow();
  expect(() => parseCaptureArgs([...args, "extra"])).toThrow();
  expect(() => parseCaptureArgs([])).toThrow();
  expect(() => parseCaptureArgs([...args, "--start", ""])).toThrow();
  expect(() => parseCaptureArgs([...args, "--crop", "0,,2,2"])).toThrow();
});
it("rejects invalid paths, ambiguous launch modes, rates, crop bounds and time ranges", () => {
  const input = options();
  for (const change of [
    { replay: "file.txt" },
    { replay: "a\0.rofl" },
    { attach: false },
    { client: "/client" },
    { end: 1 },
    { start: -1 },
    { sampleRate: 0 },
    { sampleRate: 11 },
    { speed: Infinity },
    { crop: [3, 0, 2, 2] },
    { crop: [0, 3, 2, 2] },
    { crop: [0, 0, -1, 1] },
  ])
    expect(captureOptionsSchema.safeParse({ ...input, ...change }).success).toBe(false);
  expect(captureOptionsSchema.parse({ ...input, attach: false, client: "/client" }).attach).toBe(
    false,
  );
});
