import type { Pool } from "pg";
import type { Identity, Match } from "../domain/models.js";
import { resolveIdentities, type ContextTeam, type PlayedSquad } from "../domain/resolution.js";
import { transaction } from "./database.js";
import { saveIdentity } from "./write.js";

export async function saveCatalog(pool: Pool, teams: ContextTeam[]) {
  await transaction(pool, async (c) => {
    for (const team of teams)
      await c.query(
        `INSERT INTO identity_catalog
          VALUES ($1,$2,$3)
          ON CONFLICT (id)
          DO UPDATE SET document=EXCLUDED.document,observed_at=EXCLUDED.observed_at`,
        [team.team.id, team, team.observedAt],
      );
  });
}
export async function saveIdentityContext(pool: Pool, matches: Match[], year: number, at: Date) {
  await transaction(pool, async (c) => {
    for (const match of matches)
      await c.query(
        `INSERT INTO identity_match_context
          VALUES ($1,$2,$3,$4)
          ON CONFLICT (id)
          DO UPDATE SET document=EXCLUDED.document,observed_at=EXCLUDED.observed_at`,
        [match.id, year, match, at],
      );
  });
}
export async function resolveStored(pool: Pool, at: Date) {
  return transaction(pool, async (c) => {
    await c.query("SELECT pg_advisory_xact_lock(9183272)");
    // Corrected imports replace their naming evidence; a removed name must not keep a link alive.
    await c.query("DELETE FROM identity_aliases WHERE identity_id LIKE 'oracle:%'");
    await c.query(
      `INSERT INTO identity_aliases
        SELECT DISTINCT value->'team'->>'id',value->'team'->>'name'
        FROM games
        CROSS JOIN LATERAL jsonb_array_elements(document->'participants')
        UNION
        SELECT DISTINCT value->'player'->>'id',value->'player'->>'name'
        FROM games
        CROSS JOIN LATERAL jsonb_array_elements(document->'participants')
        WHERE value->'player'->>'id' IS NOT NULL
        ON CONFLICT DO NOTHING`,
    );
    const contexts = (
      await c.query<{ document: Match }>(
        "SELECT document FROM identity_match_context UNION ALL SELECT document FROM matches",
      )
    ).rows.map((r) => r.document);
    const games = (
      await c.query<{
        gameId: string;
        playedAt: string;
        league: string;
        teams: { id: string; name: string }[];
      }>(
        `SELECT
            g.id AS "gameId",
            g.document->>'occurredAt' AS "playedAt",
            g.league,
            jsonb_agg(DISTINCT jsonb_build_object('id',p->'team'->>'id','name',p->'team'->>'name')) AS teams
          FROM games g
          CROSS JOIN LATERAL jsonb_array_elements(g.document->'participants') p
          WHERE g.document->>'number'='1'
          GROUP BY g.id`,
      )
    ).rows;
    const aliases = (
      await c.query<{ id: string; name: string }>(
        "SELECT identity_id AS id,name FROM identity_aliases ORDER BY identity_id,name",
      )
    ).rows;
    const squads = (
      await c.query<PlayedSquad>(
        `SELECT
            g.id AS "gameId",
            p.team_id AS "teamId",
            to_char(g.occurred_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "playedAt",
            jsonb_agg(jsonb_build_object(
              'id', p.player_id,
              'name', member->'player'->>'name',
              'role', p.role
            ) ORDER BY p.slot) AS players
          FROM games g
          JOIN participants p ON p.game_id=g.id
          CROSS JOIN LATERAL jsonb_array_elements(g.document->'participants') member
          WHERE g.complete AND p.player_id IS NOT NULL AND member->>'slot'=p.slot
          GROUP BY g.id,p.team_id
          ORDER BY g.occurred_at DESC,g.id`,
      )
    ).rows;
    const catalog = (
      await c.query<{ document: ContextTeam }>("SELECT document FROM identity_catalog ORDER BY id")
    ).rows.map((r) => r.document);
    const current = (
      await c.query<{ document: ContextTeam }>(
        `SELECT jsonb_build_object(
            'team', t.document,
            'observedAt', s.observed_at,
            'players', coalesce(
              jsonb_agg(p.document ORDER BY p.id) FILTER(WHERE p.id IS NOT NULL),
              '[]'
            )
          ) AS document
          FROM roster_snapshots s
          JOIN identities t ON t.id=s.team_id
          LEFT JOIN roster_observations r ON r.team_id=s.team_id AND r.observed_at=s.observed_at
          LEFT JOIN identities p ON p.id=r.player_id
          GROUP BY t.id,s.observed_at`,
      )
    ).rows.map((r) => r.document);
    const teams = new Map(catalog.map((t) => [t.team.id, t]));
    for (const team of current)
      if (team.observedAt >= (teams.get(team.team.id)?.observedAt ?? ""))
        teams.set(team.team.id, team);
    const historical = (
      await c.query<{ document: ContextTeam[] }>(
        "SELECT document FROM identity_tournament_rosters ORDER BY year,tournament_id",
      )
    ).rows.flatMap((r) => r.document);
    const contextIdentities = new Map(contexts.flatMap((m) => m.teams).map((t) => [t.id, t]));
    for (const match of contexts)
      for (const team of match.teams) aliases.push({ id: team.id, name: team.name });
    const result = resolveIdentities({
      aliases,
      squads,
      teams: [...teams.values(), ...historical],
      matches: contexts,
      games,
    });
    const linked = new Set(result.links.map((l) => l.pandaId));
    for (const id of linked) {
      const identity = contextIdentities.get(id);
      if (identity) await saveIdentity(c, identity);
    }
    for (const team of historical) {
      if (linked.has(team.team.id)) await saveIdentity(c, team.team);
      for (const player of team.players) if (linked.has(player.id)) await saveIdentity(c, player);
    }
    // Only corroborated catalog records enter browsing; catalog academy and unrelated teams stay private.
    for (const team of teams.values()) {
      if (linked.has(team.team.id)) {
        await saveIdentity(c, team.team);
        await c.query(
          `INSERT INTO roster_snapshots
            VALUES ($1,$2)
            ON CONFLICT (team_id)
            DO UPDATE SET observed_at=greatest(roster_snapshots.observed_at,EXCLUDED.observed_at)`,
          [team.team.id, team.observedAt],
        );
        for (const player of team.players) {
          await saveIdentity(c, player);
          await c.query("INSERT INTO roster_observations VALUES($1,$2,$3) ON CONFLICT DO NOTHING", [
            team.team.id,
            player.id,
            team.observedAt,
          ]);
        }
      }
      for (const player of team.players) if (linked.has(player.id)) await saveIdentity(c, player);
    }
    await c.query("DELETE FROM identity_links");
    for (const link of result.links)
      await c.query("INSERT INTO identity_links VALUES($1,$2,$3,$4)", [
        link.oracleId,
        link.pandaId,
        link.evidence,
        at,
      ]);
    const counts = (
      await c.query<{ kind: string; identities: number; linked: number; images: number }>(
        `SELECT
            p.kind,
            count(*)::integer AS identities,
            (count(*) FILTER(WHERE document->>'sourceCount'='2'))::integer AS linked,
            (count(*) FILTER(WHERE document->>'imageUrl' IS NOT NULL))::integer AS images
          FROM entity_profiles p
          GROUP BY p.kind
          ORDER BY p.kind`,
      )
    ).rows;
    const report = {
      at: at.toISOString(),
      catalogTeams: teams.size,
      links: result.links.length,
      ambiguous: result.ambiguous,
      counts,
    };
    await c.query("INSERT INTO identity_resolution_runs(resolved_at,report) VALUES($1,$2)", [
      at,
      report,
    ]);
    return report;
  });
}

