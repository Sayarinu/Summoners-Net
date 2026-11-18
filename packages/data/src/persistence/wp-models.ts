import type { Pool } from "pg";
import { featureVersion, type FeatureRow } from "../domain/wp-features.js";
import {
  evaluate,
  modelFeatures,
  modelVersion,
  splitByMatch,
  trainingMatchesFrom,
  train,
  vectorize,
  type Coefficients,
  type Example,
  type ReliabilityBin,
} from "../domain/wp-model.js";
import { transaction, type Executor } from "./database.js";

export type ModelKind = "timeline" | "pro-checkpoints" | "draft";
export interface WinProbabilityModel {
  id: number;
  kind: ModelKind;
  modelVersion: number;
  featureVersion: number;
  patchWindow: string[];
  seed: number;
  trainMatches: number;
  trainRows: number;
  evalMatches: number;
  evalRows: number;
  /** `minutes`: the game minutes a pro checkpoint model covers; absent before version 2. */
  coefficients: Coefficients & { features: string[]; minutes?: { first: number; last: number } };
  brier: number | null;
  bins: ReliabilityBin[];
  status: "active" | "retired" | "rejected";
  reason: string | null;
  trainedAt: string;
}

/** The kept solo-queue patches, or else the newest three with features. */
export async function trainingWindow(db: Executor) {
  const kept =
    (await db.query<{ kept_patches: string[] }>("SELECT kept_patches FROM riot_retention")).rows[0]
      ?.kept_patches ?? [];
  if (kept.length) return kept;
  return (
    await db.query<{ patch_key: string }>(
      `SELECT DISTINCT m.patch_key,p.release_order FROM riot_wp_features f
       JOIN riot_matches m USING (match_id) JOIN patches p ON p.patch_key=m.patch_key
       WHERE f.version=$1 ORDER BY p.release_order DESC LIMIT 3`,
      [featureVersion],
    )
  ).rows.map((r) => r.patch_key);
}

export interface FeatureDbRow {
  match_id: string;
  minute: number;
  timestamp_ms: number;
  gold_diff: number | null;
  xp_diff: number | null;
  cs_diff: number | null;
  blue_kills: number;
  red_kills: number;
  blue_towers: number;
  red_towers: number;
  blue_inhibitors: number;
  red_inhibitors: number;
  blue_barons: number;
  red_barons: number;
  blue_elders: number;
  red_elders: number;
  blue_dragons: FeatureRow["blue"]["dragons"];
  red_dragons: FeatureRow["red"]["dragons"];
  blue_soul: boolean;
  red_soul: boolean;
  blue_win: boolean | null;
}
/** A stored feature row as the domain's FeatureRow, shared by training and scoring. */
export function featureRowFromDb(r: FeatureDbRow): FeatureRow {
  const team = (side: "blue" | "red") => ({
    kills: r[`${side}_kills`],
    towers: r[`${side}_towers`],
    inhibitors: r[`${side}_inhibitors`],
    barons: r[`${side}_barons`],
    elders: r[`${side}_elders`],
    dragons: r[`${side}_dragons`],
    soul: r[`${side}_soul`],
  });
  return {
    minute: r.minute,
    timestampMs: r.timestamp_ms,
    goldDiff: r.gold_diff,
    xpDiff: r.xp_diff,
    csDiff: r.cs_diff,
    blue: team("blue"),
    red: team("red"),
    blueWin: r.blue_win,
  };
}
async function examples(db: Executor, window: readonly string[]): Promise<Example[]> {
  const rows = await db.query<FeatureDbRow & { blue_win: boolean }>(
    `SELECT f.* FROM riot_wp_features f JOIN riot_matches m USING (match_id)
     WHERE f.version=$1 AND m.patch_key=ANY($2::text[]) AND f.blue_win IS NOT NULL
       AND m.remake IS NOT TRUE
     ORDER BY f.match_id,f.minute`,
    [featureVersion, window],
  );
  return rows.rows.flatMap((r): Example[] => {
    const x = vectorize(featureRowFromDb(r));
    return x ? [{ matchId: r.match_id, x, y: r.blue_win ? 1 : 0 }] : [];
  });
}

/**
 * Whether the first solo-queue model should be trained now: none is active, the stored sample
 * would give at least minimumMatches training matches, and the sample has grown since the last
 * attempt (so a rejected attempt is not repeated on the same games).
 */
