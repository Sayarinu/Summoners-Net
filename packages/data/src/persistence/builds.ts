import type { PoolClient } from "pg";
import {
  buildKinds,
  deriveBuild,
  type BuildItem,
  type BuildRow,
  type ChampionBuilds,
  type ItemEvent,
  type ItemInfo,
  type RuneTree,
  statShardNames,
  statShardRows,
} from "../domain/builds.js";
import { applySamplePolicy } from "../domain/statistics.js";
import {
  completeSkillPath,
  deriveSkillOrder,
  deriveSkillPath,
  skillNames,
  type SkillEvent,
} from "../domain/skills.js";
import type { Executor } from "./database.js";

const itemEventTypes = [
  "ITEM_PURCHASED",
  "ITEM_SOLD",
  "ITEM_DESTROYED",
  "ITEM_UNDO",
  "SKILL_LEVEL_UP",
];
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
    const skills = new Map<string, SkillEvent[]>();
    for (const e of (
      await c.query<{
        match_id: string;
        participant_id: number;
        type: string;
        timestamp_ms: number;
        item_id: number | null;
        after_item_id: number | null;
        skill_slot: number | null;
        level_up_type: string | null;
      }>(
        `SELECT match_id,participant_id,type,timestamp_ms,item_id,after_item_id,skill_slot,
           level_up_type
         FROM riot_timeline_events WHERE match_id=ANY($1::text[]) AND type=ANY($2::text[])
           AND participant_id IS NOT NULL ORDER BY match_id,seq`,
        [batch, itemEventTypes],
      )
    ).rows) {
      const key = `${e.match_id}|${e.participant_id}`;
      if (e.type === "SKILL_LEVEL_UP") {
        const ups = skills.get(key) ?? [];
        ups.push({
          timestampMs: e.timestamp_ms,
          skillSlot: e.skill_slot,
          levelUpType: e.level_up_type,
        });
        skills.set(key, ups);
        continue;
      }
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
      build.completed.slice(0, 6).forEach((item, n) => add(base, `slot${n + 1}`, [item], p.win));
      // Incomplete skill-ups are counted on their own, never as an order.
      const order = deriveSkillOrder(skills.get(`${p.match_id}|${p.participant_id}`) ?? []);
      add(base, order.first ? "skills" : "skills_incomplete", order.first ?? [0], p.win);
      add(base, order.max ? "skillmax" : "skillmax_incomplete", order.max ?? [0], p.win);
      const path = deriveSkillPath(skills.get(`${p.match_id}|${p.participant_id}`) ?? []);
      if (path) add(base, "skillpath", path, p.win);
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
  const loadouts = await rebuildLoadouts(c, patchKey, now);
  if (!rows.length) return loadouts;
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
  return rows.length + loadouts;
}

