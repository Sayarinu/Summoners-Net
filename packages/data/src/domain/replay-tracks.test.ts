import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import {
  parseReplayTrackFile,
  replayTrackMaxBytes,
  replayTrackSchema,
  type ReplayTrack,
} from "../contracts.js";

const fixture = (name: string) =>
  readFileSync(new URL(`../../tests/replay-tracks/${name}.json`, import.meta.url), "utf8");
const valid = () => parseReplayTrackFile(fixture("valid-v1"));

it("round-trips the public contract without filling gaps or losing provenance and scores", () => {
  const track = valid();
  expect(parseReplayTrackFile(JSON.stringify(track))).toEqual(track);
  expect(track).toMatchObject({
    formatVersion: 1,
    gameId: "EUW1_1234567890",
    platform: "euw1",
    sampleRateHz: 5,
    capture: { replaySha256: "a".repeat(64), minimap: { width: 512, height: 512 } },
  });
  expect(track.samples[0]!.positions[0]).toEqual({
    participantId: 1,
    position: { x: 7375, y: 7430, pixel: { x: 256, y: 256 } },
    confidence: 0.95,
  });
  expect(track.samples[0]!.positions[1]).toEqual({
    participantId: 2,
    position: null,
    confidence: 0.3,
  });
  expect(
    track.samples[1]!.positions.every((p) => p.position === null && p.confidence === null),
  ).toBe(true);
});

it.each(["invalid-roster", "invalid-time", "invalid-position", "invalid-confidence"])(
  "rejects the committed %s file",
  (name) => expect(() => parseReplayTrackFile(fixture(name))).toThrow(),
);
it("gives explicit errors for unknown versions, malformed JSON and oversized UTF-8 input", () => {
  expect(() => parseReplayTrackFile(fixture("unknown-version"))).toThrow(
    "Unsupported replay track format version; expected 1.",
  );
  expect(() => parseReplayTrackFile("{broken")).toThrow("valid JSON");
  expect(() => parseReplayTrackFile("€".repeat(Math.floor(replayTrackMaxBytes / 3) + 1))).toThrow(
    "64 MiB",
  );
});

it("rejects inconsistent identity, crop, chronology and participant observations", () => {
  const invalid: ((track: ReplayTrack) => void)[] = [
    (t) => {
      t.gameId = "KR_123";
    },
    (t) => {
      t.roster[1]!.championId = t.roster[0]!.championId;
    },
    (t) => {
      t.roster[0]!.teamId = 200;
    },
    (t) => {
      t.capture.minimap.left = t.capture.sourceWidth;
    },
    (t) => {
      t.capture.minimap.top = t.capture.sourceHeight;
    },
    (t) => {
      t.samples[1]!.timeMs = 0;
    },
    (t) => {
      t.samples[0]!.positions[1]!.participantId = 1;
    },
    (t) => {
      t.samples[0]!.positions[0]!.confidence = null;
    },
    (t) => {
      t.samples[0]!.positions[0]!.position!.pixel.x = -1;
    },
    (t) => {
      t.samples[0]!.positions[0]!.position!.pixel.y = -1;
    },
    (t) => {
      t.samples[0]!.positions[0]!.position!.pixel.x = 513;
    },
    (t) => {
      t.samples[0]!.positions[0]!.position!.pixel.y = 513;
    },
    (t) => {
      t.samples[0]!.positions[0]!.position!.x = Infinity;
    },
    (t) => {
      t.sampleRateHz = NaN;
    },
  ];
  for (const change of invalid) {
    const track = valid();
    change(track);
    expect(replayTrackSchema.safeParse(track).success).toBe(false);
  }
});

it("requires explicit fields and accepts boundary coordinates, zero confidence and unordered rosters", () => {
  const track = valid();
  track.roster.reverse();
  track.samples[0]!.positions.reverse();
  track.samples[0]!.positions[9] = {
    participantId: 1,
    position: { x: -120, y: 14980, pixel: { x: 0, y: 0 } },
    confidence: 0,
  };
  track.samples[1]!.positions[0] = {
    participantId: 1,
    position: { x: 14870, y: -120, pixel: { x: 512, y: 512 } },
    confidence: 1,
  };
  expect(replayTrackSchema.parse(track)).toEqual(track);
  expect(replayTrackSchema.safeParse({ ...track, sampleRateHz: "5" }).success).toBe(false);
  expect(replayTrackSchema.safeParse({ ...track, extra: "ignored?" }).success).toBe(false);
  expect(replayTrackSchema.safeParse({ ...track, samples: [] }).success).toBe(false);
  expect(replayTrackSchema.safeParse({ ...track, formatVersion: undefined }).success).toBe(false);
  track.samples[0]!.positions.pop();
  expect(replayTrackSchema.safeParse(track).success).toBe(false);
});
