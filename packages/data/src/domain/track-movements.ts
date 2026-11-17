/**
 * Rotations, roams and recalls detected from a replay track's samples. The rules are documented
 * in docs/analytics/track-movements.md. Coordinates are absolute (not side-normalized), so lane
 * names mean the same lane for both teams.
 */
export type TrackZone = "top" | "mid" | "bot" | "jungle" | "blue-base" | "red-base";
export interface TrackMovement {
  kind: "recall" | "roam" | "rotation";
  /** When the movement started and was confirmed, in game milliseconds. */
  startMs: number;
  endMs: number;
  teamId: 100 | 200;
  participantIds: number[];
  from: TrackZone | null;
  to: TrackZone;
}
export interface TrackInput {
  roster: readonly { participantId: number; teamId: number }[];
  samples: readonly {
    timeMs: number;
    positions: readonly {
      participantId: number;
      position: { x: number; y: number } | null;
      confidence: number | null;
    }[];
  }[];
}

/** Samples below this detector score are drawn but not used to detect movements. */
export const confidentScore = 0.5;
/** A recall is a jump into the own base within this long of the previous confident sample. */
export const recallGapMs = 4000;
/** A lane stay counts once it lasts this long; a roam needs this long in the new lane. */
export const minimumStayMs = 10_000;
/** A roam starts from a lane the champion stayed in for at least this long. */
export const originStayMs = 30_000;
/** The move from one lane to the next takes at most this long. */
export const roamTransitMs = 60_000;
/** Roams by three or more teammates to the same lane starting this close together rotate. */
export const rotationWindowMs = 20_000;
export const rotationSize = 3;

export function zoneOf(p: { x: number; y: number }): TrackZone {
  if (p.x + p.y < 4500) return "blue-base";
  if (p.x + p.y > 25000) return "red-base";
  if (Math.abs(p.x - p.y) < 1500) return "mid";
  if (p.x < 2500 || p.y > 12300) return "top";
  if (p.y < 2500 || p.x > 12300) return "bot";
  return "jungle";
}
const lanes: readonly TrackZone[] = ["top", "mid", "bot"];
const ownBase = (teamId: number): TrackZone => (teamId === 100 ? "blue-base" : "red-base");

interface Stay {
  zone: TrackZone;
  startMs: number;
  endMs: number;
}

export function detectMovements(track: TrackInput): TrackMovement[] {
  const recalls: TrackMovement[] = [];
  const roams: (TrackMovement & { arrival: number })[] = [];
  for (const { participantId, teamId } of track.roster) {
    if (teamId !== 100 && teamId !== 200) continue;
    const points = track.samples.flatMap((s) => {
      const o = s.positions.find((p) => p.participantId === participantId);
      return o?.position && o.confidence !== null && o.confidence >= confidentScore
        ? [{ timeMs: s.timeMs, zone: zoneOf(o.position) }]
        : [];
    });
    const base = ownBase(teamId);
    for (let i = 1; i < points.length; i++) {
      const [a, b] = [points[i - 1]!, points[i]!];
      if (a.zone !== base && b.zone === base && b.timeMs - a.timeMs <= recallGapMs)
        recalls.push({
          kind: "recall",
          startMs: a.timeMs,
          endMs: b.timeMs,
          teamId,
          participantIds: [participantId],
          from: a.zone,
          to: base,
        });
    }
    // Runs of the same zone, then lane stays long enough to count.
    const runs: Stay[] = [];
    for (const p of points) {
      const last = runs.at(-1);
      if (last && last.zone === p.zone) last.endMs = p.timeMs;
      else runs.push({ zone: p.zone, startMs: p.timeMs, endMs: p.timeMs });
    }
    const stays: (Stay & { viaBase: boolean })[] = [];
    let viaBase = false;
    for (const run of runs) {
      if (run.zone === "blue-base" || run.zone === "red-base") viaBase = true;
      if (!lanes.includes(run.zone) || run.endMs - run.startMs < minimumStayMs) continue;
      const last = stays.at(-1);
      if (last && last.zone === run.zone && !viaBase) last.endMs = run.endMs;
      else stays.push({ ...run, viaBase });
      viaBase = false;
    }
    for (let i = 1; i < stays.length; i++) {
      const [from, to] = [stays[i - 1]!, stays[i]!];
      if (
        from.zone !== to.zone &&
        !to.viaBase &&
        from.endMs - from.startMs >= originStayMs &&
        to.startMs - from.endMs <= roamTransitMs
      )
        roams.push({
          kind: "roam",
          startMs: from.endMs,
          endMs: to.startMs,
          arrival: to.startMs,
          teamId,
          participantIds: [participantId],
          from: from.zone,
          to: to.zone,
        });
    }
  }
  // Group roams into rotations: three or more teammates arriving in the same lane together.
  const rotations: TrackMovement[] = [];
  const grouped = new Set<(typeof roams)[number]>();
  const byArrival = [...roams].sort((a, b) => a.arrival - b.arrival);
  for (const first of byArrival) {
    if (grouped.has(first)) continue;
    const group = byArrival.filter(
      (r) =>
        !grouped.has(r) &&
        r.teamId === first.teamId &&
        r.to === first.to &&
        r.arrival >= first.arrival &&
        r.arrival - first.arrival <= rotationWindowMs,
    );
    if (new Set(group.map((r) => r.participantIds[0])).size < rotationSize) continue;
    group.forEach((r) => grouped.add(r));
    rotations.push({
      kind: "rotation",
      startMs: Math.min(...group.map((r) => r.startMs)),
      endMs: Math.max(...group.map((r) => r.endMs)),
      teamId: first.teamId,
      participantIds: [...new Set(group.flatMap((r) => r.participantIds))].sort((a, b) => a - b),
      from: null,
      to: first.to,
    });
  }
  const single = roams.filter((r) => !grouped.has(r)).map(({ arrival: _arrival, ...r }) => r);
  return [...recalls, ...single, ...rotations].sort(
    (a, b) => a.startMs - b.startMs || a.kind.localeCompare(b.kind),
  );
}
