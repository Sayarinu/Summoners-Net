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
  const rows = (
    await db.query<{ patch: string; solo: boolean; pro: boolean }>(
      `SELECT * FROM (
        SELECT p.patch_key AS patch,p.release_order,
          (SELECT true FROM champion_aggregates a WHERE a.source='solo' AND a.patch_key=p.patch_key LIMIT 1)
            IS NOT NULL AS solo,
          (SELECT true FROM champion_aggregates a WHERE a.source='pro' AND a.patch_key=p.patch_key LIMIT 1)
            IS NOT NULL AS pro
        FROM patches p) p
      WHERE solo OR pro ORDER BY release_order DESC LIMIT $1`,
      [patchDirectoryLimit],
    )
  ).rows;
  return { patches: rows.map(({ patch, solo, pro }) => ({ patch, solo, pro })) };
}
