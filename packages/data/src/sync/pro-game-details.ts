import type { Pool } from "pg";
import { normalizePatch } from "../domain/patches.js";
import { saveItemCatalog } from "../persistence/catalog.js";
import { parseItemCatalog } from "../providers/ddragon.js";
import {
  leaguepediaGameUrl,
  parseLeaguepediaGame,
  proGamePlatformPattern,
} from "../providers/leaguepedia-game.js";
import { cacheCatalogImages } from "./catalog-images.js";

export async function refreshProGameDetails(
  pool: Pool,
  clock: () => Date,
  request: (url: string) => Promise<Response>,
) {
  // A small batch leaves time for fixtures and other jobs under the worker's lease.
  const games = await pool.query<{ source_game_id: string }>(
    `SELECT g.source_game_id
     FROM oracle_archive_games g LEFT JOIN pro_game_details d USING (source_game_id)
     WHERE g.complete AND g.source_game_id ~ $1
       AND (d.checked_at IS NULL OR (
         d.checked_at < $2::timestamptz - interval '7 days'
         AND (d.document IS NULL OR d.document->'gold' = '[]'::jsonb)
       ))
     GROUP BY g.source_game_id, d.checked_at
     ORDER BY d.checked_at IS NOT NULL, max(g.occurred_at) DESC, g.source_game_id
     LIMIT 3`,
    [proGamePlatformPattern, clock()],
  );
  let loaded = 0;
  for (const { source_game_id: id } of games.rows) {
    const response = await request(leaguepediaGameUrl(id));
    let detail: ReturnType<typeof parseLeaguepediaGame>;
    try {
      detail = parseLeaguepediaGame(await response.json(), id);
    } catch (error) {
      // A malformed record must not block other games or replace an earlier valid record.
      await pool.query(
        `INSERT INTO pro_game_details(source_game_id,checked_at) VALUES($1,$2)
         ON CONFLICT(source_game_id) DO UPDATE SET checked_at=EXCLUDED.checked_at`,
        [id, clock()],
      );
      throw error;
    }
    const hasLineups = detail?.players.length === 10;
    const checkedAt = clock();
    await pool.query(
      `INSERT INTO pro_game_details(source_game_id,checked_at,observed_at,document)
       VALUES($1,$2,$3,$4)
       ON CONFLICT(source_game_id) DO UPDATE SET checked_at=EXCLUDED.checked_at,
         observed_at=CASE WHEN EXCLUDED.document->'gold' <> '[]'::jsonb
           OR pro_game_details.document IS NULL THEN EXCLUDED.observed_at ELSE pro_game_details.observed_at END,
         document=CASE WHEN EXCLUDED.document->'gold' <> '[]'::jsonb
           OR pro_game_details.document IS NULL THEN EXCLUDED.document ELSE pro_game_details.document END`,
      [id, checkedAt, hasLineups ? checkedAt : null, hasLineups ? JSON.stringify(detail) : null],
    );
    if (!hasLineups || !detail) continue;
    loaded++;

    const patch = normalizePatch(detail.version)?.key;
    if (!patch) continue;
    const ids = [
      ...new Set(
        detail.players.flatMap(({ inventory, purchases }) =>
          [...inventory, ...(purchases?.map(({ itemId }) => itemId) ?? [])].map(String),
        ),
      ),
    ];
    if (!ids.length) continue;
    const catalog = await pool.query<{ version: string | null; stored: boolean }>(
      `SELECT ddragon_versions[1] AS version,
        EXISTS(SELECT 1 FROM catalog_items WHERE patch_key=$1) AS stored
       FROM patches WHERE patch_key=$1`,
      [patch],
    );
    const entry = catalog.rows[0];
    if (!entry?.version) continue;
    if (!entry.stored) {
      const version = entry.version;
      const response = await request(
        `https://ddragon.leagueoflegends.com/cdn/${version}/data/en_US/item.json`,
      );
      await saveItemCatalog(
        pool,
        patch,
        version,
        parseItemCatalog(await response.json(), version),
        clock(),
      );
    }
    await cacheCatalogImages(pool, patch, request, clock, ids);
  }
  return loaded;
}
