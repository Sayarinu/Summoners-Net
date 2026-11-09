import { z } from "zod";
import type { Pool } from "pg";
import { enrichIdentities } from "./entities.js";
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
import { historicalQueries } from "./historical-queries.js";

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
      `${time} >= ($${values.length - 1}::date::timestamp AT TIME ZONE $${values.length})
        AND ${time} < (($${values.length - 1}::date + 1)::timestamp AT TIME ZONE $${values.length})`,
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
    `SELECT
        (SELECT count(*)::integer FROM ${table} WHERE ${where}) AS total,
        COALESCE(
          (
            SELECT jsonb_agg(document ORDER BY ordinal)
            FROM (
              SELECT document,row_number() OVER (ORDER BY ${order}) AS ordinal
              FROM ${table}
              WHERE ${where}
              ORDER BY ${order}
              LIMIT $${values.length + 1}
              OFFSET $${values.length + 2}
            ) p
          ),
          '[]'
        ) AS items`,
    [...values, q.pageSize, (q.page - 1) * q.pageSize],
  );
  return { page: q.page, pageSize: q.pageSize, ...result.rows[0]! };
}
export interface SearchHit {
  id: string;
  kind: "team" | "player" | "match" | "game";
  name: string;
  detail: string;
  imageUrl?: string | null;
  publicSlug?: string;
}
export function queries(pool: Pool, clock: () => Date) {
  async function decorateGames(items: Game[]) {
    const enriched = await enrichIdentities(
      pool,
      items.flatMap((g) =>
        g.participants.flatMap((p) => (p.player ? [p.team, p.player] : [p.team])),
      ),
    );
    return items.map((g) => ({
      ...g,
      participants: g.participants.map((p) => ({
        ...p,
        team: { ...p.team, ...enriched.get(p.team.id)! },
        player: p.player ? { ...p.player, ...enriched.get(p.player.id)! } : null,
      })),
    }));
  }
  async function decorateMatches(items: Match[]) {
    const enriched = await enrichIdentities(
      pool,
      items.flatMap((m) => m.teams),
    );
    return items.map((m) => ({
      ...m,
      teams: m.teams.map((t) => ({ ...t, ...enriched.get(t.id)! })),
    }));
  }
  const aliasFilter = (parameter: string) =>
    `EXISTS(
      SELECT 1
      FROM identity_aliases a
      JOIN entity_members em ON em.id=a.identity_id
      WHERE em.entity_id=entity_profiles.id AND lower(a.name) LIKE ${parameter}
    )`;

  const games = async (input: BrowseQuery = {}, identityId?: string) => {
    const { q, values, clauses } = filters(input, "games");
    if (identityId) {
      values.push(idSchema.parse(identityId));
      clauses.push(
        `EXISTS(
          SELECT 1
          FROM participants p
          WHERE p.game_id=games.id
            AND (
              p.team_id IN(
                SELECT id FROM entity_members
                WHERE entity_id=(SELECT entity_id FROM entity_members WHERE id=$${values.length})
              )
              OR p.player_id IN(
                SELECT id FROM entity_members
                WHERE entity_id=(SELECT entity_id FROM entity_members WHERE id=$${values.length})
              )
            )
        )`,
      );
    }
    const result = await page<Game>(
      pool,
      "games",
      clauses.join(" AND ") || "true",
      values,
      q,
      "occurred_at DESC,id",
    );
    return { ...result, items: await decorateGames(result.items) };
  };
  return {
    ...historicalQueries(pool),
    async ready() {
      // Verify both the connection and an initialized read model without scanning data.
      await pool.query("SELECT id FROM entity_profiles LIMIT 0");
    },
    games,
    async matches(input: BrowseQuery = {}) {
      const { q, values, clauses } = filters(input, "matches");
      const result = await page<Match>(
        pool,
        "matches",
        clauses.join(" AND ") || "true",
        values,
        q,
        q.state === "scheduled"
          ? "starts_at ASC NULLS LAST,id"
          : q.state
            ? "starts_at DESC NULLS LAST,id"
            : `CASE state WHEN 'live' THEN 0 WHEN 'scheduled' THEN 1 ELSE 2 END,
              CASE WHEN state='scheduled' THEN starts_at END ASC NULLS LAST,
              starts_at DESC NULLS LAST,
              id`,
      );
      return { ...result, items: await decorateMatches(result.items) };
    },
    async match(id: string) {
      const result = await pool.query<{ document: Match }>(
        "SELECT document FROM matches WHERE id=$1",
        [idSchema.parse(id)],
      );
      return result.rows[0] ? (await decorateMatches([result.rows[0].document]))[0]! : null;
    },
    async game(id: string) {
      const parsedId = idSchema.parse(id);
      const result = await pool.query<{ document: Game }>(
        `SELECT document
          FROM games
          WHERE id=$1 OR ($1 LIKE 'oracle:game:%' AND source_id=substring($1 from 13))
          ORDER BY (id=$1) DESC,id
          LIMIT 1`,
        [parsedId],
      );
      return result.rows[0] ? (await decorateGames([result.rows[0].document]))[0]! : null;
    },
    async directory(kind: "team" | "player", input: BrowseQuery = {}) {
      z.enum(["team", "player"]).parse(kind);
      const q = querySchema.parse(input);
      // Activity comes from game/fixture dates, never the date an old archive or catalog
      // was imported. Current rosters only count for a recently active team, and expire.
      // These windows include the off-season without treating old observations as current.
      if (q.q)
        return page<Identity>(
          pool,
          "entity_profiles",
          `kind=$1 AND ${aliasFilter("$2")}`,
          [kind, `%${q.q.toLowerCase().replace(/[\\%_]/g, "\\$&")}%`],
          q,
          "lower(name),id",
        );
      // Without a search, every profile with any alias is listed. Joining the aliased set once
      // avoids a per-row alias probe that the planner otherwise runs as a nested loop.
      const table = `(WITH recent_games AS (
            SELECT id FROM games WHERE occurred_at BETWEEN $2::timestamptz-interval '180 days' AND $2::timestamptz
          ), recent_teams AS (
            SELECT DISTINCT p.team_id AS id FROM participants p JOIN recent_games g ON g.id=p.game_id
            UNION
            SELECT team->>'id' FROM matches m CROSS JOIN LATERAL jsonb_array_elements(m.document->'teams') team
            WHERE m.starts_at BETWEEN $2::timestamptz-interval '180 days' AND $2::timestamptz+interval '90 days'
              AND m.state IN ('scheduled','live','final')
          ), active_sources AS (
            SELECT id FROM recent_teams WHERE $1='team'
            UNION
            SELECT p.player_id FROM participants p JOIN recent_games g ON g.id=p.game_id WHERE $1='player' AND p.player_id IS NOT NULL
            UNION
            SELECT r.player_id FROM roster_observations r
              JOIN roster_snapshots s ON s.team_id=r.team_id AND s.observed_at=r.observed_at
              JOIN entity_members tm ON tm.id=r.team_id
            WHERE $1='player' AND s.observed_at BETWEEN $2::timestamptz-interval '30 days' AND $2::timestamptz
              AND EXISTS(SELECT 1 FROM recent_teams t JOIN entity_members m ON m.id=t.id WHERE m.entity_id=tm.entity_id)
          ), active_entities AS (
            SELECT DISTINCT m.entity_id FROM active_sources a JOIN entity_members m ON m.id=a.id
          ), aliased AS (
            SELECT DISTINCT em.entity_id FROM identity_aliases a JOIN entity_members em ON em.id=a.identity_id
          ) SELECT p.*,EXISTS(SELECT 1 FROM active_entities a WHERE a.entity_id=p.id) AS recently_active
            FROM entity_profiles p JOIN aliased ON aliased.entity_id=p.id) entity_profiles`;
      return page<Identity>(
        pool,
        table,
        "kind=$1",
        [kind, clock()],
        q,
        "recently_active DESC,lower(name),id",
      );
    },
    async search(input: BrowseQuery = {}): Promise<Page<SearchHit>> {
      const q = querySchema.parse(input);
      if (!q.q) return { items: [], total: 0, page: q.page, pageSize: q.pageSize };
      const pattern = `%${q.q.toLowerCase().replace(/[\\%_]/g, "\\$&")}%`;
      return page<SearchHit>(
        pool,
        `(
            SELECT
              id,
              name,
              jsonb_build_object(
                'id', id,
                'kind', kind,
                'name', name,
                'detail', CASE WHEN document->>'sourceCount'='2' THEN 'Linked Oracle + PandaScore' ELSE document->>'source' END,
                'imageUrl', document->>'imageUrl',
                'publicSlug', document->>'publicSlug'
              ) AS document
            FROM entity_profiles
            WHERE ${aliasFilter("$1")}
            UNION ALL
            SELECT
              id,
              document->>'name',
              jsonb_build_object(
                'id', id,
                'kind', 'match',
                'name', document->>'name',
                'detail', league||' · '||coalesce(starts_at::text,'Unscheduled')
              )
            FROM matches
            WHERE lower(document->>'name') LIKE $1
            UNION ALL
            SELECT
              id,
              source_id,
              jsonb_build_object(
                'id', id,
                'kind', 'game',
                'name', source_id,
                'detail', league||' · '||year
              )
            FROM games
            WHERE lower(source_id) LIKE $1
          ) hits`,
        "true",
        [pattern],
        q,
        "lower(name),id",
      );
    },
    async profile(
      id: string,
      input: BrowseQuery = {},
      routeKind?: "team" | "player",
    ): Promise<Profile | null> {
      const identity = (
        await pool.query<{ document: Identity }>(
          `SELECT document
            FROM entity_profiles
            WHERE id=coalesce(
              (SELECT entity_id FROM entity_members WHERE id=$1),
              (SELECT entity_id FROM identity_routes WHERE slug=$1 AND kind=$2)
            )`,
          [idSchema.parse(id), routeKind ?? null],
        )
      ).rows[0]?.document;
      if (!identity) return null;
      const { values, clauses } = filters(input, "games");
      const members = (
        await pool.query<{ document: Identity }>(
          `SELECT i.document
            FROM identities i
            JOIN entity_members m ON m.id=i.id
            WHERE m.entity_id=$1
            ORDER BY i.source,i.id`,
          [identity.id],
        )
      ).rows.map((r) => r.document);
      values.push(members.map((m) => m.id));
      const entity = `ANY($${values.length}::text[])`;
      clauses.push("complete");
      const filtered = clauses.join(" AND ");
      const from =
        identity.kind === "team"
          ? `games LEFT JOIN participants p ON p.game_id=games.id AND p.team_id=${entity} AND p.role='team' WHERE ${filtered} AND EXISTS(SELECT 1 FROM participants played WHERE played.game_id=games.id AND played.team_id=${entity})`
          : `participants p JOIN games ON games.id=p.game_id WHERE ${filtered} AND p.player_id=${entity}`;
      const championFrom = `participants p JOIN games ON games.id=p.game_id WHERE ${filtered} AND p.${identity.kind === "team" ? "team_id" : "player_id"}=${entity} AND p.role<>'team'`;
      const summary = (
        await pool.query<{ summary: Summary }>(
          `SELECT jsonb_build_object(
              'eligibleGames', count(*),
              'resultGames', count(won),
              'wins', count(*) FILTER(WHERE won),
              'winRate', (count(*) FILTER(WHERE won))::float/nullif(count(won),0),
              'kda', sum(kills+assists) FILTER(WHERE kills IS NOT NULL AND deaths IS NOT NULL AND assists IS NOT NULL)::float/nullif(
                sum(deaths) FILTER(WHERE kills IS NOT NULL AND deaths IS NOT NULL AND assists IS NOT NULL),
                0
              ),
              'kdaGames', count(*) FILTER(WHERE kills IS NOT NULL AND deaths IS NOT NULL AND assists IS NOT NULL),
              'champions', '[]'::jsonb
            ) AS summary
            FROM ${from}`,
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
          `SELECT
              champion AS name,
              count(DISTINCT games.id)::integer AS games,
              (count(DISTINCT games.id) FILTER(WHERE won))::integer AS wins,
              (count(DISTINCT games.id) FILTER(WHERE won IS NOT NULL))::integer AS "resultGames"
            FROM ${championFrom} AND champion IS NOT NULL
            GROUP BY champion
            ORDER BY games DESC,champion`,
          values,
        )
      ).rows;
      const roster = (
        await pool.query<{
          player: Identity;
          team: Identity;
          observed_at: Date;
        }>(
          `SELECT p.document AS player,t.document AS team,r.observed_at
            FROM roster_observations r
            JOIN roster_snapshots s ON s.team_id=r.team_id AND s.observed_at=r.observed_at
            JOIN identities p ON p.id=r.player_id
            JOIN identities t ON t.id=r.team_id
            WHERE r.team_id=ANY($1::text[]) OR r.player_id=ANY($1::text[])
            ORDER BY p.name`,
          [members.map((m) => m.id)],
        )
      ).rows.map((r) => ({
        player: r.player,
        team: r.team,
        observedAt: r.observed_at.toISOString(),
      }));
      const enriched = await enrichIdentities(
        pool,
        roster.flatMap((r) => [r.team, r.player]),
      );
      const aliases = (
        await pool.query<{ name: string }>(
          `SELECT DISTINCT a.name
            FROM identity_aliases a
            JOIN entity_members m ON m.id=a.identity_id
            WHERE m.entity_id=$1
            ORDER BY a.name`,
          [identity.id],
        )
      ).rows.map((r) => r.name);
      const resolution = (
        await pool.query<{
          gameId: string;
          playedAt: string;
          observedAt: string;
          matchedPlayers: number;
          method: "lineup" | "fixtures";
          matchedFixtures: number;
        }>(
          `SELECT
              evidence->>'gameId' AS "gameId",
              evidence->>'playedAt' AS "playedAt",
              evidence->>'observedAt' AS "observedAt",
              jsonb_array_length(evidence->'players') AS "matchedPlayers",
              evidence->>'method' AS method,
              coalesce(jsonb_array_length(evidence->'fixtures'),0) AS "matchedFixtures"
            FROM identity_links
            WHERE oracle_id=$1`,
          [identity.id],
        )
      ).rows;
      return {
        identity,
        summary,
        roster: roster.map((r) => ({
          ...r,
          team: { ...r.team, ...enriched.get(r.team.id)! },
          player: { ...r.player, ...enriched.get(r.player.id)! },
        })),
        sources: members,
        aliases,
        resolution,
        games: await games(input, identity.id),
      };
    },
    async image(hash: string) {
      z.string()
        .regex(/^[a-f0-9]{64}$/)
        .parse(hash);
      const result = await pool.query<{ mime: string; body: Buffer }>(
        "SELECT mime,body FROM image_assets WHERE hash=$1",
        [hash],
      );
      const row = result.rows[0];
      return row ? { contentType: row.mime, bytes: new Uint8Array(row.body) } : null;
    },
    async entityStatus() {
      const last =
        (
          await pool.query<{
            report: { at: string; catalogTeams: number; links: number; ambiguous: number };
          }>("SELECT report FROM identity_resolution_runs ORDER BY id DESC LIMIT 1")
        ).rows[0]?.report ?? null;
      const counts = (
        await pool.query<{ kind: string; identities: number; linked: number; images: number }>(
          `SELECT
              kind,
              count(*)::integer AS identities,
              (count(*) FILTER(WHERE document->>'sourceCount'='2'))::integer AS linked,
              (count(*) FILTER(WHERE document->>'imageUrl' IS NOT NULL))::integer AS images
            FROM entity_profiles
            GROUP BY kind
            ORDER BY kind`,
        )
      ).rows;
      const images = (
        await pool.query<{ failed: number; cached: number }>(
          `SELECT
              (count(*) FILTER(WHERE error IS NOT NULL))::integer AS failed,
              (count(*) FILTER(WHERE asset_hash IS NOT NULL))::integer AS cached
            FROM identity_images`,
        )
      ).rows[0]!;
      return { last, counts, images };
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
        `SELECT version,kind,document
          FROM metadata
          WHERE version=COALESCE(
            $1,
            (
              SELECT version
              FROM metadata
              ORDER BY string_to_array(version,'.')::integer[] DESC
              LIMIT 1
            )
          )`,
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
        `SELECT
            id::text,
            CASE WHEN request->>'kind' IN ('history','entity-history','entity-rosters') THEN (request->>'kind')||':'||(request->>'year') ELSE request->>'kind' END AS kind,
            state,
            error,
            requested_at
          FROM sync_jobs
          ORDER BY sync_jobs.id DESC
          LIMIT 30`,
      );
      const budget = await pool.query<{ count: number }>(
        `SELECT count(*)::integer AS count
          FROM request_ledger
          WHERE requested_at>$1::timestamptz-interval '1 hour'`,
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
        `SELECT
            year,
            count(*)::integer AS games,
            (count(*) FILTER(WHERE complete))::integer AS eligible,
            max(occurred_at) AS latest
          FROM games
          GROUP BY year
          ORDER BY year DESC`,
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
