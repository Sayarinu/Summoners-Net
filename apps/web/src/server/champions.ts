import "server-only";
import {
  championOverviewQuerySchema,
  matchupRoles,
  tierListQuerySchema,
  type MatchupRow,
} from "@summonersnet/data/contracts";
import type { MatchupSummary } from "../features/champions/presentation";
import { data } from "./data";

// "all" (and an empty value) means no filter for that field.
const filters = (params: Record<string, string | string[] | undefined>) =>
  Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== "" && v !== "all"),
  );
/**
 * Validates the tier list query string; an invalid one shows an error instead of data. Without a
 * chosen source it opens on pro play when no solo-queue games are stored.
 */
export async function loadTierList(params: Record<string, string | string[] | undefined>) {
  const parsed = tierListQuerySchema.safeParse(filters(params));
  if (!parsed.success)
    return {
      list: null,
      error:
        "Choose filters from the lists: a patch such as 16.22, a role, a region, a tier and a sort.",
    };
  const list = await data().tierList(parsed.data);
  if (params.source === undefined && list.query.source === "solo" && !list.facets.patches.length)
    return { list: await data().tierList({ ...parsed.data, source: "pro" }), error: null };
  return { list, error: null };
}

const filterError =
  "Choose filters from the lists: a patch such as 16.22, a role, a region and a tier.";
/**
 * Validates the champion id and filters. Unknown champions return null (not found); invalid
 * filters show the overview for the default filters with an error.
 */
export async function loadChampionOverview(
  championId: string,
  params: Record<string, string | string[] | undefined>,
) {
  const id = championOverviewQuerySchema.shape.champion.safeParse(championId);
  if (!id.success) return null;
  const input = filters(params);
  for (const name of ["playersSort", "playersPage"])
    if (params[name] !== undefined) input[name] = params[name];
  const parsed = championOverviewQuerySchema.safeParse({ ...input, champion: id.data });
  const query = parsed.success ? parsed.data : { champion: id.data };
  let overview = await data().championOverview(query);
  if (!overview) return null;
  // Without a chosen source, open on pro play when no solo-queue games are stored.
  if (
    params.source === undefined &&
    overview.query.source === "solo" &&
    !overview.facets.patches.length
  )
    overview = (await data().championOverview({ ...query, source: "pro" })) ?? overview;
  // Counter-pick values are per lane role; the all-roles view has none.
  const role = matchupRoles.find((r) => r === overview.query.role);
  const draftValue =
    role && overview.patch
      ? await data().championBlindability({
          championKey: overview.champion.key,
          source: overview.query.source,
          patch: overview.patch,
          role,
        })
      : null;
  // Jungle paths come from solo-queue timelines on the overview's patch.
  const junglePaths =
    overview.patch && overview.query.source === "solo"
      ? await data().championJunglePaths({
          championKey: overview.champion.key,
          patch: overview.patch,
        })
      : null;
  // Best and worst lane matchups: the selected role, or the champion's most played one.
  const matchupRole = role ?? overview.roles[0]?.role;
  const matchupSummary =
    matchupRole && overview.patch
      ? await loadMatchupSummary(overview.champion.id, {
          source: overview.query.source,
          patch: overview.patch,
          role: matchupRole,
        })
      : null;
  return {
    overview,
    draftValue,
    junglePaths,
    matchupSummary,
    error: parsed.success ? null : filterError,
  };
}

const summarySize = 5;
/**
 * The opponents with the highest and lowest shrunk win rates, among those with enough games for
 * an estimate. Sorting and the minimum sample are applied in SQL.
 */
async function loadMatchupSummary(
  champion: string,
  scope: { source: "solo" | "pro"; patch: string; role: (typeof matchupRoles)[number] },
): Promise<MatchupSummary | null> {
  const page = (order: "asc" | "desc") =>
    data().championMatchups({
      ...scope,
      champion,
      sort: "winRate",
      value: "shrunk",
      order,
      pageSize: summarySize,
    });
  const [best, worst] = await Promise.all([page("desc"), page("asc")]);
  if (!best || !worst || best.patch !== scope.patch) return null;
  const known = (rows: MatchupRow[]) => rows.filter((r) => r.metrics.winRate.shrunk !== null);
  // An opponent is a strength above the champion's own win rate and a weakness below it.
  const above = (r: MatchupRow) => r.metrics.winRate.shrunk! >= (r.metrics.winRate.baseline ?? 0.5);
  const strong = known(best.page.items).filter(above);
  const weak = known(worst.page.items).filter((r) => !above(r));
  return {
    role: scope.role,
    source: scope.source,
    patch: scope.patch,
    opponents: best.page.total,
    best: strong,
    worst: weak,
  };
}
