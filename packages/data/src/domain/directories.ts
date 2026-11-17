import type { PatchChampion } from "./patch-overview.js";

/** Champions in the newest catalog patch, by name; bounded by the catalog itself. */
export interface ChampionDirectory {
  patch: string | null;
  champions: (PatchChampion & { championId: string; name: string })[];
}
/** Patches with stored champion aggregates, newest first, and which sources have them. */
export interface PatchDirectory {
  patches: { patch: string; solo: boolean; pro: boolean }[];
}
export const directoryLimit = 500;
export const patchDirectoryLimit = 50;
