import {
  draftAssistantQuerySchema,
  rankDraftCandidates,
  type DraftAssistant,
  type DraftAssistantQuery,
  type DraftCandidateInput,
} from "../domain/draft-assistant.js";
import type { MetricCounts } from "../domain/matchups.js";
import type { PatchChampion } from "../domain/patch-overview.js";
import type { Executor } from "./database.js";

const championJson = (key: string, alias: string) =>
  `jsonb_build_object('championKey',${key},'championId',${alias}.champion_id,'name',${alias}.name,
    'imageUrl',CASE WHEN ${alias}.asset_hash IS NULL THEN NULL ELSE '/api/images/'||${alias}.asset_hash END)`;

/**
 * Ranks the candidates for one role from stored aggregates only: blindability scores, lane
 * matchups and solo-queue duos. Picked and banned champions are never candidates.
 */
export async function draftAssistant(
  db: Executor,
  input: DraftAssistantQuery,
): Promise<DraftAssistant> {
  const q = draftAssistantQuerySchema.parse(input);
  const ids = [...new Set([...q.blue, ...q.red].map((p) => p.champion).concat(q.bans))];
  const scope = (
    await db.query<{
      patch: string | null;
      patches: string[];
      champions: {
        championId: string;
        championKey: number;
        name: string;
        imageUrl: string | null;
      }[];
    }>(
      `WITH available AS (
        SELECT p.patch_key,p.release_order FROM patches p
        WHERE EXISTS (SELECT 1 FROM blindability_scores b WHERE b.source=$1 AND b.patch_key=p.patch_key)
      ), chosen AS (
        SELECT patch_key FROM patches WHERE patch_key=coalesce($2::text,
          (SELECT patch_key FROM available ORDER BY release_order DESC LIMIT 1))
      ), named AS (
        SELECT DISTINCT ON (c.champion_id) c.champion_id,c.champion_key,c.name,i.asset_hash
        FROM catalog_champions c JOIN patches p USING(patch_key)
        LEFT JOIN catalog_images i ON i.patch_key=c.patch_key AND i.kind='champion' AND i.catalog_id=c.champion_id
        WHERE c.champion_id=ANY($3::text[]) ORDER BY c.champion_id,p.release_order DESC
      )
      SELECT (SELECT patch_key FROM chosen) AS patch,
        coalesce((SELECT jsonb_agg(patch_key ORDER BY release_order DESC) FROM (
          SELECT * FROM available ORDER BY release_order DESC LIMIT 50) a),'[]') AS patches,
        coalesce((SELECT jsonb_agg(${championJson("n.champion_key", "n")}) FROM named n),'[]') AS champions`,
      [q.source, q.patch ?? null, ids],
    )
  ).rows[0]!;
  const byId = new Map(scope.champions.map((c) => [c.championId, c]));
  const ours = q.side === "blue" ? q.blue : q.red,
    theirs = q.side === "blue" ? q.red : q.blue;
  const laneOpponent = theirs.find((p) => p.role === q.role);
  const opponent = laneOpponent ? (byId.get(laneOpponent.champion) ?? null) : null;
  // Synergy needs the ally's role, and duo samples exist only for solo queue.
  const allies = ours.flatMap((p) => {
    const c = byId.get(p.champion);
    return c && p.role ? [{ champion: c, role: p.role }] : [];
  });
  const result: Omit<DraftAssistant, "candidates"> = {
    query: q,
    patch: scope.patch,
    patches: scope.patches,
    unknownChampions: ids.filter((id) => !byId.has(id)),
    laneOpponent: opponent,
    synergyAllies: q.source === "solo" ? allies.map((a) => a.champion) : [],
  };
  if (!scope.patch) return { ...result, candidates: [] };
  const rows = (
    await db.query<{
      champion: PatchChampion;
      games: number;
      win_total: number | null;
      win_count: number;
      lower_tail: number | null;
      covered_picks: number;
      lane: MetricCounts | null;
      allies: { games: number; wins: number; expected: number | null }[];
    }>(
      `WITH candidates AS (
        SELECT * FROM blindability_scores
        WHERE source=$1 AND patch_key=$2 AND role=$3 AND NOT (champion_key=ANY($4::integer[]))
      ), lane AS (
        SELECT champion_key,metrics->'winRate' AS win FROM matchup_aggregates
        WHERE source=$1 AND patch_key=$2 AND role=$3 AND opponent_key=$5
      ), allies AS (
        SELECT * FROM unnest($6::integer[],$7::text[]) a(ally_key,ally_role) WHERE $1='solo'
      ), rates AS (
        SELECT champion_key,role,sum(wins)::double precision/nullif(sum(result_games),0) AS rate
        FROM champion_aggregates WHERE source='solo' AND patch_key=$2 AND role=$3 AND $1='solo'
        GROUP BY champion_key,role
        UNION ALL
        SELECT a.champion_key,a.role,sum(a.wins)::double precision/nullif(sum(a.result_games),0)
        FROM champion_aggregates a JOIN allies l ON l.ally_key=a.champion_key AND l.ally_role=a.role
        WHERE a.source='solo' AND a.patch_key=$2 GROUP BY a.champion_key,a.role
      ), duos AS (
        SELECT d.champion_key,d.ally_key,d.ally_role,sum(d.result_games)::integer AS games,
          sum(d.wins)::integer AS wins
        FROM champion_duos d JOIN allies l ON l.ally_key=d.ally_key AND l.ally_role=d.ally_role
        WHERE d.patch_key=$2 AND d.role=$3 GROUP BY d.champion_key,d.ally_key,d.ally_role
      ), synergy AS (
        SELECT d.champion_key,jsonb_agg(jsonb_build_object('games',d.games,'wins',d.wins,
          'expected',least(1,greatest(0,own.rate+ally.rate-0.5)))) AS allies
        FROM duos d LEFT JOIN rates own ON own.champion_key=d.champion_key AND own.role=$3
        LEFT JOIN rates ally ON ally.champion_key=d.ally_key AND ally.role=d.ally_role
        GROUP BY d.champion_key
      ), names AS (
        SELECT DISTINCT ON (c.champion_key) c.champion_key,c.champion_id,c.name,i.asset_hash
        FROM catalog_champions c JOIN patches p USING(patch_key)
        LEFT JOIN catalog_images i ON i.patch_key=c.patch_key AND i.kind='champion' AND i.catalog_id=c.champion_id
        WHERE c.champion_key IN (SELECT champion_key FROM candidates)
        ORDER BY c.champion_key,(c.patch_key=$2) DESC,p.release_order DESC
      )
      SELECT ${championJson("s.champion_key", "c")} AS champion,s.games,s.win_total,s.win_count,
        s.lower_tail,s.covered_picks,l.win AS lane,coalesce(y.allies,'[]') AS allies
      FROM candidates s LEFT JOIN lane l ON l.champion_key=s.champion_key
      LEFT JOIN synergy y ON y.champion_key=s.champion_key
      LEFT JOIN names c ON c.champion_key=s.champion_key`,
      [
        q.source,
        scope.patch,
        q.role,
        ids.flatMap((id) => {
          const c = byId.get(id);
          return c ? [c.championKey] : [];
        }),
        opponent?.championKey ?? null,
        allies.map((a) => a.champion.championKey),
        allies.map((a) => a.role),
      ],
    )
  ).rows;
  const candidates: DraftCandidateInput[] = rows.map((r) => ({
    champion: r.champion,
    games: r.games,
    baseline: { total: r.win_total, count: r.win_count },
    // A lane opponent was picked but never met: no observations, rather than no opponent.
    laneMatchup: opponent ? (r.lane ?? { total: null, count: 0 }) : null,
    blindability: { score: r.lower_tail, coveredPicks: r.covered_picks },
    allies: r.allies.map((a) => ({
      result: { games: a.games, wins: a.wins },
      expected: a.expected,
    })),
  }));
  return { ...result, candidates: rankDraftCandidates(candidates, opponent !== null) };
}
