import { expect, it } from "vitest";
import { roflFixture } from "../../tests/rofl-fixtures.js";
import { keepReplayFilesSchema, replayFileMaxBytes } from "../domain/replays.js";
import { roflLayout, parseRoflMetadata, statNumber } from "./rofl.js";
function parse(file: Buffer) {
  const layout = roflLayout(
    file.subarray(0, Math.min(512, file.length)),
    file.subarray(-4),
    file.length,
  );
  return parseRoflMetadata(
    layout,
    file.subarray(layout.metadataOffset, layout.metadataOffset + layout.metadataLength),
    layout.payloadHeaderOffset === null
      ? undefined
      : file.subarray(layout.payloadHeaderOffset, layout.payloadHeaderOffset + 34),
  );
}
it("reads both documented metadata layouts and preserves uint64 IDs and missing fields", () => {
  const legacy = parse(roflFixture({ gameId: 18446744073709551615n }));
  expect(legacy).toMatchObject({
    format: "ROFL",
    gameId: "18446744073709551615",
    gameVersion: "16.22.734.5521",
    durationMs: 1_800_000,
    headerDurationMs: 1_800_000,
    lastGameChunkId: 4,
    lastKeyFrameId: 2,
  });
  expect(legacy.participants[0]!.NUM_DEATHS).toBeUndefined();
  for (const version of ["16.8.766.8562", "16.22.734.5521", "16.22.12345678.12345678"]) {
    const current = parse(
      roflFixture({
        format: "ROFL2",
        version,
        metadata: { lastGameChunkId: undefined, lastKeyFrameId: undefined },
      }),
    );
    expect(current).toMatchObject({
      format: "ROFL2",
      gameId: null,
      gameVersion: version,
      headerDurationMs: null,
      lastGameChunkId: null,
      lastKeyFrameId: null,
    });
  }
  expect(parse(roflFixture({ metadata: { statsJson: "[]" } })).participants).toEqual([]);
});
it("rejects malformed metadata and statistics rather than storing a valid prefix", () => {
  for (const metadata of [
    { gameLength: -1 },
    { gameLength: 1.1 },
    { gameLength: "100" },
    { gameVersion: undefined },
    { gameVersion: "invalid" },
    { statsJson: [] },
    { statsJson: "bad" },
    { statsJson: "{}" },
    { statsJson: JSON.stringify([{}, { CHAMPIONS_KILLED: "unknown" }]) },
    { statsJson: JSON.stringify([{ TEAM: -1 }]) },
    { statsJson: JSON.stringify([{ nested: {} }]) },
    { statsJson: JSON.stringify([{ value: "x".repeat(4097) }]) },
    {
      statsJson: JSON.stringify([
        Object.fromEntries(Array.from({ length: 513 }, (_, i) => ["key" + i, 1])),
      ]),
    },
    { statsJson: JSON.stringify(Array.from({ length: 65 }, () => ({}))) },
    { unexpected: true },
    { lastGameChunkId: -1 },
    { lastKeyFrameId: 1.2 },
  ])
    expect(() => parse(roflFixture({ metadata }))).toThrow();
  expect(() =>
    parse(roflFixture({ format: "ROFL2", metadata: { gameVersion: "15.1.1" } })),
  ).toThrow("disagree");
  const bad = roflFixture();
  bad[288] = 0xff;
  expect(() => parse(bad)).toThrow();
  bad[288] = 0;
  expect(() => parse(bad)).toThrow();
});
it("rejects invalid signatures, unsafe lengths and overlapping or truncated legacy sections", () => {
  for (const change of [
    (b: Buffer) => {
      b[0] = 0xd2;
    },
    (b: Buffer) => {
      b[4] = 3;
    },
    (b: Buffer) => {
      b[5] = 1;
    },
    (b: Buffer) => b.writeUInt16LE(287, 262),
    (b: Buffer) => b.writeUInt32LE(b.length + 1, 264),
    (b: Buffer) => b.writeUInt32LE(0, 272),
    (b: Buffer) => b.writeUInt32LE(5 * 1024 * 1024, 272),
    (b: Buffer) => b.writeUInt32LE(287, 268),
    (b: Buffer) => b.writeUInt32LE(0, 276),
    (b: Buffer) => b.writeUInt32LE(288, 276),
    (b: Buffer) => b.writeUInt32LE(33, 280),
    (b: Buffer) => b.writeUInt32LE(b.length + 1, 284),
    (b: Buffer) => b.writeUInt32LE(289, 284),
    (b: Buffer) => b.writeUInt16LE(1, b.length - 2),
    (b: Buffer) => b.writeBigUInt64LE(0n, b.length - 34),
    (b: Buffer) => b.writeUInt32LE(86_400_001, b.length - 26),
  ]) {
    const bad = roflFixture();
    change(bad);
    expect(() => parse(bad)).toThrow();
  }
  for (const bytes of [Buffer.alloc(0), Buffer.from("RIOT"), roflFixture().subarray(0, 280)])
    expect(() => parse(bytes)).toThrow();
  expect(() => roflLayout(Buffer.alloc(512), Buffer.alloc(4), replayFileMaxBytes + 1)).toThrow(
    "256 MiB",
  );
  const file = roflFixture(),
    layout = roflLayout(file.subarray(0, 288), file.subarray(-4), file.length);
  expect(() => parseRoflMetadata(layout, Buffer.alloc(1))).toThrow("Truncated");
  expect(() => parseRoflMetadata(layout, file.subarray(288, 288 + layout.metadataLength))).toThrow(
    "payload",
  );
});
it("rejects ROFL2 footer/header overlap, unknown version lengths and malformed footer JSON", () => {
  for (const change of [
    (b: Buffer) => {
      b[14] = 0;
    },
    (b: Buffer) => {
      b[14] = 81;
    },
    (b: Buffer) => {
      b[15] = 0xff;
    },
    (b: Buffer) => b.writeUInt32LE(0, b.length - 4),
    (b: Buffer) => b.writeUInt32LE(5 * 1024 * 1024, b.length - 4),
    (b: Buffer) => b.writeUInt32LE(b.length - 20, b.length - 4),
  ]) {
    const bad = roflFixture({ format: "ROFL2" });
    change(bad);
    expect(() => parse(bad)).toThrow();
  }
  const file = roflFixture({ format: "ROFL2" });
  expect(() => roflLayout(file.subarray(0, 14), file.subarray(-4), file.length)).toThrow(
    "Truncated",
  );
  expect(() => roflLayout(file.subarray(0, 16), file.subarray(-4), file.length)).toThrow("length");
  expect(() => roflLayout(file.subarray(0, 30), Buffer.alloc(3), file.length)).toThrow("Truncated");
});
it("keeps absent counters null and validates explicit retention configuration", () => {
  for (const value of [undefined, null, "", -1, 1.5, true, "unknown", "1000000001"])
    expect(statNumber(value)).toBeNull();
  expect(statNumber(0)).toBe(0);
  expect(statNumber("3")).toBe(3);
  expect(keepReplayFilesSchema.parse(undefined)).toBe(false);
  expect(keepReplayFilesSchema.parse("false")).toBe(false);
  expect(keepReplayFilesSchema.parse("true")).toBe(true);
  expect(() => keepReplayFilesSchema.parse("yes")).toThrow();
});
