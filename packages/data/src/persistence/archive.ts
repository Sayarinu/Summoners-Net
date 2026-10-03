import type { Pool, PoolClient } from "pg";
import { unlink } from "node:fs/promises";
import { coveredLeague, sourceIdentity } from "../domain/coverage.js";
import { gameSchema, type Game, type Identity, type Participant } from "../domain/models.js";
import {
  streamOracleArchive,
  type ArchiveParseResult,
  type ArchiveRow,
} from "../providers/oracle-archive.js";
import { archiveDownload, archiveFileId } from "../providers/oracle.js";
import type { StagedArtifact } from "../sync/artifacts.js";
import { transaction } from "./database.js";
import { upsertGames } from "./write.js";

export interface OracleImportResult extends ArchiveParseResult {
  projectedGames: number;
}

async function stageRows(client: PoolClient, rows: ArchiveRow[]) {
  await client.query(
    `INSERT INTO staged_oracle_rows(game_id,document)
     SELECT value->>'gameId',value FROM jsonb_array_elements($1::jsonb) value`,
    [JSON.stringify(rows)],
  );
}

const identity = (row: ArchiveRow, kind: "team" | "player", fallback: string): Identity => {
  const external = kind === "team" ? row.teamSourceId : row.playerSourceId;
  return {
    id: sourceIdentity("oracle", kind, external ?? undefined, fallback),
    source: "oracle",
    sourceId: external ?? `observation:${fallback}`,
    kind,
    name: (kind === "team" ? row.teamName : row.playerName) ?? `Unknown ${kind}`,
    imageUrl: null,
    country: null,
    role: kind === "player" ? row.position : null,
  };
};

