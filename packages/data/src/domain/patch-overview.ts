import { z } from "zod";
import type { BuildItem } from "./builds.js";
import type { ProportionTrend, SampleStatus } from "./statistics.js";
import type { SampledValue } from "./historical.js";
import type { TrendingChampion } from "./trending.js";
export const overviewPatchSchema = z.string().regex(/^[1-9]\d?\.(?:0|[1-9]\d?)$/);
export type PatchChampion = Pick<
  TrendingChampion,
  "championKey" | "championId" | "name" | "imageUrl"
>;
export interface PatchTrend extends PatchChampion {
  metric: "pick" | "win";
  change: ProportionTrend;
}
export interface NewPatchBuild extends PatchChampion {
  role: TrendingChampion["role"];
  items: BuildItem[];
  games: number;
  share: SampledValue;
  previousSample: number;
}
export interface PatchProLeader extends PatchChampion {
  picks: number;
  bans: number;
  presence: SampledValue;
  sample: SampleStatus;
}
export interface PatchOverview {
  patch: string;
  previousPatch: string | null;
  risers: PatchTrend[];
  fallers: PatchTrend[];
  builds: NewPatchBuild[];
  pro: PatchProLeader[];
}
