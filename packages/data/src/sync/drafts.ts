import type { Pool } from "pg";
import { deriveDraft, type DraftParticipant } from "../domain/draft-order.js";
import { transaction } from "../persistence/database.js";

const version = 1;
/** Refresh changed games in bounded batches, publishing one consistent result on commit. */
export function refreshDrafts(pool: Pool, clock: () => Date, year?: number) {
  return transaction(pool, async (db) => {
    let lastId = "",
      processed = 0;
    while (true) {
      const games = (
        await db.query<{
          id: string;
          artifact_hash: string;
          summary_eligible: boolean;
          participants: DraftParticipant[];
        }>(
          `SELECT g.id,g.artifact_hash,g.summary_eligible,
          (SELECT jsonb_agg(jsonb_build_object('side',p.side,'position',p.position,'champion',p.champion,
           'result',p.result,'draft',p.draft) ORDER BY p.slot) FROM oracle_archive_participants p WHERE p.game_id=g.id) participants
         FROM oracle_archive_games g LEFT JOIN oracle_draft_games d ON d.game_id=g.id
         WHERE g.id>$1 AND ($2::integer IS NULL OR g.archive_year=$2)
         AND (d.game_id IS NULL OR d.artifact_hash<>g.artifact_hash OR d.version<>$3)
         ORDER BY g.id LIMIT 100`,
          [lastId, year ?? null, version],
        )
      ).rows;
      if (!games.length) return processed;
      lastId = games.at(-1)!.id;
      const rows = games.map((g) => ({
        id: g.id,
        hash: g.artifact_hash,
        ...deriveDraft(g.summary_eligible, g.participants),
      }));
      await db.query(
        `INSERT INTO oracle_draft_games(game_id,artifact_hash,version,excluded_reason,first_pick_side,first_pick_won,events,derived_at)
        SELECT id,hash,$2,"excludedReason","firstPickSide","firstPickWon",events,$3
        FROM jsonb_to_recordset($1::jsonb) AS r(id text,hash text,"excludedReason" text,"firstPickSide" text,"firstPickWon" boolean,events jsonb)
        ON CONFLICT(game_id) DO UPDATE SET artifact_hash=EXCLUDED.artifact_hash,version=EXCLUDED.version,
        excluded_reason=EXCLUDED.excluded_reason,first_pick_side=EXCLUDED.first_pick_side,
        first_pick_won=EXCLUDED.first_pick_won,events=EXCLUDED.events,derived_at=EXCLUDED.derived_at`,
        [JSON.stringify(rows), version, clock()],
      );
      processed += games.length;
    }
  });
}
