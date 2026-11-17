import {
  directoryLimit,
  patchDirectoryLimit,
  type ChampionDirectory,
  type PatchDirectory,
} from "../domain/directories.js";
import type { Executor } from "./database.js";

export async function championDirectory(db: Executor): Promise<ChampionDirectory> {
  const row = (
    await db.query<ChampionDirectory>(
      `WITH latest AS (
        SELECT p.patch_key FROM patches p
        WHERE EXISTS (SELECT 1 FROM catalog_champions c WHERE c.patch_key=p.patch_key)
        ORDER BY p.release_order DESC LIMIT 1
      )
      SELECT (SELECT patch_key FROM latest) AS patch,
        coalesce((SELECT jsonb_agg(jsonb_build_object('championKey',c.champion_key,
          'championId',c.champion_id,'name',c.name,
          'imageUrl',CASE WHEN i.asset_hash IS NULL THEN NULL ELSE '/api/images/'||i.asset_hash END)
          ORDER BY lower(c.name),c.champion_id)
          FROM (SELECT * FROM catalog_champions WHERE patch_key=(SELECT patch_key FROM latest)
            ORDER BY lower(name),champion_id LIMIT $1) c
          LEFT JOIN catalog_images i ON i.patch_key=c.patch_key AND i.kind='champion' AND i.catalog_id=c.champion_id),
          '[]') AS champions`,
      [directoryLimit],
    )
  ).rows[0]!;
  return row;
}

export async function patchDirectory(db: Executor): Promise<PatchDirectory> {
  // One probe per source through the primary key, as the tier list does, never a full scan.
  const read = async (source: "solo" | "pro") =>
    (
      await db.query<{ patch_key: string; release_order: number }>(
        `SELECT p.patch_key,p.release_order FROM patches p
         WHERE EXISTS (SELECT 1 FROM champion_aggregates a WHERE a.source=$1 AND a.patch_key=p.patch_key)
         ORDER BY p.release_order DESC LIMIT $2`,
        [source, patchDirectoryLimit],
      )
    ).rows;
  const [solo, pro] = [await read("solo"), await read("pro")];
  const order = new Map([...solo, ...pro].map((r) => [r.patch_key, r.release_order]));
  const soloKeys = new Set(solo.map((r) => r.patch_key)),
    proKeys = new Set(pro.map((r) => r.patch_key));
  return {
    patches: [...order]
      .sort((a, b) => b[1] - a[1])
      .slice(0, patchDirectoryLimit)
      .map(([patch]) => ({ patch, solo: soloKeys.has(patch), pro: proKeys.has(patch) })),
  };
}
