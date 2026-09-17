import { z } from "zod";
import type { Pool } from "pg";
import {
  querySchema,
  type BrowseQuery,
  type Game,
  type Identity,
  type Match,
  type Page,
  type Profile,
  type Summary,
  type SyncStatus,
} from "../domain/models.js";

const idSchema = z.string().min(1).max(300);
const stamp = (d: Date | null) => d?.toISOString() ?? null;
function filters(input: BrowseQuery, kind: "matches" | "games") {
  const q = querySchema.parse(input);
  const values: unknown[] = [];
  const clauses: string[] = [];
  const add = (sql: string, value: unknown) => {
    values.push(value);
    clauses.push(sql.replaceAll("?", `$${values.length}`));
  };
  if (q.league) add("league=?", q.league);
  if (q.year) add(kind === "games" ? "year=?" : "extract(year from starts_at)=?", q.year);
  const time = kind === "games" ? "occurred_at" : "starts_at";
  if (q.date) {
    values.push(q.date, q.timezone);
    clauses.push(
      `${time} >= ($${values.length - 1}::date::timestamp AT TIME ZONE $${values.length}) AND ${time} < (($${values.length - 1}::date + 1)::timestamp AT TIME ZONE $${values.length})`,
    );
  }
  if (q.q) add("lower(document::text) LIKE ?", `%${q.q.toLowerCase().replace(/[\\%_]/g, "\\$&")}%`);
  if (kind === "matches" && q.state) add("state=?", q.state);
  return { q, values, clauses };
}
async function page<T>(
  pool: Pool,
  table: string,
  where: string,
  values: unknown[],
  q: { page: number; pageSize: number },
  order: string,
): Promise<Page<T>> {
  // A single SQL statement gives count and page the same MVCC snapshot, even on empty pages.
  const result = await pool.query<{ total: number; items: T[] }>(
    `SELECT (SELECT count(*)::integer FROM ${table} WHERE ${where}) AS total,COALESCE((SELECT jsonb_agg(document ORDER BY ordinal) FROM (SELECT document,row_number() OVER (ORDER BY ${order}) AS ordinal FROM ${table} WHERE ${where} ORDER BY ${order} LIMIT $${values.length + 1} OFFSET $${values.length + 2}) p),'[]') AS items`,
    [...values, q.pageSize, (q.page - 1) * q.pageSize],
  );
  return { page: q.page, pageSize: q.pageSize, ...result.rows[0]! };
}
export interface SearchHit {
  id: string;
  kind: "team" | "player" | "match" | "game";
  name: string;
  detail: string;
}
export function queries(pool: Pool, clock: () => Date) {
  const games = async (input: BrowseQuery = {}, identityId?: string) => {
    const { q, values, clauses } = filters(input, "games");
    if (identityId) {
      values.push(idSchema.parse(identityId));
      clauses.push(
        `EXISTS(SELECT 1 FROM participants p WHERE p.game_id=games.id AND (p.team_id=$${values.length} OR p.player_id=$${values.length}))`,
      );
    }
    return page<Game>(
      pool,
      "games",
      clauses.join(" AND ") || "true",
      values,
      q,
      "occurred_at DESC,id",
    );
  };
  return {
    games,
    async matches(input: BrowseQuery = {}) {
      const { q, values, clauses } = filters(input, "matches");
      return page<Match>(
        pool,
        "matches",
        clauses.join(" AND ") || "true",
        values,
        q,
        q.state === "scheduled"
          ? "starts_at ASC NULLS LAST,id"
          : q.state
            ? "starts_at DESC NULLS LAST,id"
            : "CASE state WHEN 'live' THEN 0 WHEN 'scheduled' THEN 1 ELSE 2 END,CASE WHEN state='scheduled' THEN starts_at END ASC NULLS LAST,starts_at DESC NULLS LAST,id",
      );
    },
    async match(id: string) {
      const result = await pool.query<{ document: Match }>(
        "SELECT document FROM matches WHERE id=$1",
        [idSchema.parse(id)],
      );
      return result.rows[0]?.document ?? null;
    },
    async game(id: string) {
      const result = await pool.query<{ document: Game }>(
        "SELECT document FROM games WHERE id=$1",
        [idSchema.parse(id)],
      );
      return result.rows[0]?.document ?? null;
    },
    async directory(kind: "team" | "player", input: BrowseQuery = {}) {
      z.enum(["team", "player"]).parse(kind);
      const q = querySchema.parse(input);
      return page<Identity>(
        pool,
        "identities",
        "kind=$1 AND lower(name) LIKE $2",
        [kind, `%${q.q.toLowerCase().replace(/[\\%_]/g, "\\$&")}%`],
        q,
        "lower(name),id",
      );
    },
    async search(input: BrowseQuery = {}): Promise<Page<SearchHit>> {
      const q = querySchema.parse(input);
      if (!q.q) return { items: [], total: 0, page: q.page, pageSize: q.pageSize };
      const pattern = `%${q.q.toLowerCase().replace(/[\\%_]/g, "\\$&")}%`;
      return page<SearchHit>(
        pool,
        `(SELECT id,name,jsonb_build_object('id',id,'kind',kind,'name',name,'detail',source||' · '||source_id) AS document FROM identities WHERE lower(name) LIKE $1 UNION ALL SELECT id,document->>'name',jsonb_build_object('id',id,'kind','match','name',document->>'name','detail',league||' · '||coalesce(starts_at::text,'Unscheduled')) FROM matches WHERE lower(document->>'name') LIKE $1 UNION ALL SELECT id,source_id,jsonb_build_object('id',id,'kind','game','name',source_id,'detail',league||' · '||year) FROM games WHERE lower(source_id) LIKE $1) hits`,
        "true",
        [pattern],
        q,
        "lower(name),id",
      );
    },
    async profile(id: string, input: BrowseQuery = {}): Promise<Profile | null> {
      const identity = (
        await pool.query<{ document: Identity }>("SELECT document FROM identities WHERE id=$1", [
          idSchema.parse(id),
        ])
      ).rows[0]?.document;
      if (!identity) return null;
      const { values, clauses } = filters(input, "games");
      values.push(id);
      const entity = `$${values.length}`;
      clauses.push("complete");
      const filtered = clauses.join(" AND ");
      const from =
        identity.kind === "team"
          ? `games LEFT JOIN participants p ON p.game_id=games.id AND p.team_id=${entity} AND p.role='team' WHERE ${filtered} AND EXISTS(SELECT 1 FROM participants played WHERE played.game_id=games.id AND played.team_id=${entity})`
          : `participants p JOIN games ON games.id=p.game_id WHERE ${filtered} AND p.player_id=${entity}`;
      const championFrom = `participants p JOIN games ON games.id=p.game_id WHERE ${filtered} AND p.${identity.kind === "team" ? "team_id" : "player_id"}=${entity} AND p.role<>'team'`;
      const summary = (
        await pool.query<{ summary: Summary }>(
          `SELECT jsonb_build_object('eligibleGames',count(*),'resultGames',count(won),'wins',count(*) FILTER(WHERE won),'winRate',(count(*) FILTER(WHERE won))::float/nullif(count(won),0),'kda',sum(kills+assists) FILTER(WHERE kills IS NOT NULL AND deaths IS NOT NULL AND assists IS NOT NULL)::float/nullif(sum(deaths) FILTER(WHERE kills IS NOT NULL AND deaths IS NOT NULL AND assists IS NOT NULL),0),'kdaGames',count(*) FILTER(WHERE kills IS NOT NULL AND deaths IS NOT NULL AND assists IS NOT NULL),'champions','[]'::jsonb) AS summary FROM ${from}`,
          values,
        )
      ).rows[0]!.summary;
      summary.champions = (
        await pool.query<{
          name: string;
          games: number;
          wins: number;
          resultGames: number;
        }>(
          `SELECT champion AS name,count(DISTINCT games.id)::integer AS games,(count(DISTINCT games.id) FILTER(WHERE won))::integer AS wins,(count(DISTINCT games.id) FILTER(WHERE won IS NOT NULL))::integer AS "resultGames" FROM ${championFrom} AND champion IS NOT NULL GROUP BY champion ORDER BY games DESC,champion`,
          values,
        )
      ).rows;
      const roster = (
        await pool.query<{
          player: Identity;
          team: Identity;
          observed_at: Date;
        }>(
          "SELECT p.document AS player,t.document AS team,r.observed_at FROM roster_observations r JOIN roster_snapshots s ON s.team_id=r.team_id AND s.observed_at=r.observed_at JOIN identities p ON p.id=r.player_id JOIN identities t ON t.id=r.team_id WHERE r.team_id=$1 OR r.player_id=$1 ORDER BY p.name",
          [id],
        )
      ).rows.map((r) => ({
        player: r.player,
        team: r.team,
        observedAt: r.observed_at.toISOString(),
      }));
      return { identity, summary, roster, games: await games(input, id) };
    },
    async metadata(version?: string) {
      if (version)
        z.string()
          .regex(/^\d+\.\d+\.\d+$/)
          .parse(version);
      const rows = await pool.query<{
        version: string;
        kind: string;
        document: Record<string, { name: string; image: string }>;
      }>(
        "SELECT version,kind,document FROM metadata WHERE version=COALESCE($1,(SELECT version FROM metadata ORDER BY string_to_array(version,'.')::integer[] DESC LIMIT 1))",
        [version ?? null],
      );
      return rows.rows;
    },
    async status(): Promise<SyncStatus> {
      const sources = await pool.query<{
        source: "pandascore" | "oracle" | "ddragon";
        last_success: Date | null;
        last_attempt: Date | null;
        error: string | null;
        records: number;
      }>("SELECT * FROM source_status ORDER BY source");
      const jobs = await pool.query<{
        id: string;
        kind: string;
        state: string;
        error: string | null;
        requested_at: Date;
      }>(
        "SELECT id::text,CASE WHEN request->>'kind'='history' THEN 'history:'||(request->>'year') ELSE request->>'kind' END AS kind,state,error,requested_at FROM sync_jobs ORDER BY sync_jobs.id DESC LIMIT 30",
      );
      const budget = await pool.query<{ count: number }>(
        "SELECT count(*)::integer AS count FROM request_ledger WHERE requested_at>$1::timestamptz-interval '1 hour'",
        [clock()],
      );
      const cooldown = await pool.query<{ cooldown_until: Date | null }>(
        "SELECT cooldown_until FROM quota_state WHERE id=true",
      );
      const history = await pool.query<{
        year: number;
        games: number;
        eligible: number;
        latest: Date;
      }>(
        "SELECT year,count(*)::integer AS games,(count(*) FILTER(WHERE complete))::integer AS eligible,max(occurred_at) AS latest FROM games GROUP BY year ORDER BY year DESC",
      );
      return {
        sources: sources.rows.map((s) => ({
          source: s.source,
          lastSuccess: stamp(s.last_success),
          lastAttempt: stamp(s.last_attempt),
          error: s.error,
          records: s.records,
        })),
        jobs: jobs.rows.map((j) => ({
          id: j.id,
          kind: j.kind,
          state: j.state,
          error: j.error,
          requestedAt: j.requested_at.toISOString(),
        })),
        pandaRequests: budget.rows[0]!.count,
        cooldownUntil: stamp(cooldown.rows[0]!.cooldown_until),
        history: history.rows.map((h) => ({
          year: h.year,
          games: h.games,
          eligible: h.eligible,
          latestGameAt: h.latest.toISOString(),
        })),
      };
    },
  };
}
