import { z } from "zod";
import { defaultSamplePolicy } from "./statistics.js";

export const heatmapSubjectKinds = ["champion", "player", "role"] as const;
export const heatmapKinds = ["position", "death", "kill"] as const;
export const heatmapRoles = ["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"] as const;
export type HeatmapSubjectKind = (typeof heatmapSubjectKinds)[number];
export type HeatmapKind = (typeof heatmapKinds)[number];
/** Cells per side of the fixed map grid. */
export const heatmapGridSize = 16;
/** The map's world bounds, the same the minimap draws (https://hextechdocs.dev/map-data/). */
export const heatmapBounds = { minX: -120, minY: -120, maxX: 14870, maxY: 14980 } as const;
/** A heatmap below this many games is not drawn; its sample is still reported. */
export const heatmapMinimumGames = defaultSamplePolicy.minimum;

/** A cell's centre in world coordinates, for drawing on the blue-side map. */
export function cellCentre(cellX: number, cellY: number) {
  const { minX, minY, maxX, maxY } = heatmapBounds;
  return {
    x: Math.round(minX + ((cellX + 0.5) * (maxX - minX)) / heatmapGridSize),
    y: Math.round(minY + ((cellY + 0.5) * (maxY - minY)) / heatmapGridSize),
  };
}

export const heatmapQuerySchema = z.strictObject({
  subjectKind: z.enum(heatmapSubjectKinds),
  /** A catalog champion id, a PUUID or a role. */
  subject: z.string().regex(/^[A-Za-z0-9_-]{1,100}$/),
  kind: z.enum(heatmapKinds).default("position"),
  patch: z
    .string()
    .regex(/^\d{1,2}\.\d{1,2}$/)
    .optional(),
});
export type HeatmapQuery = z.input<typeof heatmapQuerySchema>;

export interface HeatmapSample {
  patch: string;
  games: number;
  points: number;
}
export interface Heatmap {
  subjectKind: HeatmapSubjectKind;
  subject: string;
  /** The champion's name, the player's Riot ID, or null for a role or an unnamed player. */
  label: string | null;
  kind: HeatmapKind;
  /** The selected patch, or null when the subject has no heatmap yet. */
  patch: string | null;
  /** Every patch with a heatmap for this subject and kind, newest first. */
  patches: HeatmapSample[];
  /** Games played by the subject with a stored timeline, and points binned on the grid. */
  games: number;
  points: number;
  minimumGames: number;
  /** Empty below the minimum sample. Cells without points are omitted. */
  cells: { cellX: number; cellY: number; x: number; y: number; points: number }[];
}