export async function firstTrainingDue(db: Executor, minimumMatches: number) {
  if (await activeWinProbabilityModel(db)) return false;
  const window = await trainingWindow(db);
  const sample = Number(
    (
      await db.query<{ n: string }>(
        `SELECT count(DISTINCT f.match_id) AS n FROM riot_wp_features f JOIN riot_matches m USING (match_id)
         WHERE f.version=$1 AND m.patch_key=ANY($2::text[]) AND f.blue_win IS NOT NULL
           AND m.remake IS NOT TRUE AND f.gold_diff IS NOT NULL AND f.xp_diff IS NOT NULL
           AND f.cs_diff IS NOT NULL`,
        [featureVersion, window],
      )
    ).rows[0]!.n,
  );
  if (trainingMatchesFrom(sample) < minimumMatches) return false;
  const last = (
    await db.query<{ n: number }>(
      `SELECT train_matches+eval_matches AS n FROM wp_models WHERE kind='timeline'
       ORDER BY id DESC LIMIT 1`,
    )
  ).rows[0];
  return !last || last.n < sample;
}
/**
 * Trains a model on the current patch window and stores it. With fewer than minimumMatches
 * training matches it is stored as rejected and the active model stays; otherwise it becomes
 * the active model.
 */
export async function trainWinProbabilityModel(
  pool: Pool,
  now: Date,
  options: { minimumMatches: number; seed: number },
) {
  const window = await trainingWindow(pool);
  const data = await examples(pool, window);
  const split = splitByMatch(data, options.seed);
  const matches = (rows: Example[]) => new Set(rows.map((e) => e.matchId)).size;
  const trainMatches = matches(split.train);
  const enough = trainMatches >= options.minimumMatches;
  const model = train(split.train);
  const result = evaluate(model, split.evaluate);
  return transaction(pool, async (c) => {
    if (enough)
      await c.query(
        "UPDATE wp_models SET status='retired' WHERE status='active' AND kind='timeline'",
      );
    const inserted = await c.query<{ id: string }>(
      `INSERT INTO wp_models(model_version,feature_version,patch_window,seed,train_matches,
         train_rows,eval_matches,eval_rows,coefficients,brier,bins,status,reason,trained_at)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING id::text`,
      [
        modelVersion,
        featureVersion,
        window,
        options.seed,
        trainMatches,
        split.train.length,
        matches(split.evaluate),
        split.evaluate.length,
        JSON.stringify({ ...model, features: modelFeatures.map((f) => f.name) }),
        result.brier,
        JSON.stringify(result.bins),
        enough ? "active" : "rejected",
        enough
          ? null
          : `Only ${trainMatches} training matches; at least ${options.minimumMatches} are needed.`,
        now,
      ],
    );
    return { id: Number(inserted.rows[0]!.id), active: enough };
  });
}

const fromRow = (r: Record<string, unknown>): WinProbabilityModel => ({
  id: Number(r.id),
  kind: r.kind as ModelKind,
  modelVersion: r.model_version as number,
  featureVersion: r.feature_version as number,
  patchWindow: r.patch_window as string[],
  seed: r.seed as number,
  trainMatches: r.train_matches as number,
  trainRows: r.train_rows as number,
  evalMatches: r.eval_matches as number,
  evalRows: r.eval_rows as number,
  coefficients: r.coefficients as WinProbabilityModel["coefficients"],
  brier: r.brier as number | null,
  bins: r.bins as ReliabilityBin[],
  status: r.status as WinProbabilityModel["status"],
  reason: r.reason as string | null,
  trainedAt: (r.trained_at as Date).toISOString(),
});
export async function activeWinProbabilityModel(db: Executor, kind: ModelKind = "timeline") {
  const row = (await db.query("SELECT * FROM wp_models WHERE status='active' AND kind=$1", [kind]))
    .rows[0] as Record<string, unknown> | undefined;
  return row ? fromRow(row) : null;
}
export async function winProbabilityModels(db: Executor, limit = 20, kind: ModelKind = "timeline") {
  return (
    (
      await db.query("SELECT * FROM wp_models WHERE kind=$2 ORDER BY id DESC LIMIT $1", [
        limit,
        kind,
      ])
    ).rows as Record<string, unknown>[]
  ).map(fromRow);
}
