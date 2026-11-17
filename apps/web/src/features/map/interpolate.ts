import type { TimelinePositionFrame } from "@summonersnet/data/contracts";

export interface ChampionPosition {
  x: number;
  y: number;
  /** Whether the position is a stored minute frame or a straight-line estimate between two. */
  basis: "frame" | "interpolated";
}

const frameTime = (f: TimelinePositionFrame) => f.timestampMs ?? f.minute * 60000;
const located = (
  f: TimelinePositionFrame | undefined,
): f is TimelinePositionFrame & {
  x: number;
  y: number;
} => f !== undefined && f.timestampMs !== null && f.x !== null && f.y !== null;

/** The last frame time across all tracks: the end of the scrubber. */
export function timelineEnd(tracks: readonly { frames: readonly TimelinePositionFrame[] }[]) {
  return Math.max(0, ...tracks.flatMap((t) => t.frames.map(frameTime)));
}

/**
 * A champion's position at `timeMs`, linearly interpolated between the surrounding minute
 * frames. Null when either surrounding frame is missing or has no coordinates, so a gap is
 * shown as a gap rather than a jump to the origin.
 */
export function positionAt(
  frames: readonly TimelinePositionFrame[],
  timeMs: number,
): ChampionPosition | null {
  let index = -1;
  for (let i = 0; i < frames.length && frameTime(frames[i]!) <= timeMs; i++) index = i;
  const before = frames[index];
  if (!located(before)) return null;
  const start = frameTime(before);
  if (start === timeMs) return { x: before.x, y: before.y, basis: "frame" };
  const after = frames[index + 1];
  if (!located(after)) return null;
  const share = (timeMs - start) / (frameTime(after) - start);
  return {
    x: Math.round(before.x + (after.x - before.x) * share),
    y: Math.round(before.y + (after.y - before.y) * share),
    basis: "interpolated",
  };
}

export const clock = (ms: number) =>
  `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, "0")}`;
