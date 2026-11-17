import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import timeline from "../../tests/riot/timeline-euw1.json" with { type: "json" };
import { parseRiotTimeline } from "../providers/riot-timeline.js";
import { parseReplayTrackFile } from "./replay-tracks.js";
import {
  accuracyThresholds,
  compareTrack,
  evaluateAccuracy,
  percentile,
  type AccuracyInput,
} from "./track-accuracy.js";

// Committed fixtures: the stored Riot timeline and a constructed track of the same game, one
// sample a second, offset from the timeline by (50p, -40p) for participant p (an error of
// 64.03p units); participant 10 is never seen and participant 9 is missing at 1:00. The timeline
// has no minute 2 position for participant 3, so that mark is not compared and the track has no
// position there either (seconds 91-120).
const track = parseReplayTrackFile(
  readFileSync(new URL("../../tests/replay-tracks/accuracy-euw1.json", import.meta.url), "utf8"),
);
const frames = parseRiotTimeline(timeline, track.gameId).frames;
const input: AccuracyInput = {
  roster: track.roster,
  samples: track.samples.map((s) => ({
    timeMs: s.timeMs,
    positions: s.positions.map((o) => ({
      participantId: o.participantId,
      x: o.position?.x ?? null,
      y: o.position?.y ?? null,
    })),
  })),
  frames,
};

describe("compareTrack on the committed fixtures", () => {
  const report = compareTrack(input);
  it("reproduces the overall report and meets the documented thresholds", () => {
    expect(report.overall).toEqual({
      comparisons: 25,
      missedMarks: 4,
      unsampledMarks: 0,
      mean: 315,
      median: 320.2,
      p95: 576.3,
      observations: 1210,
      nullObservations: 152,
      nullShare: 0.1256,
    });
    expect(evaluateAccuracy(report.overall)).toEqual({ pass: true, failures: [] });
  });
  it("reports each champion, with unknowns null rather than zero", () => {
    expect(report.champions).toHaveLength(10);
    expect(report.champions[0]).toMatchObject({
      championId: 103,
      participantIds: [1],
      comparisons: 3,
      mean: 64,
      median: 64,
      p95: 64,
      nullShare: 0,
    });
    expect(report.champions[8]).toMatchObject({
      participantIds: [9],
      comparisons: 2,
      missedMarks: 1,
    });
    expect(report.champions[9]).toMatchObject({
      participantIds: [10],
      comparisons: 0,
      missedMarks: 3,
      mean: null,
      median: null,
      p95: null,
      nullShare: 1,
    });
  });
});

describe("accuracy rules", () => {
  it("matches only samples within the tolerance and counts unsampled marks", () => {
    const late = { ...input, samples: input.samples.filter((s) => s.timeMs >= 30000) };
    const report = compareTrack(late);
    // The ten minute 0 marks have no sample within a second.
    expect(report.overall).toMatchObject({ comparisons: 16, unsampledMarks: 10, missedMarks: 3 });
    expect(compareTrack({ ...input, samples: [] }).overall).toMatchObject({
      comparisons: 0,
      unsampledMarks: 29,
      nullShare: null,
      mean: null,
    });
  });
  it("uses nearest-rank percentiles", () => {
    expect(percentile([1, 2, 3, 4], 0.5)).toBe(2);
    expect(percentile([1, 2, 3, 4], 0.95)).toBe(4);
    expect(percentile([7], 0)).toBe(7);
    expect(percentile([], 0.5)).toBeNull();
  });
  it("fails reports beyond any threshold or with too few marks", () => {
    const stats = compareTrack(input).overall;
    expect(evaluateAccuracy({ ...stats, median: 401, p95: 1201, nullShare: 0.3 })).toEqual({
      pass: false,
      failures: [
        "Median error 401 exceeds 400.",
        "95th percentile error 1201 exceeds 1200.",
        "Null share 0.3 exceeds 0.25.",
      ],
    });
    expect(
      evaluateAccuracy({ ...stats, comparisons: 9 }, { ...accuracyThresholds }).failures,
    ).toEqual(["Only 9 minute marks compared; at least 10 are needed."]);
  });
});
