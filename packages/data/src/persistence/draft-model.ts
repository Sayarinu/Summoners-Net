import type { Pool } from "pg";
import {
  draftFeatureValues,
  draftFeatureVersion,
  draftFeatures,
  draftModelVersion,
  trainingCounts,
  type Counts,
  type DraftGame,
  type DraftLookup,
  type DraftRole,
  type DraftSlot,
  type DraftTeams,
  type DraftWinProbability,
} from "../domain/draft-model.js";
import { matchupRoles } from "../domain/matchups.js";
import { evaluate, predict, splitByMatch, train, type Example } from "../domain/wp-model.js";
import { transaction, type Executor } from "./database.js";
import { activeWinProbabilityModel, trainingWindow } from "./wp-models.js";

const roles = new Set<string>(matchupRoles);
/** Ranked solo games in the window where each team has exactly one champion in each role. */
async function draftGames(db: Executor, window: string[]): Promise<DraftGame[]> {
  const rows = (
    await db.query<{
      match_id: string;
      patch_key: string;
      team_id: number;
      team_position: string | null;
      champion_id: number;
      win: boolean | null;
    }>(
      `SELECT m.match_id,m.patch_key,p.team_id,p.team_position,p.champion_id,p.win
       FROM riot_matches m JOIN riot_match_participants p USING (match_id)
       WHERE m.patch_key=ANY($1::text[]) AND m.queue_id=420 AND m.remake IS NOT TRUE
       ORDER BY m.match_id,p.participant_id`,
      [window],
    )
  ).rows;
  const games = new Map<string, typeof rows>();
  for (const r of rows) games.set(r.match_id, [...(games.get(r.match_id) ?? []), r]);
  return [...games].flatMap(([matchId, players]): DraftGame[] => {
    const side = (team: number) =>
      players
        .filter((p) => p.team_id === team && p.team_position && roles.has(p.team_position))
        .map((p) => ({ championKey: p.champion_id, role: p.team_position as DraftRole }));
    const blue = side(100),
      red = side(200);
    const blueWin = players.find((p) => p.team_id === 100)?.win;
    const full = (t: DraftSlot[]) => t.length === 5 && new Set(t.map((s) => s.role)).size === 5;
    return players.length === 10 && full(blue) && full(red) && typeof blueWin === "boolean"
      ? [{ matchId, patch: players[0]!.patch_key, teams: { blue, red }, blueWin }]
      : [];
  });
}

/**
 * Trains the draft model on the solo-queue window. After the split by match, counts come from
 * training games only: training games leave out their own result, held-out games are scored
 * against counts they never contributed to. Published with at least minimumGames training
 * games; otherwise stored as rejected and the active draft model stays.
 */
export async function trainDraftModel(
  pool: Pool,
  now: Date,
  options: { minimumGames: number; seed: number },
) {
  const window = await trainingWindow(pool);
  const games = await draftGames(pool, window);
  const split = splitByMatch(
    games.map((g) => ({ matchId: g.matchId, x: [], y: Number(g.blueWin) as 0 | 1 })),
    options.seed,
  );
  const held = new Set(split.evaluate.map((e) => e.matchId));
  const trainGames = games.filter((g) => !held.has(g.matchId));
  const counts = trainingCounts(trainGames);
  const example = (g: DraftGame, leaveOut: boolean): Example => ({
    matchId: g.matchId,
    x: draftFeatureValues(g.teams, counts.lookupFor(g, leaveOut)).x,
    y: g.blueWin ? 1 : 0,
  });
  const training = trainGames.map((g) => example(g, true));
  const evaluation = games.filter((g) => held.has(g.matchId)).map((g) => example(g, false));
  const enough = training.length >= options.minimumGames;
  const model = train(training);
  const result = evaluate(model, evaluation);
  return transaction(pool, async (c) => {
    if (enough)
      await c.query("UPDATE wp_models SET status='retired' WHERE status='active' AND kind='draft'");
    const inserted = await c.query<{ id: string }>(
      `INSERT INTO wp_models(kind,model_version,feature_version,patch_window,seed,train_matches,
         train_rows,eval_matches,eval_rows,coefficients,brier,bins,status,reason,trained_at)
       VALUES('draft',$1,$2,$3,$4,$5,$5,$6,$6,$7,$8,$9,$10,$11,$12) RETURNING id::text`,
      [
        draftModelVersion,
        draftFeatureVersion,
        window,
        options.seed,
        training.length,
        evaluation.length,
        JSON.stringify({ ...model, features: draftFeatures.map((f) => f.name) }),
        result.brier,
        JSON.stringify(result.bins),
        enough ? "active" : "rejected",
        enough
          ? null
          : `Only ${training.length} training games; at least ${options.minimumGames} are needed.`,
        now,
      ],
    );
    return { id: Number(inserted.rows[0]!.id), active: enough };
  });
}

