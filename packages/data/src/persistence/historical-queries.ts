import { z } from "zod";
import type { Pool } from "pg";
import { coveredLeague } from "../domain/coverage.js";
import {
  historicalQuerySchema,
  historicalSubjectSchema,
  type HistoricalCoverage,
  type HistoricalGameDetail,
  type HistoricalGameListItem,
  type HistoricalParticipant,
  type HistoricalQuery,
  type HistoricalSubject,
  type HistoricalSummary,
  type SampledValue,
} from "../domain/historical.js";
import type { Page } from "../domain/models.js";
import { archiveYears } from "../providers/oracle.js";

const historicalIdSchema = z.string().regex(/^oracle:archive:[a-f0-9]{64}$/);
function historicalFilters(input: HistoricalQuery) {
  const query = historicalQuerySchema.parse(input);
  const values: unknown[] = [];
  const clauses: string[] = [];
  const add = (clause: string, value: unknown) => {
    values.push(value);
    clauses.push(clause.replaceAll("?", `$${values.length}`));
  };
  if (query.year) add("g.archive_year=?", query.year);
  if (query.sourceLeague) add("lower(g.source_league)=lower(?)", query.sourceLeague);
  if (query.competition)
    add(
      "EXISTS(SELECT 1 FROM games cg WHERE cg.archive_game_id=g.id AND cg.league=?)",
      query.competition,
    );
  if (query.patch) add("lower(g.patch)=lower(?)", query.patch);
  if (query.team)
    add(
      "EXISTS(SELECT 1 FROM oracle_archive_participants p WHERE p.game_id=g.id AND lower(p.team_name)=lower(?))",
      query.team,
    );
  if (query.player)
    add(
      "EXISTS(SELECT 1 FROM oracle_archive_participants p WHERE p.game_id=g.id AND lower(p.player_name)=lower(?))",
      query.player,
    );
  if (query.champion)
    add(
      "EXISTS(SELECT 1 FROM oracle_archive_participants p WHERE p.game_id=g.id AND lower(p.champion)=lower(?))",
      query.champion,
    );
  return { query, values, where: clauses.join(" AND ") || "true" };
}

type GameRow = {
  id: string;
  archive_year: number;
  source_league: string;
  source_game_id: string;
  occurred_at: Date;
  patch: string | null;
  complete: boolean;
  summary_eligible: boolean;
  teams: { name: string; side: "blue" | "red"; won: boolean | null }[];
};
const listItem = (row: GameRow): HistoricalGameListItem => ({
  id: row.id,
  year: row.archive_year,
  sourceLeague: row.source_league,
  competition: coveredLeague(row.source_league, row.archive_year),
  sourceGameId: row.source_game_id,
  occurredAt: row.occurred_at.toISOString(),
  patch: row.patch,
  complete: row.complete,
  summaryEligible: row.summary_eligible,
  teams: row.teams,
});
const teamJson = `(SELECT coalesce(jsonb_agg(jsonb_build_object('name',name,'side',side,'won',won) ORDER BY side),'[]')
  FROM (SELECT DISTINCT ON (side) team_name AS name,side,result AS won FROM oracle_archive_participants
    WHERE game_id=g.id ORDER BY side,(position='team') DESC) teams)`;

