import { rm } from "node:fs/promises";
import { expect, it, vi } from "vitest";
import { runCommand } from "./command.js";
import type { captureReplay } from "./capture.js";
import { captureFixture } from "../tests/files.js";

it("shows help and skips native capture cleanly on Linux while recognizing supported hosts", async () => {
  const out = vi.fn(),
    error = vi.fn();
  expect(await runCommand(["--help"], { out, error, platform: "linux" })).toBe(0);
  expect(out).toHaveBeenCalledWith(expect.stringContaining("Usage:"));
  for (const platform of ["linux", "win32", "darwin"]) {
    out.mockClear();
    expect(await runCommand(["--check-platform"], { out, error, platform })).toBe(0);
    expect(out).toHaveBeenCalledWith(
      expect.stringContaining(platform === "linux" ? "skipped" : "host supported"),
    );
  }
  expect(error).not.toHaveBeenCalled();
});
it("runs a complete fixture capture through CLI parsing and reports invalid commands", async () => {
  const f = await captureFixture();
  const out = vi.fn(),
    error = vi.fn();
  const args = [
    "--replay",
    f.input.replay,
    "--attach",
    "--output",
    f.input.output,
    "--start",
    "1",
    "--end",
    "2",
    "--rate",
    "2",
    "--speed",
    "2",
    "--width",
    "4",
    "--height",
    "4",
    "--crop",
    "1,1,2,2",
  ];
  try {
    expect(await runCommand(args, { out, error, platform: "win32", runtime: f.runtime })).toBe(0);
    expect(out).toHaveBeenCalledWith(expect.stringContaining("Captured 2 minimap frames"));
    expect(await runCommand([], { out, error, platform: "linux" })).toBe(1);
    expect(await runCommand(args, { out, error, platform: "linux" })).toBe(1);
    expect(error).toHaveBeenCalledWith(expect.stringContaining("requires Windows or macOS"));
    expect(
      await runCommand(args, {
        out,
        error,
        platform: "win32",
        capture: vi.fn<typeof captureReplay>().mockRejectedValue("failure"),
      }),
    ).toBe(1);
    expect(error).toHaveBeenCalledWith("Replay capture failed.\n");
  } finally {
    await rm(f.root, { recursive: true, force: true });
  }
});