export async function enrichIdentities(
  pool: Pool,
  identities: Identity[],
): Promise<
  Map<
    string,
    Pick<Identity, "entityId" | "publicSlug" | "imageUrl" | "imageSource" | "sourceCount">
  >
> {
  const rows = (
    await pool.query<{
      id: string;
      entity_id: string;
      public_slug: string | null;
      image_url: string | null;
      image_source: string | null;
      source_count: number;
    }>(
      `SELECT
          m.id,
          m.entity_id,
          p.document->>'publicSlug' AS public_slug,
          coalesce('/api/images/'||coalesce(r.asset_hash,img.asset_hash),p.document->>'imageUrl') AS image_url,
          CASE WHEN img.asset_hash IS NOT NULL THEN 'PandaScore' ELSE p.document->>'imageSource' END AS image_source,
          (p.document->>'sourceCount')::integer AS source_count
        FROM entity_members m
        JOIN entity_profiles p ON p.id=m.entity_id
        LEFT JOIN identity_images img ON img.identity_id=m.id
        LEFT JOIN image_renditions r ON r.source_hash=img.asset_hash
        WHERE m.id=ANY($1)`,
      [identities.map((i) => i.id)],
    )
  ).rows;
  const found = new Map(rows.map((r) => [r.id, r]));
  return new Map(
    identities.map((i) => {
      const r = found.get(i.id);
      return [
        i.id,
        {
          entityId: r?.entity_id ?? i.id,
          publicSlug: r?.public_slug ?? undefined,
          imageUrl: r?.image_url ?? null,
          imageSource: r?.image_source ?? null,
          sourceCount: r?.source_count ?? 1,
        },
      ];
    }),
  );
}
