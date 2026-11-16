import type { Pool } from "pg";
import type { LadderEntry, RiotAccount, RiotPlatform } from "../providers/riot.js";
import { soloQueue } from "../providers/riot.js";
import { transaction, type Executor } from "./database.js";

export async function markLadderAttempt(pool: Pool, platform: string, now: Date) {
  await pool.query(
    `INSERT INTO riot_ladder_status(platform,last_attempt) VALUES($1,$2)
     ON CONFLICT(platform) DO UPDATE SET last_attempt=EXCLUDED.last_attempt`,
    [platform, now],
  );
}
/** Upserts a platform's whole validated ladder and stamps it as the current one. */
export async function saveLadder(
  pool: Pool,
  platform: string,
  entries: readonly LadderEntry[],
  now: Date,
) {
  await transaction(pool, async (c) => {
    const column = <K extends keyof LadderEntry>(key: K) => entries.map((e) => e[key]);
    await c.query(
      `INSERT INTO riot_ladder_entries(platform,queue,fetched_at,puuid,summoner_id,tier,rank,
         league_points,wins,losses,league_id)
       SELECT $1,$2,$3,* FROM unnest($4::text[],$5::text[],$6::text[],$7::text[],$8::integer[],
         $9::integer[],$10::integer[],$11::text[])
       ON CONFLICT(platform,queue,puuid) DO UPDATE SET
         summoner_id=coalesce(EXCLUDED.summoner_id,riot_ladder_entries.summoner_id),
         tier=EXCLUDED.tier,rank=EXCLUDED.rank,league_points=EXCLUDED.league_points,
         wins=EXCLUDED.wins,losses=EXCLUDED.losses,league_id=EXCLUDED.league_id,
         fetched_at=EXCLUDED.fetched_at`,
      [
        platform,
        soloQueue,
        now,
        column("puuid"),
        column("summonerId"),
        column("tier"),
        column("rank"),
        column("leaguePoints"),
        column("wins"),
        column("losses"),
        column("leagueId"),
      ],
    );
    await c.query(
      `INSERT INTO riot_ladder_status(platform,last_success,last_attempt,entries,error)
       VALUES($1,$2,$2,$3,NULL) ON CONFLICT(platform) DO UPDATE SET last_success=EXCLUDED.last_success,
         entries=EXCLUDED.entries,error=NULL`,
      [platform, now, entries.length],
    );
  });
}
export async function recordLadderFailure(pool: Pool, platform: string, error: string) {
  await pool.query("UPDATE riot_ladder_status SET error=$2 WHERE platform=$1", [platform, error]);
}
export interface LadderStatus {
  platform: string;
  lastSuccess: string | null;
  lastAttempt: string | null;
  entries: number;
  error: string | null;
}
export async function ladderStatus(db: Executor): Promise<LadderStatus[]> {
  const rows = await db.query<{
    platform: string;
    last_success: Date | null;
    last_attempt: Date | null;
    entries: number;
    error: string | null;
  }>("SELECT * FROM riot_ladder_status ORDER BY platform");
  return rows.rows.map((r) => ({
    platform: r.platform,
    lastSuccess: r.last_success?.toISOString() ?? null,
    lastAttempt: r.last_attempt?.toISOString() ?? null,
    entries: r.entries,
    error: r.error,
  }));
}
/** The platform's ladder as of its last successful fetch, highest LP first. */
export async function currentLadder(db: Executor, platform: string) {
  const rows = await db.query<{
    puuid: string;
    summoner_id: string | null;
    tier: LadderEntry["tier"];
    rank: string;
    league_points: number;
    wins: number;
    losses: number;
    fetched_at: Date;
  }>(
    `SELECT e.puuid,e.summoner_id,e.tier,e.rank,e.league_points,e.wins,e.losses,e.fetched_at
     FROM riot_ladder_entries e JOIN riot_ladder_status s ON s.platform=e.platform
     WHERE e.platform=$1 AND e.queue=$2 AND e.fetched_at=s.last_success
     ORDER BY e.league_points DESC,e.puuid`,
    [platform, soloQueue],
  );
  return rows.rows.map((r) => ({
    puuid: r.puuid,
    summonerId: r.summoner_id,
    tier: r.tier,
    rank: r.rank,
    leaguePoints: r.league_points,
    wins: r.wins,
    losses: r.losses,
    fetchedAt: r.fetched_at.toISOString(),
  }));
}

/** Ladder players with no account yet first, then those checked longest ago before staleBefore. */
export async function accountsToResolve(db: Executor, staleBefore: Date, limit: number) {
  const rows = await db.query<{ puuid: string; platform: RiotPlatform }>(
    `SELECT puuid,platform FROM (
       SELECT DISTINCT ON (e.puuid) e.puuid,e.platform,a.checked_at
       FROM riot_ladder_entries e LEFT JOIN riot_accounts a ON a.puuid=e.puuid
       WHERE a.puuid IS NULL OR a.checked_at<$1
       ORDER BY e.puuid,e.fetched_at DESC
     ) due ORDER BY checked_at NULLS FIRST,puuid LIMIT $2`,
    [staleBefore, limit],
  );
  return rows.rows;
}
/** Records a resolved account; a changed Riot ID is added to the history, never replacing the PUUID. */
export async function saveAccount(pool: Pool, account: RiotAccount, now: Date) {
  await transaction(pool, async (c) => {
    await c.query(
      `INSERT INTO riot_accounts(puuid,game_name,tag_line,first_seen_at,seen_at,checked_at)
       VALUES($1,$2,$3,$4,$4,$4) ON CONFLICT(puuid) DO UPDATE SET game_name=EXCLUDED.game_name,
         tag_line=EXCLUDED.tag_line,seen_at=EXCLUDED.seen_at,checked_at=EXCLUDED.checked_at`,
      [account.puuid, account.gameName, account.tagLine, now],
    );
    if (account.gameName && account.tagLine)
      await c.query(
        `INSERT INTO riot_account_names(puuid,game_name,tag_line,first_seen_at,last_seen_at)
         VALUES($1,$2,$3,$4,$4) ON CONFLICT(puuid,game_name,tag_line)
         DO UPDATE SET last_seen_at=EXCLUDED.last_seen_at`,
        [account.puuid, account.gameName, account.tagLine, now],
      );
  });
}
export async function account(db: Executor, puuid: string) {
  const row = (
    await db.query<{
      game_name: string | null;
      tag_line: string | null;
      first_seen_at: Date;
      seen_at: Date;
      checked_at: Date;
    }>(
      "SELECT game_name,tag_line,first_seen_at,seen_at,checked_at FROM riot_accounts WHERE puuid=$1",
      [puuid],
    )
  ).rows[0];
  if (!row) return null;
  const names = await db.query<{
    game_name: string;
    tag_line: string;
    first_seen_at: Date;
    last_seen_at: Date;
  }>(
    "SELECT game_name,tag_line,first_seen_at,last_seen_at FROM riot_account_names WHERE puuid=$1 ORDER BY first_seen_at,game_name",
    [puuid],
  );
  return {
    puuid,
    gameName: row.game_name,
    tagLine: row.tag_line,
    firstSeenAt: row.first_seen_at.toISOString(),
    seenAt: row.seen_at.toISOString(),
    checkedAt: row.checked_at.toISOString(),
    names: names.rows.map((n) => ({
      gameName: n.game_name,
      tagLine: n.tag_line,
      firstSeenAt: n.first_seen_at.toISOString(),
      lastSeenAt: n.last_seen_at.toISOString(),
    })),
  };
}