async function projectCurated(client: PoolClient): Promise<number> {
  const leagues = (
    await client.query<{ source_league: string; archive_year: number }>(
      `SELECT DISTINCT document->>'sourceLeague' AS source_league,
        (document->>'archiveYear')::integer AS archive_year FROM staged_oracle_rows`,
    )
  ).rows.filter((row) => coveredLeague(row.source_league, row.archive_year));
  if (!leagues.length) return 0;
  const covered = leagues.map((row) => row.source_league);
  let lastId = "";
  let projectedCount = 0;
  while (true) {
    const ids = (
      await client.query<{ game_id: string }>(
        `SELECT DISTINCT game_id FROM staged_oracle_rows
         WHERE game_id>$1 AND document->>'sourceLeague'=ANY($2::text[])
         ORDER BY game_id LIMIT 100`,
        [lastId, covered],
      )
    ).rows.map((row) => row.game_id);
    if (!ids.length) break;
    lastId = ids.at(-1)!;
    const records = await client.query<{ document: ArchiveRow }>(
      `SELECT document FROM staged_oracle_rows WHERE game_id=ANY($1::text[])
       ORDER BY game_id,document->>'slot'`,
      [ids],
    );
    const grouped = new Map<string, ArchiveRow[]>();
    for (const { document } of records.rows) {
      const rows = grouped.get(document.gameId) ?? [];
      rows.push(document);
      grouped.set(document.gameId, rows);
    }
    const sourceIds = [...grouped.values()].map((rows) => rows[0]!.sourceGameId);
    const existingRows = (
      await client.query<{
        id: string;
        archive_game_id: string | null;
        source_id: string;
        year: number;
        league: string;
      }>(
        `SELECT id,archive_game_id,source_id,year,league FROM games
         WHERE archive_game_id=ANY($1::text[]) OR (archive_game_id IS NULL AND source_id=ANY($2::text[]))`,
        [ids, sourceIds],
      )
    ).rows;
    const projected: { archiveId: string; game: Game }[] = [];
    for (const [archiveId, rows] of grouped) {
      const first = rows[0]!;
      const league = coveredLeague(first.sourceLeague, first.archiveYear);
      if (!league) continue;
      // A blank official team name cannot satisfy the curated identity contract.
      // Keep every row in the archive without inventing a displayed identity.
      if (rows.some((row) => !row.teamName)) continue;
      const existing =
        existingRows.find((row) => row.archive_game_id === archiveId) ??
        existingRows.find(
          (row) =>
            row.archive_game_id === null &&
            row.source_id === first.sourceGameId &&
            row.year === first.archiveYear &&
            row.league === league,
        );
      const participants: Participant[] = rows.map((row) => ({
        slot: row.slot,
        side: row.side,
        role: row.position,
        team: identity(row, "team", `${archiveId}:${row.side}`),
        player:
          row.position === "team" ? null : identity(row, "player", `${archiveId}:${row.slot}`),
        champion: row.champion,
        won: row.result,
        kills: row.kills,
        deaths: row.deaths,
        assists: row.assists,
      }));
      const playerRows = rows.filter((row) => row.position !== "team");
      const complete =
        rows.every((row) => row.declaredComplete) &&
        playerRows.length === 10 &&
        new Set(playerRows.map((row) => row.slot)).size === 10 &&
        new Set(playerRows.map((row) => row.playerSourceId ?? row.slot)).size === 10 &&
        new Set(rows.map((row) => `${row.side}:${row.teamSourceId ?? row.teamName}`)).size === 2 &&
        ["blue", "red"].every(
          (side) =>
            new Set(
              rows
                .filter((row) => row.side === side && row.result !== null)
                .map((row) => row.result),
            ).size <= 1,
        ) &&
        (() => {
          const known = rows.filter((row) => row.result !== null);
          return (
            new Set(known.map((row) => row.side)).size < 2 ||
            new Set(known.map((row) => row.result)).size === 2
          );
        })();
      const parsedNumber = Number.parseInt(first.gameNumber ?? "", 10);
      const game: Game = {
        id: existing?.id ?? archiveId,
        sourceId: first.sourceGameId,
        matchId: null,
        league,
        event: [first.sourceLeague, first.split, first.archiveYear].filter(Boolean).join(" · "),
        year: first.archiveYear,
        occurredAt: first.occurredAt,
        number: Number.isInteger(parsedNumber) && parsedNumber > 0 ? parsedNumber : 1,
        patch: first.patch,
        complete,
        participants,
      };
      gameSchema.parse(game);
      projected.push({ archiveId, game });
    }
    await upsertGames(
      client,
      projected.map((entry) => entry.game),
      false,
    );
    await client.query(
      `UPDATE games g SET archive_game_id=link.archive_id FROM
       jsonb_to_recordset($1::jsonb) AS link(id text,archive_id text)
       WHERE g.id=link.id AND g.archive_game_id IS DISTINCT FROM link.archive_id`,
      [
        JSON.stringify(
          projected.map((entry) => ({ id: entry.game.id, archive_id: entry.archiveId })),
        ),
      ],
    );
    projectedCount += projected.length;
  }
  await client.query(
    "INSERT INTO source_mappings SELECT source,kind,source_id,id FROM identities ON CONFLICT DO NOTHING",
  );
  await client.query(
    `INSERT INTO identity_aliases SELECT DISTINCT value->'team'->>'id',value->'team'->>'name' FROM games CROSS JOIN LATERAL jsonb_array_elements(document->'participants') UNION SELECT DISTINCT value->'player'->>'id',value->'player'->>'name' FROM games CROSS JOIN LATERAL jsonb_array_elements(document->'participants') WHERE value->'player'->>'id' IS NOT NULL ON CONFLICT DO NOTHING`,
  );
  return projectedCount;
}