const groups = {
  combat: new Set([
    "result",
    "kills",
    "deaths",
    "assists",
    "teamkills",
    "teamdeaths",
    "doublekills",
    "triplekills",
    "quadrakills",
    "pentakills",
    "firstblood",
    "firstbloodkill",
    "firstbloodassist",
    "firstbloodvictim",
    "team kpm",
    "ckpm",
  ]),
  objectives: new Set([
    "firstdragon",
    "dragons",
    "opp_dragons",
    "elementaldrakes",
    "opp_elementaldrakes",
    "infernals",
    "mountains",
    "clouds",
    "oceans",
    "chemtechs",
    "hextechs",
    "elders",
    "opp_elders",
    "firstherald",
    "heralds",
    "opp_heralds",
    "void_grubs",
    "opp_void_grubs",
    "firstbaron",
    "barons",
    "opp_barons",
    "atakhans",
    "opp_atakhans",
    "firsttower",
    "towers",
    "opp_towers",
    "firstmidtower",
    "firsttothreetowers",
    "turretplates",
    "opp_turretplates",
    "inhibitors",
    "opp_inhibitors",
  ]),
  damage: new Set([
    "damagetochampions",
    "damagetotowers",
    "dpm",
    "damageshare",
    "damagetakenperminute",
    "damagemitigatedperminute",
  ]),
  vision: new Set([
    "wardsplaced",
    "wpm",
    "wardskilled",
    "wcpm",
    "controlwardsbought",
    "visionscore",
    "vspm",
  ]),
  economy: new Set([
    "totalgold",
    "earnedgold",
    "earned gpm",
    "earnedgoldshare",
    "goldspent",
    "gspd",
    "gpr",
    "total cs",
    "minionkills",
    "monsterkills",
    "monsterkillsownjungle",
    "monsterkillsenemyjungle",
    "cspm",
  ]),
};
function groupedStatistics(
  statistics: Record<string, number | null>,
): HistoricalParticipant["statistics"] {
  const result: HistoricalParticipant["statistics"] = {
    combat: {},
    objectives: {},
    damage: {},
    vision: {},
    economy: {},
    checkpoints: {},
  };
  for (const [name, value] of Object.entries(statistics)) {
    const target = /^.*(?:at|diffat)(?:10|15|20|25)$/.test(name)
      ? result.checkpoints
      : groups.combat.has(name)
        ? result.combat
        : groups.objectives.has(name)
          ? result.objectives
          : groups.damage.has(name)
            ? result.damage
            : groups.vision.has(name)
              ? result.vision
              : result.economy;
    target[name] = value;
  }
  return result;
}
const sampled = (value: unknown, count: unknown): SampledValue => ({
  value: value == null ? null : Number(value),
  sampleCount: Number(count),
});

