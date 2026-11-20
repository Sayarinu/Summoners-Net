import type { Pool } from "pg";
import { draftQuerySchema, type DraftAnalytics, type DraftQuery } from "../domain/drafts.js";
import { transaction } from "./database.js";

const pageSize = 25;
const scope = `WITH scoped AS (
  SELECT g.id,d.game_id AS derived,d.excluded_reason,d.events,d.first_pick_side,d.first_pick_won
  FROM oracle_archive_games g
  JOIN patch_sources p ON p.source='oracle' AND p.source_string=g.patch
  LEFT JOIN oracle_draft_games d ON d.game_id=g.id AND d.artifact_hash=g.artifact_hash
  WHERE p.patch_key=$1 AND ($2::text IS NULL OR lower(g.source_league)=lower($2)))`;
const events = `${scope}, events AS (
  SELECT s.id,e.* FROM scoped s CROSS JOIN LATERAL jsonb_to_recordset(s.events)
  AS e(champion text,action text,phase integer,slot integer,side text,role text,blind boolean)
  WHERE s.excluded_reason IS NULL AND s.derived IS NOT NULL)`;

export function draftQueries(pool: Pool) {
  return {
    async latestDraftPatch(): Promise<string | null> {
      const result = await pool.query<{ patch_key: string }>(`SELECT p.patch_key FROM patches p
        WHERE EXISTS(SELECT 1 FROM patch_sources s JOIN oracle_archive_games g ON g.patch=s.source_string
          WHERE s.source='oracle' AND s.patch_key=p.patch_key)
        ORDER BY p.release_order DESC LIMIT 1`);
      return result.rows[0]?.patch_key ?? null;
    },
    async draftAnalytics(input: DraftQuery): Promise<DraftAnalytics> {
      const q = draftQuerySchema.parse(input);
      const values = [q.patch, q.league ?? null];
      return transaction(pool, async (db) => {
        await db.query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
        const summary = (
          await db.query<{
            games: number;
            included: number;
            excluded: number;
            pending: number;
            win_rate: number | null;
            results: number;
          }>(
            `${scope} SELECT count(*)::integer AS games,
          count(*) FILTER(WHERE derived IS NOT NULL AND excluded_reason IS NULL)::integer AS included,
          count(*) FILTER(WHERE excluded_reason IS NOT NULL)::integer AS excluded,
          count(*) FILTER(WHERE derived IS NULL)::integer AS pending,
          avg(first_pick_won::integer)::double precision AS win_rate,count(first_pick_won)::integer AS results FROM scoped`,
            values,
          )
        ).rows[0]!;
        const exclusions = (
          await db.query<{ reason: string; games: number }>(
            `${scope}
          SELECT excluded_reason AS reason,count(*)::integer AS games FROM scoped
          WHERE excluded_reason IS NOT NULL GROUP BY excluded_reason ORDER BY excluded_reason LIMIT 10`,
            values,
          )
        ).rows;
        const sides = (
          await db.query<{ side: "blue" | "red"; value: number | null; samples: number }>(
            `${scope}
          SELECT v.side,avg(s.first_pick_won::integer)::double precision AS value,count(s.first_pick_won)::integer AS samples
          FROM (VALUES('blue'),('red')) v(side) LEFT JOIN scoped s ON s.first_pick_side=v.side
          GROUP BY v.side ORDER BY v.side`,
            values,
          )
        ).rows;
        const priority = (
          await db.query<{
            total: number;
            items: {
              champion: string;
              action: "pick" | "ban";
              phase: number;
              slot: number | null;
              games: number;
              value: number | null;
              samples: number;
            }[];
          }>(
            `${events}, grouped AS (
            SELECT champion,action,phase,slot,count(DISTINCT id)::integer AS games FROM events
            GROUP BY GROUPING SETS ((champion,action,phase,slot),(champion,action,phase))),
          totals AS (SELECT count(*)::integer AS samples FROM scoped WHERE derived IS NOT NULL AND excluded_reason IS NULL),
          paged AS (SELECT g.*,g.games::double precision/nullif(t.samples,0) AS value,t.samples FROM grouped g CROSS JOIN totals t
            ORDER BY action,phase,slot NULLS FIRST,games DESC,champion LIMIT 25 OFFSET $3)
          SELECT (SELECT count(*)::integer FROM grouped) AS total,
            coalesce(jsonb_agg(paged ORDER BY action,phase,slot NULLS FIRST,games DESC,champion),'[]') AS items FROM paged`,
            [...values, (q.priorityPage - 1) * pageSize],
          )
        ).rows[0]!;
        const role = (
          await db.query<{
            total: number;
            items: {
              champion: string;
              role: string;
              games: number;
              blind: number | null;
              counter: number | null;
              samples: number;
            }[];
          }>(
            `${events}, grouped AS (
            SELECT champion,role,count(DISTINCT id)::integer AS games,
              avg(blind::integer)::double precision AS blind,avg((NOT blind)::integer)::double precision AS counter,
              count(blind)::integer AS samples FROM events WHERE action='pick' GROUP BY champion,role),
          paged AS (SELECT * FROM grouped ORDER BY games DESC,champion,role LIMIT 25 OFFSET $3)
          SELECT (SELECT count(*)::integer FROM grouped) AS total,
            coalesce(jsonb_agg(paged ORDER BY games DESC,champion,role),'[]') AS items FROM paged`,
            [...values, (q.rolePage - 1) * pageSize],
          )
        ).rows[0]!;
        return {
          games: summary.games,
          includedGames: summary.included,
          excludedGames: summary.excluded,
          pendingGames: summary.pending,
          exclusions,
          firstPickWinRate: { value: summary.win_rate, sampleCount: summary.results },
          firstPickSides: sides.map((s) => ({
            side: s.side,
            winRate: { value: s.value, sampleCount: s.samples },
          })),
          priorities: {
            page: q.priorityPage,
            pageSize,
            total: priority.total,
            items: priority.items.map((r) => ({
              champion: r.champion,
              action: r.action,
              phase: r.phase,
              slot: r.slot,
              games: r.games,
              rate: { value: r.value, sampleCount: r.samples },
            })),
          },
          roles: {
            page: q.rolePage,
            pageSize,
            total: role.total,
            items: role.items.map((r) => ({
              champion: r.champion,
              role: r.role,
              games: r.games,
              blindRate: { value: r.blind, sampleCount: r.samples },
              counterRate: { value: r.counter, sampleCount: r.samples },
            })),
          },
        };
      });
    },
  };
}
