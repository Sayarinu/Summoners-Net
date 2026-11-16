import type { Pool } from "pg";
import type { CatalogIconQuery } from "../domain/catalog-icons.js";
import { transaction } from "../persistence/database.js";
import { catalogImageAddress, readImage } from "../providers/images.js";

/** Catalog entries are the queue; durable attempts bound retries and retain successful bytes. */
export async function cacheCatalogImages(
  pool: Pool,
  patch: string,
  request: (url: string) => Promise<Response>,
  clock: () => Date,
) {
  const candidates = (
    await pool.query<{
      kind: CatalogIconQuery["kind"];
      id: string;
      version: string;
      image: string;
    }>(
      `SELECT c.kind,c.id,c.version,c.image FROM catalog_icon_entries c
     LEFT JOIN catalog_images i ON (i.patch_key,i.kind,i.catalog_id)=(c.patch_key,c.kind,c.id)
     WHERE c.patch_key=$1 AND (i.fetched_at IS NULL OR i.fetched_at<$2::timestamptz-interval '7 days')
       AND (i.attempted_at IS NULL OR i.error IS NULL OR i.attempted_at<$2::timestamptz-interval '1 day')
     ORDER BY i.attempted_at NULLS FIRST,c.kind,c.id LIMIT 1000`,
      [patch, clock()],
    )
  ).rows;
  for (let offset = 0; offset < candidates.length; offset += 4)
    await Promise.all(
      candidates.slice(offset, offset + 4).map(async (c) => {
        const key = [patch, c.kind, c.id];
        // Persist before calling the provider, including attempts interrupted by process exit.
        await pool.query(
          `INSERT INTO catalog_images(patch_key,kind,catalog_id,attempted_at,error) VALUES($1,$2,$3,$4,$5)
      ON CONFLICT(patch_key,kind,catalog_id) DO UPDATE SET attempted_at=EXCLUDED.attempted_at,
      attempts=catalog_images.attempts+1,error=EXCLUDED.error`,
          [...key, clock(), "Image download pending; last successful image retained."],
        );
        try {
          const url = catalogImageAddress(c.kind, c.version, c.image);
          const image = await readImage(await request(url));
          if (image.mime !== "image/png") throw new Error("Catalog images must be PNG.");
          await transaction(pool, async (db) => {
            await db.query("INSERT INTO image_assets VALUES($1,$2,$3) ON CONFLICT DO NOTHING", [
              image.hash,
              image.mime,
              image.body,
            ]);
            await db.query(
              `UPDATE catalog_images SET source_url=$4,asset_hash=$5,fetched_at=$6,error=NULL
          WHERE patch_key=$1 AND kind=$2 AND catalog_id=$3`,
              [...key, url, image.hash, clock()],
            );
          });
        } catch {
          await pool.query(
            `UPDATE catalog_images SET error=$4 WHERE patch_key=$1 AND kind=$2 AND catalog_id=$3`,
            [...key, "Image unavailable or invalid; last successful image retained."],
          );
        }
      }),
    );
}
