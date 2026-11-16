import { describe, expect, it } from "vitest";
import timeline from "../../tests/riot/timeline-euw1.json" with { type: "json" };
import { parseRiotTimeline } from "../providers/riot-timeline.js";
import { extractFeatures } from "./wp-features.js";
import { attributeEvents, type WpaEvent } from "./wpa.js";

const teams = new Map(Array.from({ length: 10 }, (_, i) => [i + 1, i < 5 ? 100 : 200]));
const parsed = parseRiotTimeline(timeline, "EUW1_7612345678");
const rows = extractFeatures(parsed.frames, parsed.events, teams, true);
const events: WpaEvent[] = parsed.events;
// A hand-set model that values only kill, tower and dragon differences, so values can be checked
// by hand: kill difference / 10, tower difference / 5 and dragon difference / 4 add to the odds.
const model = { intercept: 0, weights: [0, 0, 0, 0, 1, 1, 0, 0, 0, 1, 0, 0] };
const sigmoid = (z: number) => 1 / (1 + Math.exp(-z));

describe("win probability added", () => {
  const scored = attributeEvents(rows, events, teams, model);
  it("values each kill and objective by the credited side's change, with the economy held fixed", () => {
    expect(scored.map((e) => [e.type, e.team])).toEqual([
      ["CHAMPION_KILL", "blue"],
      ["ELITE_MONSTER_KILL", "blue"],
      ["BUILDING_KILL", "blue"],
    ]);
    expect(scored[0]!.delta).toBeCloseTo(sigmoid(0.1) - sigmoid(0));
    expect(scored[1]!.delta).toBeCloseTo(sigmoid(0.35) - sigmoid(0.1));
    expect(scored[2]!.delta).toBeCloseTo(sigmoid(0.55) - sigmoid(0.35));
  });
  it("splits half to the killer, half among assisters, and charges the victim", () => {
    const kill = scored[0]!;
    const d = kill.delta!;
    expect(kill.participants).toEqual([
      { participantId: 2, role: "killer", value: d / 2 },
      { participantId: 1, role: "assister", value: d / 4 },
      { participantId: 4, role: "assister", value: d / 4 },
      { participantId: 7, role: "victim", value: -d },
    ]);
    // An unassisted taker gets the whole value.
    expect(scored[1]!.participants).toEqual([
      { participantId: 2, role: "taker", value: scored[1]!.delta },
    ]);
    // Minions took the tower: the assister keeps half; the team keeps the full value.
    expect(scored[2]!.participants).toEqual([
      { participantId: 1, role: "assister", value: scored[2]!.delta! / 2 },
    ]);
  });
  it("gives red-credited events red's change, and leaves unknown economies unscored", () => {
    const redKill: WpaEvent = {
      ...events.find((e) => e.type === "CHAMPION_KILL")!,
      seq: 99,
      participantId: 7,
      victimId: 2,
      assistingParticipantIds: null,
    };
    const [red] = attributeEvents(rows, [redKill], teams, model);
    expect(red).toMatchObject({
      team: "red",
      delta: expect.closeTo(sigmoid(0) - sigmoid(-0.1)) as number,
    });
    expect(red!.participants.map((p) => [p.participantId, p.role])).toEqual([
      [7, "killer"],
      [2, "victim"],
    ]);
    const unknown = rows.map((r) => ({ ...r, goldDiff: null }));
    expect(
      attributeEvents(unknown, events, teams, model).every(
        (e) => e.delta === null && !e.participants.length,
      ),
    ).toBe(true);
    // Before the first frame there is no economy to score against.
    expect(attributeEvents([], events, teams, model)[0]!.delta).toBeNull();
  });
});