export function historicalQueries(pool: Pool) {
  return {
    async historicalGames(input: HistoricalQuery = {}): Promise<Page<HistoricalGameListItem>> {
      const { query, values, where } = historicalFilters(input);
      const result = await pool.query<GameRow & { total: number }>(
        `SELECT g.id,g.archive_year,g.source_league,g.source_game_id,g.occurred_at,g.patch,g.complete,
          g.summary_eligible,${teamJson} AS teams,count(*) OVER()::integer AS total
         FROM oracle_archive_games g WHERE ${where} ORDER BY g.occurred_at DESC,g.id
         LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
        [...values, query.pageSize, (query.page - 1) * query.pageSize],
      );
      const total =
        result.rows[0]?.total ??
        Number(
          (
            await pool.query<{ count: string }>(
              `SELECT count(*) AS count FROM oracle_archive_games g WHERE ${where}`,
              values,
            )
          ).rows[0]!.count,
        );
      return {
        items: result.rows.map(listItem),
        page: query.page,
        pageSize: query.pageSize,
        total,
      };
    },
    async historicalGame(id: string): Promise<HistoricalGameDetail | null> {
      const game = await pool.query<
        GameRow & {
          split: string | null;
          playoffs: boolean | null;
          game_number: string | null;
          duration_seconds: number | null;
          context: { sourceYear?: number | null; sourceUrl?: string | null; week?: string | null };
        }
      >(`SELECT g.*,${teamJson} AS teams FROM oracle_archive_games g WHERE g.id=$1`, [
        historicalIdSchema.parse(id),
      ]);
      const row = game.rows[0];
      if (!row) return null;
      const participants = await pool.query<{
        slot: string;
        side: "blue" | "red";
        position: string;
        player_name: string | null;
        player_source_id: string | null;
        team_name: string;
        team_source_id: string | null;
        champion: string | null;
        result: boolean | null;
        statistics: Record<string, number | null>;
        draft: Record<string, string | null>;
      }>(
        `SELECT slot,side,position,player_name,player_source_id,team_name,team_source_id,champion,
            result,statistics,draft
          FROM oracle_archive_participants
          WHERE game_id=$1
          ORDER BY side,position`,
        [id],
      );
      const draft = (["blue", "red"] as const).map((side) => {
        const values =
          participants.rows.find((participant) => participant.side === side)?.draft ?? {};
        return {
          side,
          firstPick:
            values.firstpick == null
              ? null
              : values.firstpick === "1" || values.firstpick.toLowerCase() === "true",
          picks: [1, 2, 3, 4, 5].map((n) => values[`pick${n}`] ?? null),
          bans: [1, 2, 3, 4, 5].map((n) => values[`ban${n}`] ?? null),
        };
      });
      return {
        ...listItem(row),
        context: {
          sourceYear: row.context.sourceYear ?? null,
          sourceUrl: row.context.sourceUrl ?? null,
          split: row.split,
          week: row.context.week ?? null,
          playoffs: row.playoffs,
          gameNumber: row.game_number,
          durationSeconds: row.duration_seconds,
        },
        draft,
        participants: participants.rows.map((participant) => ({
          slot: participant.slot,
          side: participant.side,
          position: participant.position,
          player: participant.player_name
            ? { name: participant.player_name, sourceId: participant.player_source_id }
            : null,
          team: { name: participant.team_name, sourceId: participant.team_source_id },
          champion: participant.champion,
          won: participant.result,
          statistics: groupedStatistics(participant.statistics),
        })),
      };
    },
    async historicalSummary(
      subjectInput: HistoricalSubject,
      input: HistoricalQuery = {},
    ): Promise<HistoricalSummary> {
      const subject = historicalSubjectSchema.parse(subjectInput);
      const { values, where } = historicalFilters(input);
      values.push(subject.value);
      const subjectParameter = `$${values.length}`;
      const match =
        subject.kind === "player"
          ? `lower(p.player_name)=lower(${subjectParameter})`
          : subject.kind === "champion"
            ? `lower(p.champion)=lower(${subjectParameter})`
            : `lower(p.team_name)=lower(${subjectParameter})`;
      const distinctSlot = subject.kind === "champion" ? ",p.slot" : "";
      const preferred = subject.kind === "team" ? "(p.position='team') DESC," : "";
      const metricSelect = [10, 15, 20, 25]
        .flatMap((minute) =>
          ["gold", "xp", "cs"].map((kind) => {
            const key = `${kind}diffat${minute}`;
            return `avg((statistics->>'${key}')::double precision) AS ${kind}${minute},count(statistics->>'${key}')::integer AS ${kind}${minute}_n`;
          }),
        )
        .join(",");
      const objectiveSelect = [
        "dragons",
        "barons",
        "heralds",
        "void_grubs",
        "atakhans",
        "towers",
        "inhibitors",
      ]
        .flatMap((key) => [
          `sum((statistics->>'${key}')::double precision) AS ${key}_total`,
          `avg((statistics->>'${key}')::double precision) AS ${key}_rate`,
          `count(statistics->>'${key}')::integer AS ${key}_n`,
        ])
        .join(",");
      const query = await pool.query<Record<string, unknown>>(
        `WITH scoped AS (SELECT g.id FROM oracle_archive_games g WHERE g.summary_eligible AND ${where}),
         observations AS (SELECT DISTINCT ON (p.game_id${distinctSlot}) p.*
          FROM oracle_archive_participants p JOIN scoped s ON s.id=p.game_id WHERE ${match}
          ORDER BY p.game_id${distinctSlot},${preferred}p.slot)
         SELECT count(*)::integer AS games,count(result)::integer AS results,
          count(*) FILTER(WHERE result)::integer AS wins,avg(result::integer) AS win_rate,
          sum(kills+assists) FILTER(WHERE kills IS NOT NULL AND deaths IS NOT NULL AND assists IS NOT NULL)/nullif(sum(deaths) FILTER(WHERE kills IS NOT NULL AND deaths IS NOT NULL AND assists IS NOT NULL),0) AS kda,
          count(*) FILTER(WHERE kills IS NOT NULL AND deaths IS NOT NULL AND assists IS NOT NULL)::integer AS kda_n,
          avg((statistics->>'dpm')::double precision) AS dpm,count(statistics->>'dpm')::integer AS dpm_n,
          avg((statistics->>'earned gpm')::double precision) AS egpm,count(statistics->>'earned gpm')::integer AS egpm_n,
          avg((statistics->>'cspm')::double precision) AS cspm,count(statistics->>'cspm')::integer AS cspm_n,
          avg((statistics->>'vspm')::double precision) AS vspm,count(statistics->>'vspm')::integer AS vspm_n,
          ${metricSelect},${objectiveSelect} FROM observations`,
        values,
      );
      const row = query.rows[0]!;
      const champions = await pool.query<{
        champion: string;
        games: number;
        wins: number;
        resultGames: number;
      }>(
        `WITH scoped AS (SELECT g.id FROM oracle_archive_games g WHERE g.summary_eligible AND ${where})
         SELECT p.champion,count(DISTINCT p.game_id)::integer AS games,
          count(DISTINCT p.game_id) FILTER(WHERE p.result)::integer AS wins,
          count(DISTINCT p.game_id) FILTER(WHERE p.result IS NOT NULL)::integer AS "resultGames"
         FROM oracle_archive_participants p JOIN scoped s ON s.id=p.game_id
         WHERE p.position<>'team' AND p.champion IS NOT NULL AND ${match}
         GROUP BY p.champion ORDER BY games DESC,p.champion`,
        values,
      );
      const checkpoints = (kind: "gold" | "xp" | "cs") =>
        Object.fromEntries(
          [10, 15, 20, 25].map((minute) => [
            String(minute),
            sampled(row[`${kind}${minute}`], row[`${kind}${minute}_n`]),
          ]),
        ) as Record<"10" | "15" | "20" | "25", SampledValue>;
      const teamObjectives: Record<string, SampledValue> = {};
      for (const key of [
        "dragons",
        "barons",
        "heralds",
        "void_grubs",
        "atakhans",
        "towers",
        "inhibitors",
      ]) {
        teamObjectives[`${key}Total`] = sampled(row[`${key}_total`], row[`${key}_n`]);
        teamObjectives[`${key}PerGame`] = sampled(row[`${key}_rate`], row[`${key}_n`]);
      }
      return {
        subject,
        games: Number(row.games),
        results: Number(row.results),
        wins: Number(row.wins),
        winRate: sampled(row.win_rate, row.results),
        kda: sampled(row.kda, row.kda_n),
        championUsage: champions.rows,
        damagePerMinute: sampled(row.dpm, row.dpm_n),
        earnedGoldPerMinute: sampled(row.egpm, row.egpm_n),
        csPerMinute: sampled(row.cspm, row.cspm_n),
        visionScorePerMinute: sampled(row.vspm, row.vspm_n),
        checkpointGoldDifference: checkpoints("gold"),
        checkpointXpDifference: checkpoints("xp"),
        checkpointCsDifference: checkpoints("cs"),
        teamObjectives,
      };
    },
    async historicalCoverage(): Promise<HistoricalCoverage[]> {
      const result = await pool.query<{
        year: number;
        file_hash: string | null;
        imported_at: Date | null;
        source_rows: number | null;
        archive_games: number | null;
        eligible_games: number | null;
        warnings: HistoricalCoverage["warnings"] | null;
        header: string[] | null;
        retained_file: boolean | null;
        error: string | null;
      }>(
        `SELECT years.year,latest.file_hash,latest.imported_at,latest.source_rows,latest.archive_games,
          latest.eligible_games,latest.warnings,latest.header,latest.retained_file,failed.error
         FROM unnest($1::integer[]) years(year)
         LEFT JOIN LATERAL (SELECT * FROM imports i WHERE i.source='oracle' AND i.year=years.year
           AND i.source_rows IS NOT NULL ORDER BY i.imported_at DESC,i.id DESC LIMIT 1) latest ON true
         LEFT JOIN LATERAL (SELECT error FROM sync_jobs j WHERE j.request->>'kind'='history'
           AND (j.request->>'year')::integer=years.year AND j.state='failed' ORDER BY j.id DESC LIMIT 1) failed ON true
         ORDER BY years.year`,
        [archiveYears],
      );
      return result.rows.map((row) => ({
        year: row.year,
        status: row.file_hash ? "complete" : "incomplete",
        error: row.file_hash ? null : row.error,
        artifactHash: row.file_hash,
        importedAt: row.imported_at?.toISOString() ?? null,
        sourceRows: row.source_rows ?? 0,
        games: row.archive_games ?? 0,
        eligibleGames: row.eligible_games ?? 0,
        warnings: row.warnings ?? [],
        fields: row.header ?? [],
        retainedFile: row.retained_file ?? false,
      }));
    },
  };
}