/** Rune pages, keystones, stat shards and spell pairs, counted in SQL from match details. */
async function rebuildLoadouts(c: PoolClient, patchKey: string, now: Date) {
  const inserted = await c.query(
    `WITH players AS (
       SELECT m.match_id,p.participant_id,p.champion_id AS champion_key,
         CASE WHEN p.team_position IN ('TOP','JUNGLE','MIDDLE','BOTTOM','UTILITY')
           THEN p.team_position ELSE 'UNKNOWN' END AS role,p.win,
         coalesce(m.queue_id::text,'unknown') AS queue,i.region,
         coalesce((SELECT e.tier FROM riot_ladder_entries e WHERE e.puuid=i.first_seen_puuid
           ORDER BY e.fetched_at DESC LIMIT 1),'UNKNOWN') AS tier,
         p.summoner1_id,p.summoner2_id,p.stat_perk_offense,p.stat_perk_flex,p.stat_perk_defense
       FROM riot_matches m JOIN riot_match_ids i USING (match_id)
       JOIN riot_match_participants p USING (match_id)
       WHERE m.patch_key=$1 AND m.remake IS NOT TRUE),
     pages AS (
       SELECT match_id,participant_id,
         max(style_id) FILTER(WHERE style='primary') AS primary_style,
         max(style_id) FILTER(WHERE style='sub') AS sub_style,
         count(*) FILTER(WHERE style='primary') AS primary_count,
         count(*) FILTER(WHERE style='sub') AS sub_count,
         string_agg(perk_id::text,',' ORDER BY slot) FILTER(WHERE style='primary') AS primary_perks,
         string_agg(perk_id::text,',' ORDER BY slot) FILTER(WHERE style='sub') AS sub_perks,
         max(perk_id) FILTER(WHERE style='primary' AND slot=0) AS keystone
       FROM riot_match_perks WHERE match_id IN (SELECT match_id FROM players)
       GROUP BY match_id,participant_id),
     loadouts AS (
       SELECT p.*,'runes' AS kind,
         concat_ws(',',r.primary_style,r.primary_perks,r.sub_style,r.sub_perks) AS build
       FROM players p JOIN pages r USING (match_id,participant_id)
       WHERE r.primary_count=4 AND r.sub_count=2
       UNION ALL
       SELECT p.*,'keystone',r.keystone::text FROM players p JOIN pages r USING (match_id,participant_id)
       WHERE r.keystone IS NOT NULL
       UNION ALL
       SELECT p.*,'shards',concat_ws(',',p.stat_perk_offense,p.stat_perk_flex,p.stat_perk_defense)
       FROM players p WHERE p.stat_perk_offense IS NOT NULL AND p.stat_perk_flex IS NOT NULL
         AND p.stat_perk_defense IS NOT NULL
       UNION ALL
       SELECT p.*,'spells',concat_ws(',',least(p.summoner1_id,p.summoner2_id),
         greatest(p.summoner1_id,p.summoner2_id))
       FROM players p WHERE p.summoner1_id>0 AND p.summoner2_id>0)
     INSERT INTO champion_builds(patch_key,queue,region,tier,champion_key,role,kind,build,games,
       result_games,wins,built_at)
     SELECT $1,queue,region,tier,champion_key,role,kind,build,count(*),count(win),
       count(*) FILTER(WHERE win),$2
     FROM loadouts GROUP BY queue,region,tier,champion_key,role,kind,build`,
    [patchKey, now],
  );
  return inserted.rowCount ?? 0;
}

const entryKind = (kind: (typeof buildKinds)[number]): BuildItem["kind"] =>
  kind === "skills" || kind === "skillmax" || kind === "skillpath"
    ? "skill"
    : kind === "runes" || kind === "keystone"
      ? "rune"
      : kind === "shards"
        ? "shard"
        : kind === "spells"
          ? "spell"
          : "item";
/**
 * The most played builds and loadouts of each kind for a champion on a patch, summed over the
 * filtered roles, regions and tiers. Reads only build aggregates and the catalog.
 */
