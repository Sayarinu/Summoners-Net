import { predict, vectorize } from "../domain/wp-model.js";
import { soloMatchIdSchema, type SoloGame, type SoloGameMarker } from "../domain/solo-games.js";
import type { Executor } from "./database.js";
import { activeWinProbabilityModel, featureRowFromDb, type FeatureDbRow } from "./wp-models.js";

const monsterKinds: Record<string, SoloGameMarker["kind"]> = {
  BARON_NASHOR: "baron",
  RIFTHERALD: "herald",
  HORDE: "voidgrubs",
};
const title = (text: string) =>
  text
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

/**
 * A solo-queue game with blue side's win probability per minute, scored here with the active
 * model, and markers for kills and objectives. Null when the match is not stored.
 */
export async function soloGame(db: Executor, matchId: string): Promise<SoloGame | null> {
  const id = soloMatchIdSchema.parse(matchId);
  const match = (
    await db.query<{
      patch_key: string | null;
      queue_id: number | null;
      duration_seconds: number | null;
      started_at: Date | null;
      timeline_state: string;
    }>(
      "SELECT patch_key,queue_id,duration_seconds,started_at,timeline_state FROM riot_matches WHERE match_id=$1",
      [id],
    )
  ).rows[0];
  if (!match) return null;
  const teams = (
    await db.query<{ side: "blue" | "red"; win: boolean | null }>(
      "SELECT side,win FROM riot_match_teams WHERE match_id=$1 ORDER BY team_id",
      [id],
    )
  ).rows;
  const participants = (
    await db.query<{
      participant_id: number;
      side: "blue" | "red";
      champion_id: number;
      team_position: string | null;
      kills: number | null;
      deaths: number | null;
      assists: number | null;
      catalog_id: string | null;
      name: string | null;
    }>(
      `SELECT p.participant_id,p.side,p.champion_id,p.team_position,p.kills,p.deaths,p.assists,
         c.champion_id AS catalog_id,c.name
       FROM riot_match_participants p
       LEFT JOIN LATERAL (SELECT c.champion_id,c.name FROM catalog_champions c
         JOIN patches pa USING (patch_key) WHERE c.champion_key=p.champion_id
         ORDER BY (c.patch_key=$2) DESC,pa.release_order DESC LIMIT 1) c ON true
       WHERE p.match_id=$1 ORDER BY p.participant_id`,
      [id, match.patch_key],
    )
  ).rows;
  const sideOf = new Map(participants.map((p) => [p.participant_id, p.side]));
  const opposite = (side: "blue" | "red" | undefined) =>
    side === "blue" ? "red" : side === "red" ? "blue" : null;
  const teamSide = (team: number | null) => (team === 100 ? "blue" : team === 200 ? "red" : null);
  const events = (
    await db.query<{
      seq: number;
      type: string;
      timestamp_ms: number;
      victim_id: number | null;
      team_id: number | null;
      monster_type: string | null;
      monster_sub_type: string | null;
      building_type: string | null;
    }>(
      `SELECT seq,type,timestamp_ms,victim_id,team_id,monster_type,monster_sub_type,building_type
       FROM riot_timeline_events WHERE match_id=$1
         AND type IN ('CHAMPION_KILL','ELITE_MONSTER_KILL','BUILDING_KILL') ORDER BY seq`,
      [id],
    )
  ).rows;
  const markers = events.map((e): SoloGameMarker => {
    const minute = Math.floor(e.timestamp_ms / 60000);
    const base = { id: `${id}:${e.seq}`, minute, timestampMs: e.timestamp_ms };
    if (e.type === "CHAMPION_KILL") {
      const team = opposite(e.victim_id === null ? undefined : sideOf.get(e.victim_id));
      return { ...base, team, kind: "kill", label: `${team ? title(team) : "Unknown"} kill` };
    }
    if (e.type === "BUILDING_KILL") {
      // A building event names the team that owned it.
      const team = opposite(teamSide(e.team_id) ?? undefined);
      const kind = e.building_type === "INHIBITOR_BUILDING" ? "inhibitor" : "tower";
      return { ...base, team, kind, label: `${team ? title(team) : "Unknown"} takes a ${kind}` };
    }
    const team = teamSide(e.team_id);
    const kind =
      e.monster_type === "DRAGON"
        ? e.monster_sub_type === "ELDER_DRAGON"
          ? "elder"
          : "dragon"
        : (monsterKinds[e.monster_type ?? ""] ?? "other");
    const name = e.monster_sub_type
      ? title(e.monster_sub_type)
      : title(e.monster_type ?? "monster");
    return { ...base, team, kind, label: `${team ? title(team) : "Unknown"}: ${name}` };
  });
  const model = await activeWinProbabilityModel(db);
  const features = model
    ? (
        await db.query<FeatureDbRow>(
          "SELECT * FROM riot_wp_features WHERE match_id=$1 AND version=$2 ORDER BY minute",
          [id, model.featureVersion],
        )
      ).rows
    : [];
  const byMinute = new Map(features.map((f) => [f.minute, f]));
  const lastMinute = Math.max(
    -1,
    ...features.map((f) => f.minute),
    match.duration_seconds === null ? -1 : Math.floor(match.duration_seconds / 60),
  );
  const reason = !model
    ? "No win probability model is active yet. One is published once enough games with timelines are stored."
    : match.timeline_state !== "fetched"
      ? "This game's timeline has not been stored, so there is no minute-by-minute state to score."
      : !features.length
        ? "Features for this game have not been computed yet; they are built with the next aggregation."
        : null;
  return {
    matchId: id,
    patch: match.patch_key,
    queueId: match.queue_id,
    durationSeconds: match.duration_seconds,
    startedAt: match.started_at?.toISOString() ?? null,
    teams,
    participants: participants.map((p) => ({
      participantId: p.participant_id,
      side: p.side,
      championKey: p.champion_id,
      championId: p.catalog_id,
      championName: p.name,
      role: p.team_position,
      kills: p.kills,
      deaths: p.deaths,
      assists: p.assists,
    })),
    winProbability: {
      model: model
        ? {
            id: model.id,
            modelVersion: model.modelVersion,
            featureVersion: model.featureVersion,
            brier: model.brier,
            trainedAt: model.trainedAt,
          }
        : null,
      reason,
      points:
        model && features.length
          ? Array.from({ length: lastMinute + 1 }, (_, minute) => {
              const row = byMinute.get(minute);
              const x = row ? vectorize(featureRowFromDb(row)) : null;
              return { minute, blueWinProbability: x ? predict(model.coefficients, x) : null };
            })
          : [],
      markers,
    },
  };
}
