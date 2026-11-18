import { describe, expect, it } from "vitest";
import { checkpointsFrom, vectorizeCheckpoint } from "./wp-checkpoints.js";
import { predict, train, type Example } from "./wp-model.js";

// Blue team row values from the 2026 Oracle's Elixir file's shape.
const statistics = {
  golddiffat10: -538,
  xpdiffat10: -724,
  csdiffat10: -37,
  killsat10: 5,
  opp_killsat10: 6,
  golddiffat15: 120,
  xpdiffat15: 300,
  csdiffat15: 4,
  killsat15: 7,
  opp_killsat15: 6,
  golddiffat20: 1500,
  xpdiffat20: 900,
  csdiffat20: 12,
  killsat20: 9,
  opp_killsat20: 6,
  // The game ended before 25 minutes was recorded.
  golddiffat25: null,
};
describe("pro checkpoint win probability", () => {
  it("reads the four checkpoints from a team row, leaving missing ones unknown", () => {
    const checkpoints = checkpointsFrom(statistics);
    expect(checkpoints.map((c) => c.minute)).toEqual([10, 15, 20, 25]);
    expect(checkpoints[0]).toEqual({
      minute: 10,
      goldDiff: -538,
      xpDiff: -724,
      csDiff: -37,
      killDiff: -1,
    });
    expect(checkpoints[3]).toEqual({
      minute: 25,
      goldDiff: null,
      xpDiff: null,
      csDiff: null,
      killDiff: null,
    });
    expect(vectorizeCheckpoint(checkpoints[3]!)).toBeNull();
    expect(vectorizeCheckpoint(checkpoints[2]!)).toEqual([20 / 30, 0.3, 0.18, 0.12, 0.3, 0.2]);
    expect(checkpointsFrom({ golddiffat10: "x" })[0]!.goldDiff).toBeNull();
  });
  it("scores checkpoints with a model trained on separable fixture games", () => {
    const examples: Example[] = Array.from({ length: 80 }, (_, game) => {
      const lead = (game % 2 ? 1 : -1) * (500 + game * 20);
      return [10, 15, 20, 25].map((minute) => ({
        matchId: `G${game}`,
        x: vectorizeCheckpoint({
          minute,
          goldDiff: lead,
          xpDiff: lead / 2,
          csDiff: lead / 50,
          killDiff: Math.sign(lead) * 2,
        })!,
        y: lead > 0 ? (1 as const) : (0 as const),
      }));
    }).flat();
    const model = train(examples);
    const ahead = vectorizeCheckpoint(checkpointsFrom(statistics)[2]!)!;
    const behind = vectorizeCheckpoint(checkpointsFrom(statistics)[0]!)!;
    expect(predict(model, ahead)).toBeGreaterThan(0.5);
    expect(predict(model, behind)).toBeLessThan(0.5);
  });
});
