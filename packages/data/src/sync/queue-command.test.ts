import { mkdtemp, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parseQueueCommand, queueCommand, queueUsage } from "./queue-command.js";

let root: string;
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "queue-command-"));
});
afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("pnpm queue", () => {
  it("validates kinds and makes file paths absolute", () => {
    expect(parseQueueCommand(["matches"])).toEqual({ kind: "matches" });
    expect(parseQueueCommand(["riot-match-ids"])).toEqual({ kind: "riot-match-ids" });
    expect(parseQueueCommand(["replay-track", "track.json"], "/data")).toEqual({
      kind: "replay-track",
      file: "/data/track.json",
    });
    expect(parseQueueCommand(["pro-account-links", "/abs/links.json"])).toEqual({
      kind: "pro-account-links",
      file: "/abs/links.json",
    });
    expect(parseQueueCommand(["replay-metadata", "/abs/a.rofl", "euw1"])).toEqual({
      kind: "replay-metadata",
      file: "/abs/a.rofl",
      platform: "euw1",
    });
    for (const args of [
      [],
      ["paid"],
      ["history"],
      ["matches", "extra"],
      ["replay-track"],
      ["replay-track", "/a.json", "euw1"],
      ["replay-metadata", "/a.rofl", "nowhere"],
      ["replay-metadata", "/a.rofl", "euw1", "more"],
    ])
      expect(() => parseQueueCommand(args)).toThrow(queueUsage);
  });

  it("queues requests that need no staging as given", async () => {
    const request = vi.fn().mockResolvedValue("7");
    expect(await queueCommand(["metadata"], { request, importDirectory: root })).toBe("7");
    expect(request).toHaveBeenCalledWith({ kind: "metadata" });
  });

  it("stages a private replay copy and keeps the original", async () => {
    const original = join(root, "game.rofl");
    await writeFile(original, "replay bytes");
    const request = vi.fn().mockResolvedValue("8");
    await queueCommand(["replay-metadata", original], {
      request,
      importDirectory: join(root, "imports"),
    });
    const staged = (request.mock.calls[0]![0] as { file: string }).file;
    expect(staged).toMatch(/imports\/replays\/[a-f0-9-]{36}\.rofl$/);
    expect(await readFile(staged, "utf8")).toBe("replay bytes");
    expect((await stat(staged)).mode & 0o777).toBe(0o600);
    expect(await readFile(original, "utf8")).toBe("replay bytes");
  });

  it("removes the staged copy when queueing fails", async () => {
    const original = join(root, "game.rofl");
    await writeFile(original, "replay bytes");
    const request = vi.fn().mockRejectedValue(new Error("database unavailable"));
    await expect(
      queueCommand(["replay-metadata", original], {
        request,
        importDirectory: join(root, "imports"),
      }),
    ).rejects.toThrow("database unavailable");
    expect(await readdir(join(root, "imports", "replays"))).toEqual([]);
  });
});
