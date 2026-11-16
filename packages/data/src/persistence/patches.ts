import type { Pool } from "pg";
import { comparePatches, normalizePatch, type PatchKey } from "../domain/patches.js";
import { transaction, type Executor } from "./database.js";

export type PatchSource = "ddragon" | "oracle" | "riot";
export interface CatalogPatch {
  key: string;
  releaseOrder: number;
  ddragonVersions: string[];
  sourceStrings: { source: PatchSource; value: string }[];
  observedAt: string;
}
export interface UnresolvedPatch {
  source: PatchSource;
  value: string;
  reason: "unparseable" | "unknown";
}

async function recordSources(db: Executor, source: PatchSource, values: string[], now: Date) {
  await db.query(
    `INSERT INTO patch_sources(source,source_string,first_seen_at,last_seen_at)
     SELECT $1,value,$3,$3 FROM unnest($2::text[]) value
     ON CONFLICT(source,source_string) DO UPDATE SET last_seen_at=EXCLUDED.last_seen_at`,
    [source, values, now],
  );
}

/** Links every recorded source string to a catalog patch, or leaves it NULL when there is none. */
async function resolveSources(db: Executor) {
  const known = new Set(
    (await db.query<{ patch_key: string }>("SELECT patch_key FROM patches")).rows.map(
      (r) => r.patch_key,
    ),
  );
  const rows = (
    await db.query<{ source: PatchSource; source_string: string; patch_key: string | null }>(
      "SELECT source,source_string,patch_key FROM patch_sources",
    )
  ).rows;
  const changed = rows
    .map((r) => {
      const key = normalizePatch(r.source_string)?.key;
      return { ...r, next: key && known.has(key) ? key : null };
    })
    .filter((r) => r.next !== r.patch_key);
  if (!changed.length) return;
  await db.query(
    `UPDATE patch_sources s SET patch_key=c.patch_key
     FROM unnest($1::text[],$2::text[],$3::text[]) c(source,source_string,patch_key)
     WHERE s.source=c.source AND s.source_string=c.source_string`,
    [changed.map((r) => r.source), changed.map((r) => r.source_string), changed.map((r) => r.next)],
  );
}

/**
 * Saves a validated Data Dragon versions list. Patches absent from a newer list are kept, and
 * source strings are stored exactly as received.
 */
export async function savePatchCatalog(pool: Pool, versions: readonly string[], now: Date) {
  const patches = new Map<string, PatchKey & { versions: string[] }>();
  for (const version of versions) {
    const patch = normalizePatch(version);
    if (!patch) continue;
    const entry = patches.get(patch.key) ?? { ...patch, versions: [] };
    if (!entry.versions.includes(version)) entry.versions.push(version);
    patches.set(patch.key, entry);
  }
  const ordered = [...patches.values()].sort(comparePatches);
  await transaction(pool, async (c) => {
    await c.query("SELECT pg_advisory_xact_lock(9183276)");
    for (const p of ordered)
      await c.query(
        `INSERT INTO patches(patch_key,major,minor,release_order,ddragon_versions,observed_at)
         VALUES($1,$2,$3,1,$4,$5)
         ON CONFLICT(patch_key) DO UPDATE SET observed_at=EXCLUDED.observed_at,
           ddragon_versions=patches.ddragon_versions||ARRAY(
             SELECT v FROM unnest(EXCLUDED.ddragon_versions) v
             WHERE v<>ALL(patches.ddragon_versions))`,
        [p.key, p.major, p.minor, p.versions, now],
      );
    await c.query(
      `UPDATE patches p SET release_order=r.n
       FROM (SELECT patch_key,row_number() OVER(ORDER BY major,minor)::integer n FROM patches) r
       WHERE p.patch_key=r.patch_key AND p.release_order<>r.n`,
    );
    await recordSources(c, "ddragon", [...new Set(versions)], now);
    await resolveSources(c);
    // Riot matches ingested before their patch reached the catalog are linked now.
    await c.query(
      `UPDATE riot_matches m SET patch_key=s.patch_key FROM patch_sources s
       WHERE m.patch_key IS NULL AND s.source='riot' AND s.source_string=m.game_version
         AND s.patch_key IS NOT NULL`,
    );
  });
  return ordered.length;
}

/** Records the distinct patch strings of the Oracle's Elixir archive and links them. */
export async function recordOraclePatches(pool: Pool, now: Date) {
  await transaction(pool, async (c) => {
    await c.query("SELECT pg_advisory_xact_lock(9183276)");
    const values = (
      await c.query<{ patch: string }>(
        "SELECT DISTINCT patch FROM oracle_archive_games WHERE patch IS NOT NULL",
      )
    ).rows.map((r) => r.patch);
    await recordSources(c, "oracle", values, now);
    await resolveSources(c);
  });
}

export async function listPatches(db: Executor): Promise<CatalogPatch[]> {
  const result = await db.query<{
    patch_key: string;
    release_order: number;
    ddragon_versions: string[];
    sources: { source: PatchSource; value: string }[];
    observed_at: Date;
  }>(
    `SELECT p.patch_key,p.release_order,p.ddragon_versions,p.observed_at,
       coalesce(jsonb_agg(jsonb_build_object('source',s.source,'value',s.source_string)
         ORDER BY s.source,s.source_string) FILTER(WHERE s.source IS NOT NULL),'[]') sources
     FROM patches p LEFT JOIN patch_sources s ON s.patch_key=p.patch_key
     GROUP BY p.patch_key ORDER BY p.release_order DESC`,
  );
  return result.rows.map((r) => ({
    key: r.patch_key,
    releaseOrder: r.release_order,
    ddragonVersions: r.ddragon_versions,
    sourceStrings: r.sources,
    observedAt: r.observed_at.toISOString(),
  }));
}

/** The catalog patch a source string maps to, or null when it is unknown or unparseable. */
export async function patchFor(db: Executor, source: PatchSource, value: string) {
  const result = await db.query<{ patch_key: string | null }>(
    "SELECT patch_key FROM patch_sources WHERE source=$1 AND source_string=$2",
    [source, value],
  );
  return result.rows[0]?.patch_key ?? null;
}

export async function unresolvedPatches(db: Executor): Promise<UnresolvedPatch[]> {
  const result = await db.query<{ source: PatchSource; source_string: string }>(
    "SELECT source,source_string FROM patch_sources WHERE patch_key IS NULL ORDER BY source,source_string",
  );
  return result.rows.map((r) => ({
    source: r.source,
    value: r.source_string,
    reason: normalizePatch(r.source_string) ? "unknown" : "unparseable",
  }));
}

/**
 * Records one source patch string as received and returns its catalog patch, or null when it is
 * unparseable or not in the catalog; such strings appear in unresolvedPatches.
 */
export async function linkPatchString(db: Executor, source: PatchSource, value: string, now: Date) {
  const key = normalizePatch(value)?.key ?? null;
  const known = key
    ? Boolean((await db.query("SELECT 1 FROM patches WHERE patch_key=$1", [key])).rowCount)
    : false;
  const patchKey = known ? key : null;
  await db.query(
    `INSERT INTO patch_sources(source,source_string,patch_key,first_seen_at,last_seen_at)
     VALUES($1,$2,$3,$4,$4) ON CONFLICT(source,source_string)
     DO UPDATE SET patch_key=EXCLUDED.patch_key,last_seen_at=EXCLUDED.last_seen_at`,
    [source, value, patchKey, now],
  );
  return patchKey;
}
