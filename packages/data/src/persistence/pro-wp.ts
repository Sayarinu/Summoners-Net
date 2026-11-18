import type { Pool } from "pg";
import {
  checkpointFeatures,
  checkpointModelVersion,
  checkpointsFrom,
  vectorizeCheckpoint,
  type Checkpoint,
} from "../domain/wp-checkpoints.js";
import { evaluate, predict, splitByMatch, train, type Example } from "../domain/wp-model.js";
import { transaction, type Executor } from "./database.js";
import { activeWinProbabilityModel } from "./wp-models.js";

/**
 * Trains the pro checkpoint model on blue team rows of summary-eligible games from the two
 * newest archive years, split by game. Published only with at least minimumGames training games;
 * otherwise stored as rejected and the active checkpoint model stays.
 */
export async function trainCheckpointModel(
  pool: Pool,
  now: Date,
  options: { minimumGames: number; seed: number },
) {
  const rows = await pool.query<{
    game_id: string;
    year: number;
    result: boolean;
    statistics: Record<string, unknown>;
  }>(
    `SELECT p.game_id,g.archive_year AS year,p.result,p.statistics
     FROM oracle_archive_participants p JOIN oracle_archive_games g ON g.id=p.game_id
     WHERE p.position='team' AND p.side='blue' AND p.result IS NOT NULL AND g.summary_eligible
       AND g.archive_year>=(SELECT max(archive_year)-1 FROM oracle_archive_games)
     ORDER BY p.game_id`,
  );
  const years = [...new Set(rows.rows.map((r) => String(r.year)))].sort();
  const examples = rows.rows.flatMap((r): Example[] =>
    checkpointsFrom(r.statistics).flatMap((c) => {
      const x = vectorizeCheckpoint(c);
      return x ? [{ matchId: r.game_id, x, y: r.result ? 1 : 0 }] : [];
    }),
  );
  const split = splitByMatch(examples, options.seed);
  const games = (list: Example[]) => new Set(list.map((e) => e.matchId)).size;
  const trainGames = games(split.train);
  const enough = trainGames >= options.minimumGames;
  const model = train(split.train);
  const result = evaluate(model, split.evaluate);
  return transaction(pool, async (c) => {
    if (enough)
      await c.query(
        "UPDATE wp_models SET status='retired' WHERE status='active' AND kind='pro-checkpoints'",
      );
    const inserted = await c.query<{ id: string }>(
      `INSERT INTO wp_models(kind,model_version,feature_version,patch_window,seed,train_matches,
         train_rows,eval_matches,eval_rows,coefficients,brier,bins,status,reason,trained_at)
       VALUES('pro-checkpoints',$1,1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id::text`,
      [
        checkpointModelVersion,
        years,
        options.seed,
        trainGames,
        split.train.length,
        games(split.evaluate),
        split.evaluate.length,
        JSON.stringify({ ...model, features: checkpointFeatures.map((f) => f.name) }),
        result.brier,
        JSON.stringify(result.bins),
        enough ? "active" : "rejected",
        enough
          ? null
          : `Only ${trainGames} training games; at least ${options.minimumGames} are needed.`,
        now,
      ],
    );
    return { id: Number(inserted.rows[0]!.id), active: enough };
  });
}

export interface ProGameWinProbability {
  model: { id: number; modelVersion: number; brier: number | null; years: string[] } | null;
  reason: string | null;
  /** Estimated minutes in the supported range, with null for unavailable checkpoints. */
  points: { minute: number; blueWinProbability: number | null }[];
}
/** Blue-side estimates from recorded game states within the checkpoint model's training range. */
export async function proGameWinProbability(
  db: Executor,
  gameId: string,
): Promise<ProGameWinProbability> {
  const row = (
    await db.query<{ statistics: Record<string, unknown>; frames: Checkpoint[] | null }>(
      `SELECT p.statistics,detail.document->'checkpoints' AS frames FROM games g
       JOIN oracle_archive_participants p ON p.game_id=g.archive_game_id
       JOIN oracle_archive_games archive ON archive.id=g.archive_game_id
       LEFT JOIN pro_game_details detail ON detail.source_game_id=archive.source_game_id
       WHERE (g.id=$1 OR ($1 LIKE 'oracle:game:%' AND g.source_id=substring($1 from 13)))
         AND p.position='team' AND p.side='blue'
       ORDER BY (g.id=$1) DESC LIMIT 1`,
      [gameId],
    )
  ).rows[0];
  const model = await activeWinProbabilityModel(db, "pro-checkpoints");
  const meta = model
    ? {
        id: model.id,
        modelVersion: model.modelVersion,
        brier: model.brier,
        years: model.patchWindow,
      }
    : null;
  const checkpoints = new Map(
    (row ? checkpointsFrom(row.statistics) : []).map((checkpoint) => [
      checkpoint.minute,
      checkpoint,
    ]),
  );
  for (const frame of row?.frames ?? []) checkpoints.set(frame.minute, frame);
  if (!model)
    return { model: null, reason: "No pro win probability model is active yet.", points: [] };
  const points = [...checkpoints.values()]
    .sort((a, b) => a.minute - b.minute)
    .map((c) => {
      const x = vectorizeCheckpoint(c);
      return { minute: c.minute, blueWinProbability: x ? predict(model.coefficients, x) : null };
    });
  if (!points.some((p) => p.blueWinProbability !== null))
    return { model: meta, reason: "This game has no checkpoint data to score.", points: [] };
  return { model: meta, reason: null, points };
}
