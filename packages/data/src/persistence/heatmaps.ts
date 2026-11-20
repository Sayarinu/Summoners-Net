import type { PoolClient } from "pg";
import {
  cellCentre,
  heatmapBounds,
  heatmapGridSize,
  heatmapMinimumGames,
  heatmapQuerySchema,
  heatmapRoles,
  type Heatmap,
  type HeatmapQuery,
} from "../domain/heatmaps.js";
import type { Executor } from "./database.js";

const { minX, minY, maxX, maxY } = heatmapBounds;
const roles = heatmapRoles.map((r) => `'${r}'`).join(",");
/** Red side is rotated half a turn about the map centre, onto blue side's perspective. */
const normalized = (axis: "x" | "y", side: string) => {
  const [min, max] = axis === "x" ? [minX, maxX] : [minY, maxY];
  return `CASE WHEN ${side}='red' THEN ${min + max}-${axis} ELSE ${axis} END`;
};
const cell = (axis: "x" | "y") => {
  const [min, max] = axis === "x" ? [minX, maxX] : [minY, maxY];
  return `least(${heatmapGridSize - 1},floor((n${axis}-(${min}))*${heatmapGridSize}/${max - min}.0))::smallint`;
};

/**
 * Rebuilds one patch's solo-queue heatmaps inside the caller's transaction: per champion, player
 * and role, the minute frames from minute 1 (minute 0 is the fountain), deaths and kills with
 * coordinates, red side mirrored. Games count every non-remake game with a stored timeline in
 * which the subject played. Cells are written only for subjects with the minimum games.
 */
export async function rebuildHeatmaps(
  c: PoolClient,
  patchKey: string,
  now: Date,
  minimumGames = heatmapMinimumGames,
) {
  await c.query("DELETE FROM heatmap_cells WHERE patch_key=$1", [patchKey]);
  await c.query("DELETE FROM heatmap_samples WHERE patch_key=$1", [patchKey]);
  const players = `
    players AS (
      SELECT m.match_id,p.participant_id,p.side,s.subject_kind,s.subject
      FROM riot_matches m JOIN riot_match_participants p USING (match_id)
      CROSS JOIN LATERAL (VALUES ('champion',p.champion_id::text),('player',p.puuid),
        ('role',CASE WHEN p.team_position IN (${roles}) THEN p.team_position END))
        AS s(subject_kind,subject)
      WHERE m.patch_key=$1 AND m.remake IS NOT TRUE AND m.timeline_state='fetched'
        AND s.subject IS NOT NULL),
    located AS (
      SELECT pl.subject_kind,pl.subject,'position' AS kind,pl.side,f.x,f.y
      FROM players pl JOIN riot_timeline_frames f ON f.match_id=pl.match_id
        AND f.participant_id=pl.participant_id AND f.minute>=1
      UNION ALL
      SELECT pl.subject_kind,pl.subject,'death',pl.side,e.x,e.y
      FROM players pl JOIN riot_timeline_events e ON e.match_id=pl.match_id
        AND e.type='CHAMPION_KILL' AND e.victim_id=pl.participant_id
      UNION ALL
      SELECT pl.subject_kind,pl.subject,'kill',pl.side,e.x,e.y
      FROM players pl JOIN riot_timeline_events e ON e.match_id=pl.match_id
        AND e.type='CHAMPION_KILL' AND e.participant_id=pl.participant_id),
    normalized AS (
      SELECT subject_kind,subject,kind,${normalized("x", "side")} AS nx,${normalized("y", "side")} AS ny
      FROM located WHERE x IS NOT NULL AND y IS NOT NULL),
    cells AS (
      SELECT subject_kind,subject,kind,${cell("x")} AS cell_x,${cell("y")} AS cell_y
      FROM normalized WHERE nx BETWEEN ${minX} AND ${maxX} AND ny BETWEEN ${minY} AND ${maxY}),
    games AS (
      SELECT subject_kind,subject,count(DISTINCT match_id)::integer AS games
      FROM players GROUP BY 1,2)`;
  const samples = await c.query(
    `WITH ${players},
       points AS (SELECT subject_kind,subject,kind,count(*)::integer AS points FROM cells GROUP BY 1,2,3)
     INSERT INTO heatmap_samples(patch_key,subject_kind,subject,kind,games,points,built_at)
     SELECT $1,g.subject_kind,g.subject,k.kind,g.games,coalesce(p.points,0),$2
     FROM games g CROSS JOIN unnest(ARRAY['position','death','kill']) AS k(kind)
     LEFT JOIN points p ON p.subject_kind=g.subject_kind AND p.subject=g.subject AND p.kind=k.kind`,
    [patchKey, now],
  );
  const cells = await c.query(
    `WITH ${players}
     INSERT INTO heatmap_cells(patch_key,subject_kind,subject,kind,cell_x,cell_y,points)
     SELECT $1,c.subject_kind,c.subject,c.kind,c.cell_x,c.cell_y,count(*)
     FROM cells c JOIN games g USING (subject_kind,subject)
     WHERE g.games>=$2 GROUP BY 1,2,3,4,5,6`,
    [patchKey, minimumGames],
  );
  return (samples.rowCount ?? 0) + (cells.rowCount ?? 0);
}

