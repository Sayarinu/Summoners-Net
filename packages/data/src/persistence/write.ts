import { createHash } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import type { Game, Identity, Match } from "../domain/models.js";
import { transaction } from "./database.js";
export const digest = (value: string) => createHash("sha256").update(value).digest("hex");
export async function saveIdentity(client: PoolClient, identity: Identity) {
  await client.query(
    "INSERT INTO identities(id,kind,name,source,source_id,document) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name,document=EXCLUDED.document",
    [identity.id, identity.kind, identity.name, identity.source, identity.sourceId, identity],
  );
  await client.query(
    "INSERT INTO source_mappings(source,kind,external_id,identity_id) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING",
    [identity.source, identity.kind, identity.sourceId, identity.id],
  );
}
export async function saveMatches(pool: Pool, matches: Match[]) {
  await transaction(pool, async (client) => {
    for (const match of matches) {
      for (const team of match.teams) await saveIdentity(client, team);
      const competition = `pandascore:${match.league}:${match.event}`;
      await client.query(
        "INSERT INTO competitions(id,league,name,source,source_id) VALUES($1,$2,$3,'pandascore',$1) ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name",
        [competition, match.league, match.event],
      );
      await client.query(
        "INSERT INTO matches(id,source_id,competition_id,league,starts_at,state,document) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(id) DO UPDATE SET competition_id=EXCLUDED.competition_id,league=EXCLUDED.league,starts_at=EXCLUDED.starts_at,state=EXCLUDED.state,document=EXCLUDED.document",
        [match.id, match.sourceId, competition, match.league, match.startsAt, match.state, match],
      );
      await client.query("DELETE FROM broadcasts WHERE match_id=$1", [match.id]);
      for (const b of match.broadcasts)
        await client.query("INSERT INTO broadcasts VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING", [
          match.id,
          b.provider,
          b.externalId,
          b,
        ]);
    }
  });
}
export async function saveRosters(
  pool: Pool,
  teams: { team: Identity; players: Identity[] }[],
  at: Date,
) {
  await transaction(pool, async (client) => {
    for (const entry of teams) {
      await saveIdentity(client, entry.team);
      await client.query(
        "INSERT INTO roster_snapshots VALUES($1,$2) ON CONFLICT(team_id) DO UPDATE SET observed_at=EXCLUDED.observed_at",
        [entry.team.id, at],
      );
      for (const player of entry.players) {
        await saveIdentity(client, player);
        await client.query(
          "INSERT INTO roster_observations VALUES($1,$2,$3) ON CONFLICT DO NOTHING",
          [entry.team.id, player.id, at],
        );
      }
    }
  });
}
export async function saveGames(pool: Pool, games: Game[], fileHash: string, year: number) {
  // The entire validated file commits atomically; a malformed file cannot erase good data.
  await transaction(pool, async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(9183272)");
    const unique = new Map<string, Identity>();
    for (const g of games)
      for (const p of g.participants) {
        unique.set(p.team.id, p.team);
        if (p.player) unique.set(p.player.id, p.player);
      }
    const identities = [...unique.values()];
    for (let i = 0; i < identities.length; i += 500) {
      await client.query(
        "INSERT INTO identities(id,kind,name,source,source_id,document) SELECT d->>'id',d->>'kind',d->>'name',d->>'source',d->>'sourceId',d FROM jsonb_array_elements($1) d ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name,document=EXCLUDED.document",
        [JSON.stringify(identities.slice(i, i + 500))],
      );
    }
    await client.query(
      "INSERT INTO source_mappings SELECT source,kind,source_id,id FROM identities ON CONFLICT DO NOTHING",
    );
    for (let i = 0; i < games.length; i += 100) {
      const chunk = games
        .slice(i, i + 100)
        .map((game) => ({ game, hash: digest(JSON.stringify(game)) }));
      const changed = await client.query<{ id: string }>(
        `INSERT INTO games(id,source_id,match_id,league,year,occurred_at,complete,document,content_hash)
    SELECT g->>'id',g->>'sourceId',g->>'matchId',g->>'league',(g->>'year')::integer,(g->>'occurredAt')::timestamptz,(g->>'complete')::boolean,g,h
    FROM (SELECT d->'game' g,d->>'hash' h FROM jsonb_array_elements($1) d) staged
    ON CONFLICT(id) DO UPDATE SET league=EXCLUDED.league,year=EXCLUDED.year,occurred_at=EXCLUDED.occurred_at,complete=EXCLUDED.complete,document=EXCLUDED.document,content_hash=EXCLUDED.content_hash
    WHERE games.content_hash<>EXCLUDED.content_hash RETURNING id`,
        [JSON.stringify(chunk)],
      );
      const ids = changed.rows.map((r) => r.id);
      if (!ids.length) continue;
      await client.query("DELETE FROM participants WHERE game_id=ANY($1)", [ids]);
      await client.query(
        `INSERT INTO participants SELECT g.id,p->>'slot',p->'team'->>'id',p->'player'->>'id',p->>'role',p->>'champion',(p->>'won')::boolean,(p->>'kills')::integer,(p->>'deaths')::integer,(p->>'assists')::integer FROM games g CROSS JOIN LATERAL jsonb_array_elements(g.document->'participants') p WHERE g.id=ANY($1)`,
        [ids],
      );
    }
    await client.query(
      "INSERT INTO imports(source,file_hash,year,records) VALUES('oracle',$1,$2,$3)",
      [fileHash, year, games.length],
    );
  });
}
