import type { PoolClient } from "pg";
import {
  proHistoryPageSize,
  type ProChampionStats,
  type ProPatchHistory,
} from "../domain/pro-stats.js";
import type { Executor } from "./database.js";

const scope = `
  scoped AS (
    SELECT g.id,g.source_league AS league,d.events FROM oracle_archive_games g
    JOIN patch_sources p ON p.source='oracle' AND p.source_string=g.patch
    JOIN oracle_draft_games d ON d.game_id=g.id AND d.artifact_hash=g.artifact_hash
    WHERE p.patch_key=$1 AND d.excluded_reason IS NULL),
  events AS (
    SELECT s.id,s.league,e.* FROM scoped s CROSS JOIN LATERAL jsonb_to_recordset(s.events)
      AS e(champion text,action text,side text,blind boolean)),
  keys AS (
    SELECT DISTINCT ON (n.name) n.name,c.champion_key FROM oracle_champion_names n
    JOIN catalog_champions c ON c.champion_id=n.champion_id ORDER BY n.name,c.observed_at DESC),
  results AS (
    SELECT game_id,side,result FROM oracle_archive_participants WHERE position='team')`;

/** Rebuilds one patch's pro draft statistics inside the caller's transaction. */
export async function rebuildProStats(c: PoolClient, patchKey: string, now: Date) {
  await c.query("DELETE FROM pro_champion_stats WHERE patch_key=$1", [patchKey]);
  await c.query("DELETE FROM pro_league_games WHERE patch_key=$1", [patchKey]);
  await c.query(
    `WITH ${scope}
     INSERT INTO pro_league_games(patch_key,league,games)
     SELECT $1,league,count(*)::integer FROM scoped GROUP BY league`,
    [patchKey],
  );
  await c.query("DELETE FROM pro_unmapped_drafts WHERE patch_key=$1", [patchKey]);
  await c.query(
    `WITH ${scope}
     INSERT INTO pro_unmapped_drafts(patch_key,league,name,picks,bans)
     SELECT $1,e.league,e.champion,count(*) FILTER(WHERE e.action='pick'),
       count(*) FILTER(WHERE e.action='ban')
     FROM events e LEFT JOIN keys k ON k.name=e.champion
     WHERE k.name IS NULL AND e.champion IS NOT NULL GROUP BY e.league,e.champion`,
    [patchKey],
  );
  const inserted = await c.query(
    `WITH ${scope},
     league_games AS (SELECT league,count(*)::integer AS games FROM scoped GROUP BY league),
     joined AS (
       SELECT e.*,k.champion_key,r.result FROM events e JOIN keys k ON k.name=e.champion
       LEFT JOIN results r ON r.game_id=e.id AND r.side=e.side)
     INSERT INTO pro_champion_stats(patch_key,league,champion_key,league_games,picks,bans,
       result_picks,wins,blue_picks,blue_result_picks,blue_wins,red_picks,red_result_picks,red_wins,
       blind_picks,counter_picks,built_at)
     SELECT $1,j.league,j.champion_key,max(l.games),
       count(*) FILTER(WHERE action='pick'),count(*) FILTER(WHERE action='ban'),
       count(result) FILTER(WHERE action='pick'),count(*) FILTER(WHERE action='pick' AND result),
       count(*) FILTER(WHERE action='pick' AND side='blue'),
       count(result) FILTER(WHERE action='pick' AND side='blue'),
       count(*) FILTER(WHERE action='pick' AND side='blue' AND result),
       count(*) FILTER(WHERE action='pick' AND side='red'),
       count(result) FILTER(WHERE action='pick' AND side='red'),
       count(*) FILTER(WHERE action='pick' AND side='red' AND result),
       count(*) FILTER(WHERE action='pick' AND blind),
       count(*) FILTER(WHERE action='pick' AND blind IS FALSE),$2
     FROM joined j JOIN league_games l USING (league)
     GROUP BY j.league,j.champion_key`,
    [patchKey, now],
  );
  return inserted.rowCount ?? 0;
}

const rate = (count: number, total: number) => ({
  value: total ? count / total : null,
  sampleCount: total,
});
/**
 * A champion's pro-play use on a patch, summed over leagues unless one is chosen. The patch
 * defaults to the newest with pro draft statistics.
 */