/**
 * One subject's heatmap for a patch (the newest with a heatmap when none is given), read from
 * the aggregates only. Null when the champion is not in the catalog.
 */
export async function heatmap(db: Executor, input: HeatmapQuery): Promise<Heatmap | null> {
  const q = heatmapQuerySchema.parse(input);
  let subject = q.subject;
  let label: string | null = null;
  if (q.subjectKind === "champion") {
    const champion = (
      await db.query<{ champion_key: number; name: string }>(
        `SELECT c.champion_key,c.name FROM catalog_champions c JOIN patches p USING (patch_key)
         WHERE c.champion_id=$1 ORDER BY p.release_order DESC LIMIT 1`,
        [q.subject],
      )
    ).rows[0];
    if (!champion) return null;
    subject = String(champion.champion_key);
    label = champion.name;
  } else if (q.subjectKind === "role") {
    if (!(heatmapRoles as readonly string[]).includes(q.subject)) return null;
  } else {
    const account = (
      await db.query<{ game_name: string | null; tag_line: string | null }>(
        "SELECT game_name,tag_line FROM riot_accounts WHERE puuid=$1",
        [q.subject],
      )
    ).rows[0];
    label = account?.game_name
      ? `${account.game_name}${account.tag_line ? `#${account.tag_line}` : ""}`
      : null;
  }
  const patches = (
    await db.query<{ patch_key: string; games: number; points: number }>(
      `SELECT s.patch_key,s.games,s.points FROM heatmap_samples s JOIN patches p USING (patch_key)
       WHERE s.subject_kind=$1 AND s.subject=$2 AND s.kind=$3 ORDER BY p.release_order DESC`,
      [q.subjectKind, subject, q.kind],
    )
  ).rows.map((r) => ({ patch: r.patch_key, games: r.games, points: r.points }));
  const selected = q.patch ? patches.find((p) => p.patch === q.patch) : patches[0];
  const base = {
    subjectKind: q.subjectKind,
    subject: q.subject,
    label,
    kind: q.kind,
    patches,
    minimumGames: heatmapMinimumGames,
  };
  if (!selected) return { ...base, patch: q.patch ?? null, games: 0, points: 0, cells: [] };
  const cells =
    selected.games >= heatmapMinimumGames
      ? (
          await db.query<{ cell_x: number; cell_y: number; points: number }>(
            `SELECT cell_x,cell_y,points FROM heatmap_cells
             WHERE subject_kind=$1 AND subject=$2 AND kind=$3 AND patch_key=$4
             ORDER BY cell_y,cell_x`,
            [q.subjectKind, subject, q.kind, selected.patch],
          )
        ).rows.map((r) => ({
          cellX: r.cell_x,
          cellY: r.cell_y,
          ...cellCentre(r.cell_x, r.cell_y),
          points: r.points,
        }))
      : [];
  return { ...base, patch: selected.patch, games: selected.games, points: selected.points, cells };
}
