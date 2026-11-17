import { defaultSamplePolicy } from "./statistics.js";

/**
 * Early jungle path inference from Riot timelines. The rules are documented in
 * docs/analytics/jungle-paths.md; every call is made in blue side's frame of reference.
 */
export type JungleSide = "blue-buff" | "red-buff" | "invade";
export type JungleRoute = "same-side" | "cross" | "invade";
export type GankLane = "top" | "mid" | "bot";
export type Confidence = "high" | "low";

/** Minute frames that make up the first clear: the camp waited at, then the clear. */
export const clearMinutes = [1, 2, 3] as const;
/** Kills after this are not counted as the first gank. */
export const gankWindowMs = 10 * 60_000;
/** A cluster's win rate is null below this many games with a result. */
export const junglePathMinimumSample = defaultSamplePolicy.minimum;

// Red side is rotated half a turn about the map centre, using the minimap bounds
// (-120..14870 by -120..14980), so both teams' junglers are read from blue side.
const mirrorX = -120 + 14870;
const mirrorY = -120 + 14980;
/** Points this close to the mid-lane diagonal are on neither side of the jungle. */
const sideMargin = 600;
/** Points at least this far from the diagonal are classified with high confidence. */
const confidentMargin = 2000;
/** x + y beyond the river by more than this is the enemy jungle. */
const riverSum = mirrorX;
const invadeMargin = 1000;

export interface Point {
  x: number;
  y: number;
}
export interface JunglerTimeline {
  participantId: number;
  side: "blue" | "red";
  frames: readonly { minute: number; x: number | null; y: number | null }[];
  kills: readonly {
    timestampMs: number;
    x: number | null;
    y: number | null;
    killerId: number | null;
    assistingParticipantIds: readonly number[] | null;
  }[];
}
export interface JunglePath {
  startSide: JungleSide | null;
  startConfidence: Confidence | null;
  route: JungleRoute | null;
  gankLane: GankLane | null;
  gankConfidence: Confidence | null;
  gankMinute: number | null;
  /** Normalized positions at {@link clearMinutes}; null where the frame or coordinates are missing. */
  path: (Point | null)[];
}

export function normalize(point: Point, side: "blue" | "red"): Point {
  return side === "red" ? { x: mirrorX - point.x, y: mirrorY - point.y } : point;
}

/** Which side of its own jungle a normalized point is on, with a confidence; null near mid. */
export function jungleSide(p: Point): { side: JungleSide; confidence: Confidence } | null {
  if (p.x + p.y > riverSum + invadeMargin)
    return {
      side: "invade",
      confidence: p.x + p.y > riverSum + 2 * invadeMargin ? "high" : "low",
    };
  const offset = p.y - p.x;
  if (Math.abs(offset) < sideMargin) return null;
  return {
    side: offset > 0 ? "blue-buff" : "red-buff",
    confidence: Math.abs(offset) >= confidentMargin ? "high" : "low",
  };
}

/** The lane a normalized point is in; null in a base or the jungle. */
export function laneOf(p: Point): GankLane | null {
  const base = (p.x < 3000 && p.y < 3000) || (p.x > 11800 && p.y > 11800);
  if (base) return null;
  if (Math.abs(p.x - p.y) < 1500) return "mid";
  if (p.x < 2500 || p.y > 12300) return "top";
  if (p.y < 2500 || p.x > 12300) return "bot";
  return null;
}

/**
 * Infers one jungler's start, first clear route and first gank. Unknown parts are null, never
 * guessed: a missing frame, a point near mid, or no lane kill within {@link gankWindowMs}.
 */
export function inferJunglePath(game: JunglerTimeline): JunglePath {
  const located = (minute: number) => {
    const f = game.frames.find((frame) => frame.minute === minute);
    return f && f.x !== null && f.y !== null ? normalize({ x: f.x, y: f.y }, game.side) : null;
  };
  const path = clearMinutes.map(located);
  const start = path[0] ? jungleSide(path[0]) : null;
  const end = path[path.length - 1];
  const finish = end ? jungleSide(end) : null;
  const route: JungleRoute | null =
    !start || !finish
      ? null
      : finish.side === "invade" || start.side === "invade"
        ? "invade"
        : finish.side === start.side
          ? "same-side"
          : "cross";
  const gank = [...game.kills]
    .sort((a, b) => a.timestampMs - b.timestampMs)
    .flatMap((k) => {
      if (k.timestampMs > gankWindowMs || k.x === null || k.y === null) return [];
      const killer = k.killerId === game.participantId;
      if (!killer && !(k.assistingParticipantIds ?? []).includes(game.participantId)) return [];
      const lane = laneOf(normalize({ x: k.x, y: k.y }, game.side));
      return lane ? [{ lane, killer, minute: Math.floor(k.timestampMs / 60_000) }] : [];
    })[0];
  return {
    startSide: start?.side ?? null,
    startConfidence: start?.confidence ?? null,
    route,
    gankLane: gank?.lane ?? null,
    gankConfidence: gank ? (gank.killer ? "high" : "low") : null,
    gankMinute: gank?.minute ?? null,
    path,
  };
}

export interface JunglePathCluster {
  startSide: JungleSide | null;
  route: JungleRoute | null;
  gankLane: GankLane | null;
  games: number;
  resultGames: number;
  /** Null below {@link junglePathMinimumSample} games with a result. */
  winRate: number | null;
  /** Mean normalized positions at {@link clearMinutes}; null where no game had one. */
  path: (Point | null)[];
}
export interface ChampionJunglePaths {
  patch: string | null;
  /** Jungle games on the patch, whatever was inferred. */
  games: number;
  minimumSample: number;
  /** The most played paths first. */
  clusters: JunglePathCluster[];
}
