import { gzipSync } from "node:zlib";
import type { Pool } from "pg";
import type { RiotMatch } from "../providers/riot-match.js";
import { transaction, type Executor } from "./database.js";
import { linkPatchString } from "./patches.js";
import { markDirty } from "./aggregates.js";

/** Queued match ids not yet fetched, oldest first. */
export async function pendingMatches(db: Executor, limit: number) {
  const rows = await db.query<{ match_id: string; region: string }>(
    `SELECT match_id,region FROM riot_match_ids WHERE fetch_state='pending'
     ORDER BY first_seen_at,match_id LIMIT $1`,
    [limit],
  );
  return rows.rows.map((r) => ({ matchId: r.match_id, region: r.region }));
}
export async function markMatchUnavailable(
  pool: Pool,
  matchId: string,
  state: "missing" | "invalid",
  now: Date,
) {
  await pool.query("UPDATE riot_match_ids SET fetch_state=$2,fetched_at=$3 WHERE match_id=$1", [
    matchId,
    state,
    now,
  ]);
}
/**
 * Writes one validated match in a single transaction. Re-ingesting a match replaces its facts,
 * so the stored rows always match the latest payload.
 */
export async function saveRiotMatch(pool: Pool, match: RiotMatch, payload: unknown, now: Date) {
  await transaction(pool, async (c) => {
    const patchKey = await linkPatchString(c, "riot", match.gameVersion, now);
    await markDirty(c, "solo", [patchKey], now);
    await c.query("DELETE FROM riot_matches WHERE match_id=$1", [match.matchId]);
    await c.query(
      `INSERT INTO riot_matches(match_id,data_version,platform_id,queue_id,map_id,game_version,
         patch_key,created_at,started_at,duration_seconds,end_of_game_result,remake,fetched_at)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [
        match.matchId,
        match.dataVersion,
        match.platformId,
        match.queueId,
        match.mapId,
        match.gameVersion,
        patchKey,
        match.createdAt,
        match.startedAt,
        match.durationSeconds,
        match.endOfGameResult,
        match.remake,
        now,
      ],
    );
    for (const team of match.teams) {
      await c.query("INSERT INTO riot_match_teams(match_id,team_id,side,win) VALUES($1,$2,$3,$4)", [
        match.matchId,
        team.teamId,
        team.side,
        team.win,
      ]);
      await c.query(
        `INSERT INTO riot_match_objectives(match_id,team_id,objective,first,kills)
         SELECT $1,$2,* FROM unnest($3::text[],$4::boolean[],$5::integer[])`,
        [
          match.matchId,
          team.teamId,
          team.objectives.map((o) => o.name),
          team.objectives.map((o) => o.first),
          team.objectives.map((o) => o.kills),
        ],
      );
      await c.query(
        `INSERT INTO riot_match_bans(match_id,team_id,pick_turn,champion_id)
         SELECT $1,$2,* FROM unnest($3::integer[],$4::integer[]) ON CONFLICT DO NOTHING`,
        [
          match.matchId,
          team.teamId,
          team.bans.map((b) => b.pickTurn),
          team.bans.map((b) => b.championId),
        ],
      );
    }
    for (const p of match.participants) {
      await c.query(
        `INSERT INTO riot_match_participants(match_id,participant_id,puuid,team_id,side,champion_id,
           champion_name,team_position,win,kills,deaths,assists,champ_level,gold_earned,
           total_minions_killed,neutral_minions_killed,damage_to_champions,vision_score,
           summoner1_id,summoner2_id,stat_perk_defense,stat_perk_flex,stat_perk_offense)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)`,
        [
          match.matchId,
          p.participantId,
          p.puuid,
          p.teamId,
          p.side,
          p.championId,
          p.championName,
          p.teamPosition,
          p.win,
          p.kills,
          p.deaths,
          p.assists,
          p.champLevel,
          p.goldEarned,
          p.totalMinionsKilled,
          p.neutralMinionsKilled,
          p.totalDamageDealtToChampions,
          p.visionScore,
          p.summoner1Id,
          p.summoner2Id,
          p.statPerks.defense,
          p.statPerks.flex,
          p.statPerks.offense,
        ],
      );
      await c.query(
        `INSERT INTO riot_match_items(match_id,participant_id,slot,item_id)
         SELECT $1,$2,* FROM unnest($3::integer[],$4::integer[])`,
        [match.matchId, p.participantId, p.items.map((i) => i.slot), p.items.map((i) => i.itemId)],
      );
      await c.query(
        `INSERT INTO riot_match_perks(match_id,participant_id,style,slot,style_id,perk_id)
         SELECT $1,$2,* FROM unnest($3::text[],$4::integer[],$5::integer[],$6::integer[])
         ON CONFLICT DO NOTHING`,
        [
          match.matchId,
          p.participantId,
          p.perks.map((k) => k.style),
          p.perks.map((k) => k.slot),
          p.perks.map((k) => k.styleId),
          p.perks.map((k) => k.perkId),
        ],
      );
    }
    await c.query("INSERT INTO riot_match_payloads(match_id,payload,fetched_at) VALUES($1,$2,$3)", [
      match.matchId,
      gzipSync(JSON.stringify(payload)),
      now,
    ]);
    await c.query(
      "UPDATE riot_match_ids SET fetch_state='fetched',fetched_at=$2 WHERE match_id=$1",
      [match.matchId, now],
    );
  });
}