export async function championBuilds(
  db: Executor,
  input: {
    championKey: number;
    patch: string;
    /** Patches whose games are combined, the patch among them; only the patch when absent. */
    patches?: readonly string[] | undefined;
    role: string;
    region?: string | undefined;
    tier?: string | undefined;
    /** The champion's games in the selection, the denominator of pick rates. */
    championGames: number;
  },
  /** Options listed per kind: the page shows the top few and lists the rest on request. */
  perKind = 25,
): Promise<ChampionBuilds> {
  const rows = await db.query<{
    kind: (typeof buildKinds)[number];
    build: string;
    games: number;
    result_games: number;
    wins: number;
    kind_games: number;
  }>(
    `SELECT kind,build,games,result_games,wins,kind_games FROM (
       SELECT kind,build,sum(games)::integer AS games,sum(result_games)::integer AS result_games,
         sum(wins)::integer AS wins,
         -- Every option of a kind, listed or not, for the share of each option.
         (sum(sum(games)) OVER(PARTITION BY kind))::integer AS kind_games,
         row_number() OVER(PARTITION BY kind ORDER BY sum(games) DESC,build) AS n
       FROM champion_builds
       WHERE patch_key=ANY($1::text[]) AND champion_key=$2 AND ($3='ALL' OR role=$3)
         AND ($4::text IS NULL OR region=$4) AND ($5::text IS NULL OR tier=$5)
         AND kind NOT IN ('skills_incomplete','skillmax_incomplete')
       GROUP BY kind,build) b
     WHERE n<=$6 ORDER BY kind,n`,
    [
      input.patches ?? [input.patch],
      input.championKey,
      input.role,
      input.region ?? null,
      input.tier ?? null,
      perKind,
    ],
  );
  const ids = (kind: BuildItem["kind"]) => [
    ...new Set(
      rows.rows
        .filter((r) => entryKind(r.kind) === kind)
        .flatMap((r) => r.build.split(",").map(Number)),
    ),
  ];
  // Names from the patch's catalog, or the newest catalog that has the entry. Icons are cached
  // per patch, so each takes the patch's icon or else the newest cached one for the same id.
  const icon = (kind: string, id: string) =>
    `(SELECT i.asset_hash FROM catalog_images i JOIN patches ip USING (patch_key)
      WHERE i.kind='${kind}' AND i.catalog_id=${id} AND i.asset_hash IS NOT NULL
      ORDER BY (i.patch_key=$1) DESC,ip.release_order DESC LIMIT 1) AS asset_hash`;
  const lookup = async (sql: string, values: number[]) =>
    new Map(
      (
        await db.query<{ id: number; catalog_id: string; name: string; asset_hash: string | null }>(
          sql,
          [input.patch, values],
        )
      ).rows.map((r) => [r.id, r]),
    );
  const catalogs = {
    item: await lookup(
      `SELECT DISTINCT ON (c.item_id) c.item_id AS id,c.item_id::text AS catalog_id,c.name,
         ${icon("item", "c.item_id::text")}
       FROM catalog_items c JOIN patches p USING (patch_key)
       WHERE c.item_id=ANY($2::integer[]) ORDER BY c.item_id,(c.patch_key=$1) DESC,p.release_order DESC`,
      ids("item"),
    ),
    rune: await lookup(
      `SELECT DISTINCT ON (c.rune_id) c.rune_id AS id,c.rune_id::text AS catalog_id,c.name,
         ${icon("rune", "c.rune_id::text")}
       FROM catalog_runes c JOIN patches p USING (patch_key)
       WHERE c.rune_id=ANY($2::integer[]) ORDER BY c.rune_id,(c.patch_key=$1) DESC,p.release_order DESC`,
      ids("rune"),
    ),
    spell: await lookup(
      `SELECT DISTINCT ON (c.spell_key) c.spell_key AS id,c.spell_id AS catalog_id,c.name,
         ${icon("spell", "c.spell_id")}
       FROM catalog_summoner_spells c JOIN patches p USING (patch_key)
       WHERE c.spell_key=ANY($2::integer[]) ORDER BY c.spell_key,(c.patch_key=$1) DESC,p.release_order DESC`,
      ids("spell"),
    ),
    // Stat shards are named here; their icons are cached as runes by id.
    shard: new Map(
      (
        await db.query<{ id: number; asset_hash: string | null }>(
          `SELECT s.id,${icon("rune", "s.id::text")} FROM unnest($2::integer[]) s(id)`,
          [input.patch, Object.keys(statShardNames).map(Number)],
        )
      ).rows.map((r) => [
        r.id,
        { catalog_id: String(r.id), name: statShardNames[r.id]!, asset_hash: r.asset_hash },
      ]),
    ),
    skill: new Map(
      Object.entries(skillNames).map(([slot, name]) => [
        Number(slot),
        { catalog_id: slot, name, asset_hash: null as string | null },
      ]),
    ),
  };
  const excluded = await db.query<{ kind: string; games: number }>(
    `SELECT kind,sum(games)::integer AS games FROM champion_builds
     WHERE patch_key=ANY($1::text[]) AND champion_key=$2 AND ($3='ALL' OR role=$3)
       AND ($4::text IS NULL OR region=$4) AND ($5::text IS NULL OR tier=$5)
       AND kind IN ('skills_incomplete','skillmax_incomplete') GROUP BY kind`,
    [
      input.patches ?? [input.patch],
      input.championKey,
      input.role,
      input.region ?? null,
      input.tier ?? null,
    ],
  );
  const excludedGames = (kind: string) => excluded.rows.find((r) => r.kind === kind)?.games ?? 0;
  const result = {
    ...(Object.fromEntries(buildKinds.map((k) => [k, [] as BuildRow[]])) as Omit<
      ChampionBuilds,
      "excluded" | "runeTrees" | "shardRows"
    >),
    excluded: {
      skills: excludedGames("skills_incomplete"),
      skillmax: excludedGames("skillmax_incomplete"),
    },
    runeTrees: [],
    shardRows: [],
  } as ChampionBuilds;
  for (const r of rows.rows) {
    const kind = entryKind(r.kind);
    // Rates are shown at any sample; `sample` keeps the policy's status for styling.
    const win = {
      value: r.result_games ? r.wins / r.result_games : null,
      sampleCount: r.result_games,
    };
    const status = applySamplePolicy(win).status;
    // Loadouts come from every game, so their pick rate is over the champion's games. Items come
    // only from games with timelines, so theirs is the share among every option of the kind.
    const pool = kind === "item" ? r.kind_games : input.championGames;
    const pick = { value: pool ? r.games / pool : null, sampleCount: pool };
    const ids = r.build.split(",");
    // A skill path is continued to the last level by the client's rules.
    const path = r.kind === "skillpath" ? completeSkillPath(ids.map(Number)).map(String) : ids;
    result[r.kind].push({
      items: path.map((raw) => {
        const id = Number(raw);
        const entry = catalogs[kind].get(id);
        return {
          kind,
          id,
          catalogId: entry?.catalog_id ?? raw,
          name: entry?.name ?? null,
          imageUrl: entry?.asset_hash ? `/api/images/${entry.asset_hash}` : null,
        };
      }),
      games: r.games,
      pickRate: pick,
      winRate: win,
      sample: status,
    });
  }
  result.shardRows = statShardRows.map((row) =>
    row.map((id) => {
      const entry = catalogs.shard.get(id);
      return {
        kind: "shard" as const,
        id,
        catalogId: String(id),
        name: entry?.name ?? null,
        imageUrl: entry?.asset_hash ? `/api/images/${entry.asset_hash}` : null,
      };
    }),
  );
  result.runeTrees = await runeTrees(
    db,
    input.patch,
    // A rune page lists its primary tree first and its secondary tree sixth.
    [...new Set(result.runes.flatMap((r) => [r.items[0]?.id, r.items[5]?.id]))].filter(
      (id): id is number => id !== undefined,
    ),
    (id) => icon("rune", id),
  );
  return result;
}