/**
 * Stored solo-queue aggregates for one patch, for the champions and roles in `everyone`. Lanes
 * (in both directions) and duos are read only against `partners`, the picked champions, and only
 * in the roles involved, which keeps the reads bounded.
 */
export async function storedDraftLookup(
  db: Executor,
  patch: string,
  everyone: readonly DraftSlot[],
  partners: readonly DraftSlot[],
): Promise<DraftLookup> {
  const row = (
    await db.query<{
      strength: { k: number; r: string; wins: number; games: number }[];
      lanes: { k: number; o: number; r: string; wins: number | null; games: number }[];
      baselines: { k: number; r: string; wins: number | null; games: number }[];
      duos: { k: number; r: string; a: number; ar: string; wins: number; games: number }[];
    }>(
      `SELECT
        coalesce((SELECT jsonb_agg(s) FROM (
          SELECT champion_key AS k,role AS r,sum(wins)::integer AS wins,sum(result_games)::integer AS games
          FROM champion_aggregates WHERE source='solo' AND patch_key=$1 AND role=ANY($4::text[]) AND champion_key=ANY($2::integer[])
          GROUP BY champion_key,role) s),'[]') AS strength,
        coalesce((SELECT jsonb_agg(l) FROM (
          SELECT champion_key AS k,opponent_key AS o,role AS r,(metrics->'winRate'->>'total')::double precision AS wins,
            (metrics->'winRate'->>'count')::integer AS games
          FROM matchup_aggregates WHERE source='solo' AND patch_key=$1 AND role=ANY($5::text[])
            AND champion_key=ANY($2::integer[]) AND opponent_key=ANY($3::integer[])
          UNION
          SELECT champion_key,opponent_key,role,(metrics->'winRate'->>'total')::double precision,
            (metrics->'winRate'->>'count')::integer
          FROM matchup_aggregates WHERE source='solo' AND patch_key=$1 AND role=ANY($5::text[])
            AND champion_key=ANY($3::integer[]) AND opponent_key=ANY($2::integer[])) l),'[]') AS lanes,
        coalesce((SELECT jsonb_agg(b) FROM (
          SELECT champion_key AS k,role AS r,win_total AS wins,win_count AS games FROM blindability_scores
          WHERE source='solo' AND patch_key=$1 AND role=ANY($4::text[]) AND champion_key=ANY($2::integer[])) b),'[]') AS baselines,
        coalesce((SELECT jsonb_agg(d) FROM (
          SELECT champion_key AS k,role AS r,ally_key AS a,ally_role AS ar,sum(wins)::integer AS wins,
            sum(result_games)::integer AS games
          FROM champion_duos WHERE patch_key=$1 AND role=ANY($4::text[]) AND ally_role=ANY($5::text[])
            AND champion_key=ANY($2::integer[]) AND ally_key=ANY($3::integer[])
          GROUP BY champion_key,role,ally_key,ally_role) d),'[]') AS duos`,
      [
        patch,
        [...new Set(everyone.map((s) => s.championKey))],
        [...new Set(partners.map((s) => s.championKey))],
        [...new Set(everyone.map((s) => s.role))],
        [...new Set(partners.map((s) => s.role))],
      ],
    )
  ).rows[0]!;
  const counts = (wins: number | null, games: number): Counts | null =>
    wins === null || games <= 0 ? null : { wins, games };
  const strength = new Map(row.strength.map((s) => [`${s.k}|${s.r}`, counts(s.wins, s.games)]));
  const lanes = new Map(row.lanes.map((l) => [`${l.k}|${l.o}|${l.r}`, counts(l.wins, l.games)]));
  const baselines = new Map(row.baselines.map((b) => [`${b.k}|${b.r}`, counts(b.wins, b.games)]));
  const duos = new Map(
    row.duos.map((d) => [`${d.k}|${d.r}|${d.a}|${d.ar}`, counts(d.wins, d.games)]),
  );
  return {
    strength: (k, r) => strength.get(`${k}|${r}`) ?? null,
    lane: (k, o, r) => lanes.get(`${k}|${o}|${r}`) ?? null,
    laneBaseline: (k, r) => baselines.get(`${k}|${r}`) ?? null,
    duo: (a, b) =>
      duos.get(`${a.championKey}|${a.role}|${b.championKey}|${b.role}`) ??
      duos.get(`${b.championKey}|${b.role}|${a.championKey}|${a.role}`) ??
      null,
  };
}

