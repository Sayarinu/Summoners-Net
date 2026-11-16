import type { PoolClient } from "pg";
import type { CatalogEntry, ItemAttributes } from "../providers/ddragon.js";
import type { Executor } from "./database.js";

export interface GameCatalog {
  champions: CatalogEntry[];
  items: (CatalogEntry & { item?: ItemAttributes })[];
  runes: CatalogEntry[];
  spells: CatalogEntry[];
}
export class ChampionMappingError extends Error {
  constructor(readonly names: string[]) {
    super(
      `Champion names map to more than one champion id (${names.join(", ")}); the previous mapping is kept.`,
    );
  }
}
const column = <K extends keyof CatalogEntry>(rows: CatalogEntry[], key: K) =>
  rows.map((r) => r[key]);

/**
 * Upserts one patch's catalog and rebuilds the Oracle champion name mapping in the caller's
 * transaction. Rows absent from a newer file are kept. The mapping is validated as a whole: if
 * any display name would map to two champion ids, nothing is written.
 */
export async function saveGameCatalog(
  c: PoolClient,
  patchKey: string,
  version: string,
  catalog: GameCatalog,
  now: Date,
) {
  const common = [patchKey, version, now];
  await c.query(
    `INSERT INTO catalog_champions(patch_key,version,observed_at,champion_id,champion_key,name,image)
     SELECT $1,$2,$3,* FROM unnest($4::text[],$5::integer[],$6::text[],$7::text[])
     ON CONFLICT(patch_key,champion_id) DO UPDATE SET champion_key=EXCLUDED.champion_key,
       name=EXCLUDED.name,image=EXCLUDED.image,version=EXCLUDED.version,observed_at=EXCLUDED.observed_at`,
    [
      ...common,
      column(catalog.champions, "id"),
      column(catalog.champions, "key"),
      column(catalog.champions, "name"),
      column(catalog.champions, "image"),
    ],
  );
  await c.query(
    `INSERT INTO catalog_items(patch_key,version,observed_at,item_id,name,image,tags,builds_from,
       builds_into,total_gold)
     SELECT $1,$2,$3,i.id,i.name,i.image,
       ARRAY(SELECT jsonb_array_elements_text(i.attrs->'tags')),
       ARRAY(SELECT jsonb_array_elements_text(i.attrs->'from')::integer),
       ARRAY(SELECT jsonb_array_elements_text(i.attrs->'into')::integer),
       (i.attrs->>'totalGold')::integer
     FROM unnest($4::integer[],$5::text[],$6::text[],$7::jsonb[]) AS i(id,name,image,attrs)
     ON CONFLICT(patch_key,item_id) DO UPDATE SET name=EXCLUDED.name,image=EXCLUDED.image,
       tags=EXCLUDED.tags,builds_from=EXCLUDED.builds_from,builds_into=EXCLUDED.builds_into,
       total_gold=EXCLUDED.total_gold,version=EXCLUDED.version,observed_at=EXCLUDED.observed_at`,
    [
      ...common,
      column(catalog.items, "id"),
      column(catalog.items, "name"),
      column(catalog.items, "image"),
      catalog.items.map((i) =>
        JSON.stringify(i.item ?? { tags: [], from: [], into: [], totalGold: null }),
      ),
    ],
  );
  await c.query(
    `INSERT INTO catalog_runes(patch_key,version,observed_at,rune_id,rune_key,name,icon,tree_id,slot)
     SELECT $1,$2,$3,* FROM unnest($4::integer[],$5::text[],$6::text[],$7::text[],$8::integer[],$9::integer[])
     ON CONFLICT(patch_key,rune_id) DO UPDATE SET rune_key=EXCLUDED.rune_key,name=EXCLUDED.name,
       icon=EXCLUDED.icon,tree_id=EXCLUDED.tree_id,slot=EXCLUDED.slot,version=EXCLUDED.version,
       observed_at=EXCLUDED.observed_at`,
    [
      ...common,
      column(catalog.runes, "id"),
      column(catalog.runes, "key"),
      column(catalog.runes, "name"),
      column(catalog.runes, "image"),
      column(catalog.runes, "treeId"),
      column(catalog.runes, "slot"),
    ],
  );
  await c.query(
    `INSERT INTO catalog_summoner_spells(patch_key,version,observed_at,spell_id,spell_key,name,image)
     SELECT $1,$2,$3,* FROM unnest($4::text[],$5::integer[],$6::text[],$7::text[])
     ON CONFLICT(patch_key,spell_id) DO UPDATE SET spell_key=EXCLUDED.spell_key,name=EXCLUDED.name,
       image=EXCLUDED.image,version=EXCLUDED.version,observed_at=EXCLUDED.observed_at`,
    [
      ...common,
      column(catalog.spells, "id"),
      column(catalog.spells, "key"),
      column(catalog.spells, "name"),
      column(catalog.spells, "image"),
    ],
  );
  // Every display name a champion has carried in any catalog patch, matched exactly.
  const conflicts = await c.query<{ name: string }>(
    "SELECT name FROM catalog_champions GROUP BY name HAVING count(DISTINCT champion_id)>1 ORDER BY name",
  );
  if (conflicts.rowCount) throw new ChampionMappingError(conflicts.rows.map((r) => r.name));
  await c.query("DELETE FROM oracle_champion_names");
  await c.query(
    "INSERT INTO oracle_champion_names(name,champion_id,observed_at) SELECT DISTINCT name,champion_id,$1::timestamptz FROM catalog_champions",
    [now],
  );
}

/** The champion id for an Oracle's Elixir champion name, or null when it is not mapped. */
export async function championForOracleName(db: Executor, name: string) {
  const result = await db.query<{ champion_id: string }>(
    "SELECT champion_id FROM oracle_champion_names WHERE name=$1",
    [name],
  );
  return result.rows[0]?.champion_id ?? null;
}

/** Oracle's Elixir champion names with no mapping, and how many participant rows carry each. */
export async function unmappedOracleChampions(db: Executor) {
  const result = await db.query<{ name: string; rows: number }>(
    `SELECT p.champion AS name,count(*)::integer AS rows
     FROM oracle_archive_participants p
     LEFT JOIN oracle_champion_names n ON n.name=p.champion
     WHERE p.champion IS NOT NULL AND n.name IS NULL
     GROUP BY p.champion ORDER BY p.champion`,
  );
  return result.rows;
}

export async function championCatalog(db: Executor, patchKey: string) {
  const result = await db.query<{
    champion_id: string;
    champion_key: number;
    name: string;
    image: string;
    version: string;
    observed_at: Date;
  }>(
    "SELECT champion_id,champion_key,name,image,version,observed_at FROM catalog_champions WHERE patch_key=$1 ORDER BY name",
    [patchKey],
  );
  return result.rows.map((r) => ({
    id: r.champion_id,
    key: r.champion_key,
    name: r.name,
    image: r.image,
    version: r.version,
    observedAt: r.observed_at.toISOString(),
  }));
}