/**
 * Each tree's runes by row from one catalog: the patch's own, or the newest that lists runes,
 * so runes retired in other patches never appear among the alternatives.
 */
async function runeTrees(
  db: Executor,
  patch: string,
  trees: number[],
  icon: (id: string) => string,
): Promise<RuneTree[]> {
  if (!trees.length) return [];
  const rows = await db.query<{
    rune_id: number;
    name: string;
    tree_id: number | null;
    slot: number | null;
    asset_hash: string | null;
  }>(
    `WITH catalog AS (
       SELECT c.patch_key FROM catalog_runes c JOIN patches p USING (patch_key)
       GROUP BY c.patch_key,p.release_order
       ORDER BY (c.patch_key=$1) DESC,p.release_order DESC LIMIT 1)
     SELECT c.rune_id,c.name,c.tree_id,c.slot,${icon("c.rune_id::text")}
     FROM catalog_runes c JOIN catalog USING (patch_key)
     WHERE coalesce(c.tree_id,c.rune_id)=ANY($2::integer[])
     ORDER BY c.slot NULLS FIRST,c.rune_id`,
    [patch, trees],
  );
  const entry = (r: (typeof rows.rows)[number]): BuildItem => ({
    kind: "rune",
    id: r.rune_id,
    catalogId: String(r.rune_id),
    name: r.name,
    imageUrl: r.asset_hash ? `/api/images/${r.asset_hash}` : null,
  });
  return trees.flatMap((id) => {
    const tree = rows.rows.find((r) => r.rune_id === id && r.tree_id === null);
    if (!tree) return [];
    const runes = rows.rows.filter((r) => r.tree_id === id);
    const slots = [...new Set(runes.map((r) => r.slot!))].sort((a, b) => a - b);
    return [
      { tree: entry(tree), rows: slots.map((n) => runes.filter((r) => r.slot === n).map(entry)) },
    ];
  });
}