export async function importOracleArchive(
  pool: Pool,
  artifact: StagedArtifact,
  year: number,
  importedAt: Date,
): Promise<OracleImportResult> {
  return transaction(pool, async (client) => {
    // Whole-artifact validation and merge can exceed the interactive query timeout.
    await client.query("SET LOCAL statement_timeout = '10min'");
    await client.query("SELECT pg_advisory_xact_lock(9183272)");
    await client.query(
      "CREATE TEMP TABLE staged_oracle_rows(id bigint GENERATED ALWAYS AS IDENTITY,game_id text NOT NULL,document jsonb NOT NULL) ON COMMIT DROP",
    );
    const parsed = await streamOracleArchive(artifact.path, year, (rows) =>
      stageRows(client, rows),
    );
    await client.query("CREATE INDEX staged_oracle_game_id ON staged_oracle_rows(game_id)");
    await client.query(
      `INSERT INTO oracle_archive_games(
        id,archive_year,source_league,source_game_id,occurred_at,split,playoffs,game_number,
        patch,duration_seconds,complete,summary_eligible,context,artifact_hash,updated_at)
       SELECT document->>'gameId',(document->>'archiveYear')::integer,document->>'sourceLeague',
        document->>'sourceGameId',(document->>'occurredAt')::timestamptz,document->>'split',
        (document->>'playoffs')::boolean,document->>'gameNumber',document->>'patch',
        (document->>'durationSeconds')::integer,bool_and((document->>'declaredComplete')::boolean),
        bool_and((document->>'declaredComplete')::boolean)
          AND count(*) FILTER(WHERE document->>'position'<>'team')=10
          AND count(DISTINCT document->>'slot') FILTER(WHERE document->>'position'<>'team')=10
          AND count(DISTINCT coalesce(document->>'playerSourceId',document->>'slot'))
            FILTER(WHERE document->>'position'<>'team')=10
          AND count(DISTINCT (document->>'side')||':'||coalesce(document->>'teamSourceId',document->>'teamName'))=2
          AND bool_and(coalesce(document->>'teamName','')<>'')
          AND count(DISTINCT document->>'result')
            FILTER(WHERE document->>'side'='blue' AND document->>'result' IS NOT NULL)<=1
          AND count(DISTINCT document->>'result')
            FILTER(WHERE document->>'side'='red' AND document->>'result' IS NOT NULL)<=1
          AND (count(DISTINCT document->>'side') FILTER(WHERE document->>'result' IS NOT NULL)<2
            OR count(DISTINCT document->>'result') FILTER(WHERE document->>'result' IS NOT NULL)=2),
        jsonb_build_object('sourceLeague',document->>'sourceLeague','sourceGameId',document->>'sourceGameId',
          'sourceYear',(document->>'sourceYear')::integer,'sourceUrl',document->>'sourceUrl',
          'split',document->>'split','week',document->>'week',
          'playoffs',(document->>'playoffs')::boolean,'gameNumber',document->>'gameNumber',
          'patch',document->>'patch','durationSeconds',(document->>'durationSeconds')::integer),$1,$2
       FROM staged_oracle_rows GROUP BY document->>'gameId',document->>'archiveYear',
        document->>'sourceLeague',document->>'sourceGameId',document->>'occurredAt',
        document->>'sourceYear',document->>'sourceUrl',document->>'split',document->>'week',
        document->>'playoffs',document->>'gameNumber',document->>'patch',document->>'durationSeconds'
       ON CONFLICT(id) DO UPDATE SET occurred_at=EXCLUDED.occurred_at,split=EXCLUDED.split,
        playoffs=EXCLUDED.playoffs,game_number=EXCLUDED.game_number,patch=EXCLUDED.patch,
        duration_seconds=EXCLUDED.duration_seconds,complete=EXCLUDED.complete,
        summary_eligible=EXCLUDED.summary_eligible,context=EXCLUDED.context,
        artifact_hash=EXCLUDED.artifact_hash,updated_at=EXCLUDED.updated_at`,
      [artifact.hash, importedAt],
    );
    for (let start = 0; start < parsed.uniqueRows; start += 5000)
      await client.query(
        "DELETE FROM oracle_archive_participants WHERE game_id IN (SELECT DISTINCT game_id FROM staged_oracle_rows WHERE id>$1 AND id<=$2)",
        [start, start + 5000],
      );
    for (let start = 0; start < parsed.uniqueRows; start += 5000)
      await client.query(
        `INSERT INTO oracle_archive_participants(
        game_id,slot,participant_id,side,position,player_name,player_source_id,team_name,
        team_source_id,champion,result,kills,deaths,assists,damage_to_champions,vision_score,
        total_gold,total_cs,statistics,draft,source_row,row_hash)
       SELECT document->>'gameId',document->>'slot',document->>'participantId',document->>'side',
        document->>'position',document->>'playerName',document->>'playerSourceId',document->>'teamName',
        document->>'teamSourceId',document->>'champion',(document->>'result')::boolean,
        (document->>'kills')::double precision,(document->>'deaths')::double precision,
        (document->>'assists')::double precision,(document->>'damageToChampions')::double precision,
        (document->>'visionScore')::double precision,(document->>'totalGold')::double precision,
        (document->>'totalCs')::double precision,document->'statistics',document->'draft',
        document->'sourceRow',document->>'rowHash' FROM staged_oracle_rows
        WHERE id>$1 AND id<=$2`,
        [start, start + 5000],
      );
    const projected = await projectCurated(client);
    await client.query(
      `INSERT INTO imports(source,file_hash,year,records,official_file_id,official_url,
        original_filename,byte_length,header,acquisition_method,source_rows,archive_games,
        eligible_games,duplicate_rows,first_game_at,last_game_at,warnings,retained_file,retained_path,imported_at)
       VALUES('oracle',$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,true,$17,$18)
       ON CONFLICT(source,year,file_hash) WHERE source='oracle' DO UPDATE SET
        records=EXCLUDED.records,official_file_id=EXCLUDED.official_file_id,
        official_url=EXCLUDED.official_url,original_filename=EXCLUDED.original_filename,
        byte_length=EXCLUDED.byte_length,acquisition_method=EXCLUDED.acquisition_method,
        header=EXCLUDED.header,source_rows=EXCLUDED.source_rows,
        archive_games=EXCLUDED.archive_games,eligible_games=EXCLUDED.eligible_games,
        duplicate_rows=EXCLUDED.duplicate_rows,first_game_at=EXCLUDED.first_game_at,
        last_game_at=EXCLUDED.last_game_at,warnings=EXCLUDED.warnings,
        retained_file=true,retained_path=EXCLUDED.retained_path,imported_at=EXCLUDED.imported_at`,
      [
        artifact.hash,
        year,
        projected,
        archiveFileId(year),
        archiveDownload(year),
        artifact.originalFilename,
        artifact.bytes,
        parsed.header,
        artifact.acquisitionMethod,
        parsed.rows,
        parsed.games,
        parsed.eligibleGames,
        parsed.duplicates,
        parsed.firstGameAt,
        parsed.lastGameAt,
        JSON.stringify(parsed.warnings),
        artifact.path,
        importedAt,
      ],
    );
    return { ...parsed, projectedGames: projected };
  });
}

