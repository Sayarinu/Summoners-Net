import type { Pool } from "pg";
import { imageAddress, readImage } from "../providers/images.js";
import { transaction } from "../persistence/database.js";

export async function cacheImages(pool: Pool, fetcher: typeof fetch, clock: () => Date) {
  const candidates = (
    await pool.query<{ id: string; url: string }>(
      `SELECT i.id,i.document->>'imageUrl' AS url FROM identities i LEFT JOIN identity_images img ON img.identity_id=i.id WHERE i.source='pandascore' AND i.document->>'imageUrl' IS NOT NULL AND (img.identity_id IS NULL OR img.source_url<>i.document->>'imageUrl' OR img.fetched_at IS NULL OR img.fetched_at<$1::timestamptz-interval '7 days') AND (img.attempted_at IS NULL OR img.error IS NULL OR img.attempted_at<$1::timestamptz-interval '1 day') ORDER BY img.attempted_at NULLS FIRST,i.id LIMIT 1000`,
      [clock()],
    )
  ).rows;
  let saved = 0;
  for (let i = 0; i < candidates.length; i += 4)
    await Promise.all(
      candidates.slice(i, i + 4).map(async (candidate) => {
        const at = clock();
        try {
          const url = imageAddress(candidate.url);
          const image = await readImage(
            await fetcher(url, { signal: AbortSignal.timeout(15000), redirect: "error" }),
          );
          await transaction(pool, async (c) => {
            await c.query("INSERT INTO image_assets VALUES($1,$2,$3) ON CONFLICT DO NOTHING", [
              image.hash,
              image.mime,
              image.body,
            ]);
            await c.query(
              "INSERT INTO identity_images VALUES($1,$2,$3,$4,$4,NULL) ON CONFLICT(identity_id) DO UPDATE SET asset_hash=EXCLUDED.asset_hash,source_url=EXCLUDED.source_url,fetched_at=EXCLUDED.fetched_at,attempted_at=EXCLUDED.attempted_at,error=NULL",
              [candidate.id, image.hash, url, at],
            );
          });
          saved++;
        } catch {
          // Keep both the old bytes and their attribution on any failed replacement.
          await pool.query(
            "INSERT INTO identity_images(identity_id,source_url,attempted_at,error) VALUES($1,$2,$3,$4) ON CONFLICT(identity_id) DO UPDATE SET attempted_at=EXCLUDED.attempted_at,error=EXCLUDED.error",
            [
              candidate.id,
              candidate.url,
              at,
              "Image unavailable or invalid; last successful image retained.",
            ],
          );
        }
      }),
    );
  return { attempted: candidates.length, saved };
}
