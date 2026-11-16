import type { PoolClient } from "pg";
import {
  buildKinds,
  deriveBuild,
  type BuildRow,
  type ChampionBuilds,
  type ItemEvent,
  type ItemInfo,
} from "../domain/builds.js";
import { applySamplePolicy } from "../domain/statistics.js";
import type { Executor } from "./database.js";

const itemEventTypes = ["ITEM_PURCHASED", "ITEM_SOLD", "ITEM_DESTROYED", "ITEM_UNDO"];
/**
 * Rebuilds one patch's solo-queue builds from timeline item events, inside the caller's
 * transaction. Only matches with a fetched timeline count; remakes are excluded.
 */
export async function rebuildBuilds(c: PoolClient, patchKey: string, now: Date) {
  await c.query("DELETE FROM champion_builds WHERE patch_key=$1", [patchKey]);
  // The patch's own item data, or the newest catalog that has the item.
  const items = new Map<number, ItemInfo>(
    (
      await c.query<{
        item_id: number;
        tags: string[] | null;
        builds_from: number[] | null;
        builds_into: number[] | null;
        total_gold: number | null;
      }>(
        `SELECT DISTINCT ON (i.item_id) i.item_id,i.tags,i.builds_from,i.builds_into,i.total_gold
         FROM catalog_items i JOIN patches p USING (patch_key)
         ORDER BY i.item_id,(i.patch_key=$1) DESC,p.release_order DESC`,
        [patchKey],
      )
    ).rows.map((r) => [
      r.item_id,
      {
        tags: r.tags ?? [],
        from: r.builds_from ?? [],
        into: r.builds_into ?? [],
        totalGold: r.total_gold,
      },
    ]),
  );
  const players = (
    await c.query<{
      match_id: string;
      participant_id: number;
      champion_key: number;
      role: string;
      win: boolean | null;
      queue: string;
      region: string;
      tier: string;
    }>(
      `SELECT m.match_id,p.participant_id,p.champion_id AS champion_key,
         CASE WHEN p.team_position IN ('TOP','JUNGLE','MIDDLE','BOTTOM','UTILITY')
           THEN p.team_position ELSE 'UNKNOWN' END AS role,p.win,
         coalesce(m.queue_id::text,'unknown') AS queue,i.region,
         coalesce((SELECT e.tier FROM riot_ladder_entries e WHERE e.puuid=i.first_seen_puuid
           ORDER BY e.fetched_at DESC LIMIT 1),'UNKNOWN') AS tier
       FROM riot_matches m JOIN riot_match_ids i USING (match_id)
       JOIN riot_match_participants p USING (match_id)
       WHERE m.patch_key=$1 AND m.remake IS NOT TRUE AND m.timeline_state='fetched'
       ORDER BY m.match_id,p.participant_id`,
      [patchKey],
    )
  ).rows;
  const counts = new Map<string, { games: number; resultGames: number; wins: number }>();
  const add = (base: string, kind: string, build: number[], win: boolean | null) => {
    const key = `${base}|${kind}|${build.join(",")}`;
    const row = counts.get(key) ?? { games: 0, resultGames: 0, wins: 0 };
    row.games++;
    if (win !== null) {
      row.resultGames++;
      if (win) row.wins++;
    }
    counts.set(key, row);
  };
  const matchIds = [...new Set(players.map((p) => p.match_id))];
  for (let i = 0; i < matchIds.length; i += 200) {
    const batch = matchIds.slice(i, i + 200);
    const events = new Map<string, ItemEvent[]>();
    for (const e of (
      await c.query<{
        match_id: string;
        participant_id: number;
        type: string;
        timestamp_ms: number;
        item_id: number | null;
        after_item_id: number | null;
      }>(
        `SELECT match_id,participant_id,type,timestamp_ms,item_id,after_item_id
         FROM riot_timeline_events WHERE match_id=ANY($1::text[]) AND type=ANY($2::text[])
           AND participant_id IS NOT NULL ORDER BY match_id,seq`,
        [batch, itemEventTypes],
      )
    ).rows) {
      const key = `${e.match_id}|${e.participant_id}`;
      const list = events.get(key) ?? [];
      list.push({
        type: e.type,
        timestampMs: e.timestamp_ms,
        itemId: e.item_id,
        afterItemId: e.after_item_id,
      });
      events.set(key, list);
    }
    for (const p of players.filter((x) => batch.includes(x.match_id))) {
      const build = deriveBuild(events.get(`${p.match_id}|${p.participant_id}`) ?? [], items);
      const base = [p.queue, p.region, p.tier, p.champion_key, p.role].join("|");
      if (build.start) add(base, "start", build.start, p.win);
      if (build.boots) add(base, "boots", [build.boots], p.win);
      if (build.completed.length >= 3) add(base, "path", build.completed.slice(0, 3), p.win);
      build.completed.slice(0, 3).forEach((item, n) => add(base, `slot${n + 1}`, [item], p.win));
    }
  }
  const rows = [...counts].map(([key, n]) => {
    const [queue, region, tier, championKey, role, kind, build] = key.split("|") as [
      string,
      string,
      string,
      string,
      string,
      string,
      string,
    ];
    return { queue, region, tier, championKey: Number(championKey), role, kind, build, ...n };
  });
  if (!rows.length) return 0;
  const column = <K extends keyof (typeof rows)[number]>(name: K) => rows.map((r) => r[name]);
  await c.query(
    `INSERT INTO champion_builds(patch_key,queue,region,tier,champion_key,role,kind,build,games,
       result_games,wins,built_at)
     SELECT $1,queue,region,tier,champion_key,role,kind,build,games,result_games,wins,$12
     FROM unnest($2::text[],$3::text[],$4::text[],$5::integer[],$6::text[],$7::text[],$8::text[],
       $9::integer[],$10::integer[],$11::integer[])
       AS r(queue,region,tier,champion_key,role,kind,build,games,result_games,wins)`,
    [
      patchKey,
      column("queue"),
      column("region"),
      column("tier"),
      column("championKey"),
      column("role"),
      column("kind"),
      column("build"),
      column("games"),
      column("resultGames"),
      column("wins"),
      now,
    ],
  );
  return rows.length;
}