export async function retainOracleArtifacts(pool: Pool, currentYear: number): Promise<void> {
  const rows = (
    await pool.query<{
      id: string;
      year: number;
      imported_at: Date;
      retained_path: string;
    }>(
      `SELECT id::text,year,imported_at,retained_path FROM imports
       WHERE source='oracle' AND retained_file AND retained_path IS NOT NULL
       ORDER BY year,imported_at DESC,id DESC`,
    )
  ).rows;
  const keep = new Set<string>();
  const latestByYear = new Set<number>();
  const monthly = new Set<string>();
  for (const row of rows) {
    if (!latestByYear.has(row.year)) {
      keep.add(row.id);
      latestByYear.add(row.year);
    }
    if (row.year === currentYear) {
      const month = row.imported_at.toISOString().slice(0, 7);
      if (!monthly.has(month)) {
        keep.add(row.id);
        monthly.add(month);
      }
    }
  }
  const keptPaths = new Set(rows.filter((row) => keep.has(row.id)).map((row) => row.retained_path));
  for (const row of rows) {
    if (keep.has(row.id)) continue;
    if (!keptPaths.has(row.retained_path))
      await unlink(row.retained_path).catch((error: NodeJS.ErrnoException) => {
        if (error.code !== "ENOENT") throw error;
      });
    await pool.query("UPDATE imports SET retained_file=false,retained_path=NULL WHERE id=$1", [
      row.id,
    ]);
  }
}
