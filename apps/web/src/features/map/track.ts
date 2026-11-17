import { useEffect, useState } from "react";
import type { TrackRange } from "@summonersnet/data/contracts";

/** Track samples are fetched in aligned chunks of this length around the scrubber. */
export const chunkMs = 60_000;
/** Trails show this much recent movement. */
export const trailMs = 10_000;
/** Detector scores below this are drawn as low confidence. */
export const lowConfidence = 0.5;

export interface TrackPosition {
  x: number;
  y: number;
  confidence: number | null;
  low: boolean;
}
type Sample = TrackRange[number];

/** How long a sample stays current: one and a half sample intervals, and at least a second. */
export const staleAfterMs = (sampleRateHz: number) => Math.max(1000, 1500 / sampleRateHz);

/**
 * A champion's latest sample at or before `timeMs`, if recent enough. A null observation or no
 * current sample is a gap: tracks are never interpolated.
 */
export function trackPositionAt(
  samples: readonly Sample[],
  participantId: number,
  timeMs: number,
  staleMs: number,
): TrackPosition | null {
  let latest: Sample | undefined;
  for (const s of samples) if (s.timeMs <= timeMs) latest = s;
  if (!latest || timeMs - latest.timeMs > staleMs) return null;
  const o = latest.positions.find((p) => p.participantId === participantId);
  if (!o || o.x === null || o.y === null) return null;
  return {
    x: o.x,
    y: o.y,
    confidence: o.confidence,
    low: o.confidence === null || o.confidence < lowConfidence,
  };
}

/** The last {@link trailMs} of a champion's samples, with null observations kept as gaps. */
export function trailAt(samples: readonly Sample[], participantId: number, timeMs: number) {
  return samples
    .filter((s) => s.timeMs <= timeMs && s.timeMs > timeMs - trailMs)
    .map((s) => {
      const o = s.positions.find((p) => p.participantId === participantId);
      return { x: o?.x ?? null, y: o?.y ?? null };
    });
}

/**
 * Loads the chunk under the scrubber and the next one through the local track endpoint, keeping
 * loaded chunks. Only bounded ranges are requested; nothing is read when disabled.
 */
export function useTrackSamples(
  matchId: string,
  enabled: boolean,
  timeMs: number,
  fetcher: typeof fetch = fetch,
) {
  const [chunks, setChunks] = useState<ReadonlyMap<number, TrackRange>>(new Map());
  const [failed, setFailed] = useState(false);
  const current = Math.floor(timeMs / chunkMs);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    for (const chunk of [current, current + 1]) {
      if (chunks.has(chunk)) continue;
      const params = new URLSearchParams({
        fromMs: String(chunk * chunkMs),
        toMs: String(chunk * chunkMs + chunkMs - 1),
      });
      fetcher(`/api/solo-games/${encodeURIComponent(matchId)}/track?${params.toString()}`)
        .then(async (response) => {
          if (!response.ok) throw new Error(String(response.status));
          const samples = (await response.json()) as TrackRange;
          if (!cancelled) setChunks((all) => new Map(all).set(chunk, samples));
        })
        .catch(() => {
          if (!cancelled) setFailed(true);
        });
    }
    return () => {
      cancelled = true;
    };
  }, [enabled, current, chunks, matchId, fetcher]);
  const samples = [current - 1, current, current + 1].flatMap((c) => chunks.get(c) ?? []);
  return { samples, loaded: chunks.has(current), failed };
}