/**
 * The most played builds of each kind for a champion on a patch, summed over the filtered
 * roles, regions and tiers. Reads only build aggregates and the item catalog.
 */
export async function championBuilds(
  db: Executor,
  input: {
    championKey: number;
    patch: string;
    role: string;
    region?: string | undefined;
    tier?: string | undefined;
  },
  perKind = 5,
): Promise<ChampionBuilds> {
  const rows = await db.query<{
    kind: (typeof buildKinds)[number];
    build: string;
    games: number;
    result_games: number;
    wins: number;
  }>(
    `SELECT kind,build,games,result_games,wins FROM (
       SELECT kind,build,sum(games)::integer AS games,sum(result_games)::integer AS result_games,
         sum(wins)::integer AS wins,
         row_number() OVER(PARTITION BY kind ORDER BY sum(games) DESC,build) AS n
       FROM champion_builds
       WHERE patch_key=$1 AND champion_key=$2 AND ($3='ALL' OR role=$3)
         AND ($4::text IS NULL OR region=$4) AND ($5::text IS NULL OR tier=$5)
       GROUP BY kind,build) b
     WHERE n<=$6 ORDER BY kind,n`,
    [input.patch, input.championKey, input.role, input.region ?? null, input.tier ?? null, perKind],
  );
  const ids = [...new Set(rows.rows.flatMap((r) => r.build.split(",").map(Number)))];
  const names = new Map(
    (
      await db.query<{ item_id: number; name: string; asset_hash: string | null }>(
        `SELECT DISTINCT ON (c.item_id) c.item_id,c.name,i.asset_hash FROM catalog_items c
         JOIN patches p USING (patch_key)
         LEFT JOIN catalog_images i ON i.patch_key=c.patch_key AND i.kind='item'
           AND i.catalog_id=c.item_id::text
         WHERE c.item_id=ANY($2::integer[])
         ORDER BY c.item_id,(c.patch_key=$1) DESC,p.release_order DESC`,
        [input.patch, ids],
      )
    ).rows.map((r) => [r.item_id, r]),
  );
  const result = Object.fromEntries(buildKinds.map((k) => [k, [] as BuildRow[]])) as ChampionBuilds;
  for (const r of rows.rows) {
    const rate = applySamplePolicy({
      value: r.result_games ? r.wins / r.result_games : null,
      sampleCount: r.result_games,
    });
    result[r.kind].push({
      items: r.build.split(",").map((id) => {
        const item = names.get(Number(id));
        return {
          id: Number(id),
          name: item?.name ?? null,
          imageUrl: item?.asset_hash ? `/api/images/${item.asset_hash}` : null,
        };
      }),
      games: r.games,
      winRate: { value: rate.value, sampleCount: rate.sampleCount },
      sample: rate.status,
    });
  }
  return result;
}
