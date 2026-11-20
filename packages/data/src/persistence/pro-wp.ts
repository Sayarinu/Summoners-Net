import type { Pool } from "pg";
import {
  checkpointFeatureVersion,
  checkpointFeatures,
  checkpointModelVersion,
  checkpointsFrom,
  coveredMinutes,
  gamePhases,
  phaseOf,
  reportedMinutes,
  vectorizeCheckpoint,
  type Checkpoint,
} from "../domain/wp-checkpoints.js";
import { evaluate, predict, splitByMatch, train, type Example } from "../domain/wp-model.js";
import { transaction, type Executor } from "./database.js";
import { activeWinProbabilityModel, type ModelEvaluation } from "./wp-models.js";

/** A game's checkpoints by minute: the reported ones, replaced by recorded frames where present. */
function gameCheckpoints(statistics: Record<string, unknown> | null, frames: Checkpoint[] | null) {
  const checkpoints = new Map(
    (statistics ? checkpointsFrom(statistics) : []).map((checkpoint) => [
      checkpoint.minute,
      checkpoint,
    ]),
  );
  for (const frame of frames ?? []) checkpoints.set(frame.minute, frame);
  return [...checkpoints.values()].sort((a, b) => a.minute - b.minute);
}

/**
 * Trains the pro checkpoint model on blue team rows of summary-eligible games from the two
 * newest archive years, split by whole game: the reported checkpoints, and every recorded minute
 * of games with a frame timeline once at least minimumFrameGames training games have one (with
 * fewer, recorded minutes are left out). It covers the reported minutes, widened to neighbouring
 * minutes that at least minimumGamesPerMinute games reach.
 *
 * Published only with at least minimumGames training games, and never to replace an active model
 * trained on timelines with one that is not; otherwise stored as rejected and the active model stays.
 */
export async function trainCheckpointModel(
  pool: Pool,
  now: Date,
  options: {
    minimumGames: number;
    minimumGamesPerMinute: number;
    minimumFrameGames: number;
    seed: number;
  },
) {
  const rows = await pool.query<{
    game_id: string;
    year: number;
    result: boolean;
    statistics: Record<string, unknown>;
    frames: Checkpoint[] | null;
  }>(
    `SELECT p.game_id,g.archive_year AS year,p.result,p.statistics,
       detail.document->'checkpoints' AS frames
     FROM oracle_archive_participants p JOIN oracle_archive_games g ON g.id=p.game_id
     LEFT JOIN pro_game_details detail ON detail.source_game_id=g.source_game_id
     WHERE p.position='team' AND p.side='blue' AND p.result IS NOT NULL AND g.summary_eligible
       AND g.archive_year>=(SELECT max(archive_year)-1 FROM oracle_archive_games)
     ORDER BY p.game_id`,
  );
  const years = [...new Set(rows.rows.map((r) => String(r.year)))].sort();
  // The split is by whole game and fixed before frames are counted, so the gate never changes it.
  const split = splitByMatch(
    rows.rows.map((r) => ({ matchId: r.game_id, x: [], y: 0 })),
    options.seed,
  );
  const held = new Set(split.evaluate.map((e) => e.matchId));
  const frameGames = rows.rows.filter((r) => !held.has(r.game_id) && r.frames?.length).length;
  const useFrames = frameGames >= options.minimumFrameGames;
  const scored = rows.rows.flatMap((r) =>
    gameCheckpoints(r.statistics, useFrames ? r.frames : null).flatMap((c) => {
      const x = vectorizeCheckpoint(c);
      return x ? [{ minute: c.minute, matchId: r.game_id, x, y: r.result ? 1 : 0 } as const] : [];
    }),
  );
  const gamesByMinute = new Map<number, number>();
  for (const { minute } of scored) gamesByMinute.set(minute, (gamesByMinute.get(minute) ?? 0) + 1);
  const minutes = coveredMinutes(gamesByMinute, options.minimumGamesPerMinute);
  const covered = scored.filter(({ minute }) => minute >= minutes.first && minute <= minutes.last);
  const training: Example[] = covered.filter((e) => !held.has(e.matchId));
  const evaluation = covered.filter((e) => held.has(e.matchId));
  const games = (list: readonly { matchId: string }[]) => new Set(list.map((e) => e.matchId)).size;
  const trainGames = games(training);
  const model = train(training);
  const result = evaluate(model, evaluation);
  const evaluated: ModelEvaluation = {
    logLoss: result.logLoss,
    phases: gamePhases.flatMap(({ phase, label }) => {
      const rows = evaluation.filter((e) => phaseOf(e.minute) === phase);
      if (!rows.length) return [];
      const phaseResult = evaluate(model, rows);
      return [
        {
          phase,
          label,
          games: games(rows),
          states: rows.length,
          brier: phaseResult.brier,
          logLoss: phaseResult.logLoss,
          bins: phaseResult.bins,
        },
      ];
    }),
  };
  const active = await activeWinProbabilityModel(pool, "pro-checkpoints");
  const activeUsesFrames = active?.coefficients.framesUsed ?? false;
  const reason =
    trainGames < options.minimumGames
      ? `Only ${trainGames} training games; at least ${options.minimumGames} are needed.`
      : activeUsesFrames && !useFrames
        ? `Only ${frameGames} training games have a timeline; at least ${options.minimumFrameGames} are needed to replace a model trained on timelines.`
        : null;
  return transaction(pool, async (c) => {
    if (!reason)
      await c.query(
        "UPDATE wp_models SET status='retired' WHERE status='active' AND kind='pro-checkpoints'",
      );
    const inserted = await c.query<{ id: string }>(
      `INSERT INTO wp_models(kind,model_version,feature_version,patch_window,seed,train_matches,
         train_rows,eval_matches,eval_rows,coefficients,brier,bins,evaluation,status,reason,trained_at)
       VALUES('pro-checkpoints',$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       RETURNING id::text`,
      [
        checkpointModelVersion,
        checkpointFeatureVersion,
        years,
        options.seed,
        trainGames,
        training.length,
        games(evaluation),
        evaluation.length,
        JSON.stringify({
          ...model,
          features: checkpointFeatures,
          minutes,
          framesUsed: useFrames,
          frameGames,
        }),
        result.brier,
        JSON.stringify(result.bins),
        JSON.stringify(evaluated),
        reason ? "rejected" : "active",
        reason,
        now,
      ],
    );
    return { id: Number(inserted.rows[0]!.id), active: !reason };
  });
}

export interface ProGameWinProbability {
  model: { id: number; modelVersion: number; brier: number | null; years: string[] } | null;
  reason: string | null;
  /** Estimated minutes in the model's covered range, with null for unavailable checkpoints. */
  points: { minute: number; blueWinProbability: number | null }[];
}
/** Blue-side estimates from recorded game states within the minutes the model covers. */
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
  if (!model)
    return { model: null, reason: "No pro win probability model is active yet.", points: [] };
  const { first, last } = model.coefficients.minutes ?? reportedMinutes;
  const points = gameCheckpoints(row?.statistics ?? null, row?.frames ?? null)
    .filter(({ minute }) => minute >= first && minute <= last)
    .map((c) => {
      const x = vectorizeCheckpoint(c, model.coefficients.features);
      return { minute: c.minute, blueWinProbability: x ? predict(model.coefficients, x) : null };
    });
  if (!points.some((p) => p.blueWinProbability !== null))
    return { model: meta, reason: "This game has no checkpoint data to score.", points: [] };
  return { model: meta, reason: null, points };
}