export async function proChampionStats(
  db: Executor,
  input: { championKey: number; patch?: string | undefined; league?: string | undefined },
): Promise<ProChampionStats> {
  const patch =
    input.patch ??
    (
      await db.query<{ patch_key: string }>(
        `SELECT p.patch_key FROM patches p
         WHERE EXISTS (SELECT 1 FROM pro_champion_stats s WHERE s.patch_key=p.patch_key)
         ORDER BY p.release_order DESC LIMIT 1`,
      )
    ).rows[0]?.patch_key ??
    null;
  const leagues = patch
    ? (
        await db.query<{ league: string }>(
          "SELECT DISTINCT league FROM pro_champion_stats WHERE patch_key=$1 ORDER BY league",
          [patch],
        )
      ).rows.map((r) => r.league)
    : [];
  const filters = [patch, input.league ?? null];
  const games = patch
    ? (
        await db.query<{ n: number }>(
          `SELECT coalesce(sum(league_games),0)::integer AS n FROM (
             SELECT DISTINCT league,league_games FROM pro_champion_stats
             WHERE patch_key=$1 AND ($2::text IS NULL OR league=$2)) l`,
          filters,
        )
      ).rows[0]!.n
    : 0;
  const s = patch
    ? (
        await db.query<Record<string, number>>(
          `SELECT coalesce(sum(picks),0)::integer AS picks,coalesce(sum(bans),0)::integer AS bans,
             coalesce(sum(result_picks),0)::integer AS result_picks,
             coalesce(sum(wins),0)::integer AS wins,
             coalesce(sum(blue_picks),0)::integer AS blue_picks,
             coalesce(sum(blue_result_picks),0)::integer AS blue_result_picks,
             coalesce(sum(blue_wins),0)::integer AS blue_wins,
             coalesce(sum(red_picks),0)::integer AS red_picks,
             coalesce(sum(red_result_picks),0)::integer AS red_result_picks,
             coalesce(sum(red_wins),0)::integer AS red_wins,
             coalesce(sum(blind_picks),0)::integer AS blind_picks,
             coalesce(sum(counter_picks),0)::integer AS counter_picks
           FROM pro_champion_stats WHERE patch_key=$1 AND ($2::text IS NULL OR league=$2)
             AND champion_key=$3`,
          [...filters, input.championKey],
        )
      ).rows[0]!
    : {};
  const n = (k: string) => s[k] ?? 0;
  const unmapped = patch
    ? (
        await db.query<{ name: string; picks: number; bans: number }>(
          `SELECT name,sum(picks)::integer AS picks,sum(bans)::integer AS bans
           FROM pro_unmapped_drafts WHERE patch_key=$1 AND ($2::text IS NULL OR league=$2)
           GROUP BY name ORDER BY name LIMIT 50`,
          filters,
        )
      ).rows
    : [];
  const ordered = n("blind_picks") + n("counter_picks");
  return {
    patch,
    league: input.league ?? null,
    leagues,
    games,
    picks: n("picks"),
    bans: n("bans"),
    presence: rate(n("picks") + n("bans"), games),
    pickRate: rate(n("picks"), games),
    banRate: rate(n("bans"), games),
    winRate: rate(n("wins"), n("result_picks")),
    sides: [
      {
        side: "blue",
        picks: n("blue_picks"),
        winRate: rate(n("blue_wins"), n("blue_result_picks")),
      },
      { side: "red", picks: n("red_picks"), winRate: rate(n("red_wins"), n("red_result_picks")) },
    ],
    blindRate: rate(n("blind_picks"), ordered),
    counterRate: rate(n("counter_picks"), ordered),
    unmapped,
  };
}

/**
 * A champion's pro play on every patch it was picked or banned, newest first. The page is chosen
 * from the champion's own rows (indexed by champion and patch); each page's game totals are then
 * read for its patches only, through the primary key.
 */
export async function proChampionHistory(
  db: Executor,
  input: { championKey: number; league?: string | undefined; page?: number | undefined },
): Promise<ProPatchHistory> {
  const page = input.page ?? 1;
  const league = input.league ?? null;
  const rows = (
    await db.query<{
      patch_key: string;
      total: number;
      picks: number;
      bans: number;
      result_picks: number;
      wins: number;
      blue_result_picks: number;
      blue_wins: number;
      red_result_picks: number;
      red_wins: number;
    }>(
      `SELECT s.patch_key,count(*) OVER()::integer AS total,
         sum(picks)::integer AS picks,sum(bans)::integer AS bans,
         sum(result_picks)::integer AS result_picks,sum(wins)::integer AS wins,
         sum(blue_result_picks)::integer AS blue_result_picks,sum(blue_wins)::integer AS blue_wins,
         sum(red_result_picks)::integer AS red_result_picks,sum(red_wins)::integer AS red_wins
       FROM pro_champion_stats s JOIN patches p USING (patch_key)
       WHERE s.champion_key=$1 AND ($2::text IS NULL OR s.league=$2)
       GROUP BY s.patch_key,p.release_order
       HAVING sum(picks)+sum(bans)>0
       ORDER BY p.release_order DESC
       LIMIT $3 OFFSET $4`,
      [input.championKey, league, proHistoryPageSize, (page - 1) * proHistoryPageSize],
    )
  ).rows;
  const games = new Map(
    rows.length
      ? (
          await db.query<{ patch_key: string; games: number }>(
            `SELECT patch_key,sum(games)::integer AS games FROM pro_league_games
             WHERE patch_key=ANY($1::text[]) AND ($2::text IS NULL OR league=$2)
             GROUP BY patch_key`,
            [rows.map((r) => r.patch_key), league],
          )
        ).rows.map((r) => [r.patch_key, r.games])
      : [],
  );
  return {
    league,
    page: {
      page,
      pageSize: proHistoryPageSize,
      total: rows[0]?.total ?? 0,
      items: rows.map((r) => {
        const total = games.get(r.patch_key) ?? 0;
        return {
          patch: r.patch_key,
          games: total,
          picks: r.picks,
          bans: r.bans,
          presence: rate(r.picks + r.bans, total),
          pickRate: rate(r.picks, total),
          banRate: rate(r.bans, total),
          winRate: rate(r.wins, r.result_picks),
          blueWinRate: rate(r.blue_wins, r.blue_result_picks),
          redWinRate: rate(r.red_wins, r.red_result_picks),
        };
      }),
    },
  };
}
