import type { Pool } from "pg";
import { imageAddress, readImage } from "../providers/images.js";
import {
  transparentImage,
  renditionVersion,
  type ImageAsset,
} from "../providers/transparent-image.js";
import { transaction, type Executor } from "../persistence/database.js";

async function saveRendition(c: Executor, original: ImageAsset, rendered: ImageAsset) {
  for (const image of [original, rendered])
    await c.query("INSERT INTO image_assets VALUES($1,$2,$3) ON CONFLICT DO NOTHING", [
      image.hash,
      image.mime,
      image.body,
    ]);
  await c.query(
    "INSERT INTO image_renditions VALUES($1,$2,$3) ON CONFLICT(source_hash) DO UPDATE SET asset_hash=EXCLUDED.asset_hash,version=EXCLUDED.version",
    [original.hash, rendered.hash, renditionVersion],
  );
}

export async function cacheImages(pool: Pool, fetcher: typeof fetch, clock: () => Date) {
  // Reprocess retained originals after a rendition change without downloading again.
  const pending = (
    await pool.query<{ hash: string }>(
      `SELECT DISTINCT i.asset_hash AS hash FROM identity_images i LEFT JOIN image_renditions r ON r.source_hash=i.asset_hash WHERE i.asset_hash IS NOT NULL AND (r.version IS NULL OR r.version<$1) AND (i.error IS NULL OR i.attempted_at<$2::timestamptz-interval '1 day') LIMIT 1000`,
      [renditionVersion, clock()],
    )
  ).rows;
  for (const { hash } of pending) {
    try {
      const original = (
        await pool.query<ImageAsset>("SELECT hash,mime,body FROM image_assets WHERE hash=$1", [
          hash,
        ])
      ).rows[0]!;
      const rendered = await transparentImage(original);
      await transaction(pool, async (c) => {
        await saveRendition(c, original, rendered);
        await c.query("UPDATE identity_images SET error=NULL WHERE asset_hash=$1", [hash]);
      });
    } catch {
      await pool.query("UPDATE identity_images SET attempted_at=$2,error=$3 WHERE asset_hash=$1", [
        hash,
        clock(),
        "Transparent image unavailable; saved source retained.",
      ]);
    }
  }
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
          const rendered = await transparentImage(image);
          await transaction(pool, async (c) => {
            await saveRendition(c, image, rendered);
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