/** Scores a draft with the active draft model; the reason explains a missing probability. */
export async function scoreDraft(
  db: Executor,
  patch: string | null,
  teams: DraftTeams,
  lookup?: DraftLookup,
): Promise<DraftWinProbability> {
  const model = await activeWinProbabilityModel(db, "draft");
  const meta = model
    ? {
        id: model.id,
        modelVersion: model.modelVersion,
        brier: model.brier,
        evalGames: model.evalMatches,
        patches: model.patchWindow,
      }
    : null;
  const empty = {
    blueWinProbability: null,
    inputs: [],
    coverage: {
      strength: { known: 0, total: 0 },
      lane: { known: 0, total: 0 },
      synergy: { known: 0, total: 0 },
    },
  };
  if (!model) return { model: null, reason: "No draft model is active yet.", ...empty };
  if (!patch) return { model: meta, reason: "The game's patch is unknown.", ...empty };
  const slots = [...teams.blue, ...teams.red];
  const features = draftFeatureValues(
    teams,
    lookup ?? (await storedDraftLookup(db, patch, slots, slots)),
  );
  return {
    model: meta,
    reason: null,
    blueWinProbability: predict(model.coefficients, features.x),
    inputs: features.inputs,
    coverage: features.coverage,
  };
}

/** The pre-game probability for a stored solo game, from its patch's aggregates. */
export async function soloDraftWinProbability(db: Executor, matchId: string) {
  const players = (
    await db.query<{
      patch_key: string | null;
      team_id: number;
      team_position: string | null;
      champion_id: number;
    }>(
      `SELECT m.patch_key,p.team_id,p.team_position,p.champion_id FROM riot_matches m
       JOIN riot_match_participants p USING (match_id) WHERE m.match_id=$1 ORDER BY p.participant_id`,
      [matchId],
    )
  ).rows;
  if (!players.length) return null;
  // A role held by two players on one side is ambiguous, so neither of them counts.
  const side = (team: number) => {
    const slots = players.flatMap((p) =>
      p.team_id === team && p.team_position && roles.has(p.team_position)
        ? [{ championKey: p.champion_id, role: p.team_position as DraftRole }]
        : [],
    );
    return slots.filter((s) => slots.filter((o) => o.role === s.role).length === 1);
  };
  return scoreDraft(db, players[0]!.patch_key, { blue: side(100), red: side(200) });
}
