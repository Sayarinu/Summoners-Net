import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import type { Readable } from "node:stream";
import { parse } from "csv-parse";
import { z } from "zod";

const contextFields = new Set([
  "gameid",
  "datacompleteness",
  "url",
  "league",
  "year",
  "split",
  "playoffs",
  "date",
  "week",
  "game",
  "patch",
  "patchno",
  "participantid",
  "side",
  "position",
  "playername",
  "player",
  "playerid",
  "teamname",
  "team",
  "teamid",
  "champion",
]);
const draftFields = new Set([
  "firstpick",
  "ban1",
  "ban2",
  "ban3",
  "ban4",
  "ban5",
  "pick1",
  "pick2",
  "pick3",
  "pick4",
  "pick5",
]);
const metricFields = new Set([
  "gamelength",
  "result",
  "kills",
  "deaths",
  "assists",
  "k",
  "d",
  "a",
  "teamkills",
  "teamdeaths",
  "doublekills",
  "doubles",
  "triplekills",
  "triples",
  "quadrakills",
  "quadras",
  "pentakills",
  "pentas",
  "firstblood",
  "firstbloodkill",
  "firstbloodassist",
  "firstbloodvictim",
  "fb",
  "fbassist",
  "fbvictim",
  "fbtime",
  "kpm",
  "okpm",
  "team kpm",
  "ckpm",
  "firstdragon",
  "fd",
  "fdtime",
  "dragons",
  "opp_dragons",
  "teamdragkills",
  "oppdragkills",
  "elementaldrakes",
  "opp_elementaldrakes",
  "elementals",
  "oppelementals",
  "infernals",
  "mountains",
  "clouds",
  "oceans",
  "chemtechs",
  "hextechs",
  "firedrakes",
  "waterdrakes",
  "earthdrakes",
  "airdrakes",
  "infernaldrakes",
  "mountaindrakes",
  "clouddrakes",
  "oceandrakes",
  "chemtechdrakes",
  "hextechdrakes",
  "dragons (type unknown)",
  "elders",
  "opp_elders",
  "oppelders",
  "firstherald",
  "herald",
  "heraldtime",
  "heralds",
  "opp_heralds",
  "void_grubs",
  "opp_void_grubs",
  "voidgrubs",
  "opp_voidgrubs",
  "firstbaron",
  "fbarontime",
  "barons",
  "opp_barons",
  "fbaron",
  "teambaronkills",
  "oppbaronkills",
  "atakhans",
  "opp_atakhans",
  "firsttower",
  "fttime",
  "towers",
  "opp_towers",
  "ft",
  "teamtowerkills",
  "opptowerkills",
  "firstmidtower",
  "firstmidouter",
  "firsttothreetowers",
  "turretplates",
  "opp_turretplates",
  "inhibitors",
  "opp_inhibitors",
  "damagetochampions",
  "damagetotowers",
  "dmgtochamps",
  "dmgtochampsperminute",
  "dmgshare",
  "dpm",
  "damageshare",
  "damagetakenperminute",
  "damagemitigatedperminute",
  "wardsplaced",
  "wards",
  "wardshare",
  "wpm",
  "wardskilled",
  "wardkills",
  "wards-killed",
  "wcpm",
  "controlwardsbought",
  "visionwards",
  "visionwardbuys",
  "visiblewardclearrate",
  "invisiblewardclearrate",
  "visionscore",
  "vspm",
  "totalgold",
  "gold",
  "earnedgold",
  "earned gpm",
  "earnedgpm",
  "earnedgoldshare",
  "goldspent",
  "gspd",
  "gpr",
  "total cs",
  "totalcs",
  "minionkills",
  "monsterkills",
  "monsterkillsownjungle",
  "monsterkillsenemyjungle",
  "cspm",
  "cssharepost15",
  "oppcsat10",
  "csdat10",
  "oppgoldat10",
  "gdat10",
  "oppxpat10",
  "xpdat10",
  "oppcsat15",
  "csdat15",
  "oppgoldat15",
  "gdat15",
  "oppxpat15",
  "xpdat15",
]);
for (const minute of [10, 15, 20, 25])
  for (const name of [
    "goldat",
    "xpat",
    "csat",
    "opp_goldat",
    "opp_xpat",
    "opp_csat",
    "golddiffat",
    "xpdiffat",
    "csdiffat",
    "killsat",
    "assistsat",
    "deathsat",
    "opp_killsat",
    "opp_assistsat",
    "opp_deathsat",
  ])
    metricFields.add(`${name}${minute}`);

const aliases: Record<string, string> = {
  patchno: "patch",
  player: "playername",
  team: "teamname",
  k: "kills",
  d: "deaths",
  a: "assists",
  doubles: "doublekills",
  triples: "triplekills",
  quadras: "quadrakills",
  pentas: "pentakills",
  fb: "firstblood",
  fbassist: "firstbloodassist",
  fbvictim: "firstbloodvictim",
  fd: "firstdragon",
  teamdragkills: "dragons",
  oppdragkills: "opp_dragons",
  elementals: "elementaldrakes",
  oppelementals: "opp_elementaldrakes",
  firedrakes: "infernals",
  waterdrakes: "oceans",
  earthdrakes: "mountains",
  airdrakes: "clouds",
  oppelders: "opp_elders",
  herald: "firstherald",
  fbaron: "firstbaron",
  teambaronkills: "barons",
  oppbaronkills: "opp_barons",
  ft: "firsttower",
  teamtowerkills: "towers",
  opptowerkills: "opp_towers",
  firstmidouter: "firstmidtower",
  dmgtochamps: "damagetochampions",
  dmgtochampsperminute: "dpm",
  dmgshare: "damageshare",
  wards: "wardsplaced",
  wardkills: "wardskilled",
  visionwardbuys: "controlwardsbought",
  gold: "totalgold",
  earnedgpm: "earned gpm",
  totalcs: "total cs",
  "wards-killed": "wardskilled",
  voidgrubs: "void_grubs",
  opp_voidgrubs: "opp_void_grubs",
  oppcsat10: "opp_csat10",
  csdat10: "csdiffat10",
  oppgoldat10: "opp_goldat10",
  gdat10: "golddiffat10",
  oppxpat10: "opp_xpat10",
  xpdat10: "xpdiffat10",
  oppcsat15: "opp_csat15",
  csdat15: "csdiffat15",
  oppgoldat15: "opp_goldat15",
  gdat15: "golddiffat15",
  oppxpat15: "opp_xpat15",
  xpdat15: "xpdiffat15",
};

const normalized = (value: string) => value.trim().toLowerCase();
const canonical = (value: string) => aliases[normalized(value)] ?? normalized(value);
export const oracleArchiveFields = Object.freeze({
  context: [...contextFields],
  draft: [...draftFields],
  metrics: [...metricFields],
});

export interface ArchiveWarning {
  field: string;
  count: number;
  reason:
    | "invalid optional statistic"
    | "inconsistent game result"
    | "inconsistent team context"
    | "missing team name";
}
export interface ArchiveRow {
  gameId: string;
  archiveYear: number;
  sourceYear: number | null;
  sourceLeague: string;
  sourceGameId: string;
  sourceUrl: string | null;
  occurredAt: string;
  split: string | null;
  week: string | null;
  playoffs: boolean | null;
  gameNumber: string | null;
  patch: string | null;
  durationSeconds: number | null;
  declaredComplete: boolean;
  slot: string;
  participantId: string | null;
  side: "blue" | "red";
  position: string;
  playerName: string | null;
  playerSourceId: string | null;
  teamName: string;
  teamSourceId: string | null;
  champion: string | null;
  result: boolean | null;
  kills: number | null;
  deaths: number | null;
  assists: number | null;
  damageToChampions: number | null;
  visionScore: number | null;
  totalGold: number | null;
  totalCs: number | null;
  statistics: Record<string, number | null>;
  draft: Record<string, string | null>;
  sourceRow: Record<string, string>;
  rowHash: string;
}
export interface ArchiveParseResult {
  header: string[];
  rows: number;
  uniqueRows: number;
  duplicates: number;
  games: number;
  eligibleGames: number;
  firstGameAt: string | null;
  lastGameAt: string | null;
  warnings: ArchiveWarning[];
}

const valueFor = (entries: Map<string, string>, names: string[]) => {
  for (const name of names) {
    const value = entries.get(canonical(name));
    if (value?.trim()) return value.trim();
  }
  return null;
};
const archiveId = (year: number, league: string, game: string) =>
  `oracle:archive:${createHash("sha256").update(`${year}\0${league}\0${game}`).digest("hex")}`;
const parseDate = (raw: string, year: number) => {
  let date: Date;
  if (/^\d+(?:\.\d+)?$/.test(raw))
    date = new Date(Date.UTC(1899, 11, 30) + Number(raw) * 86_400_000);
  else {
    const iso = raw.replace(" ", "T");
    date = new Date(/Z$|[+-]\d\d:\d\d$/.test(iso) ? iso : `${iso}Z`);
  }
  if (!Number.isFinite(date.valueOf()) || date.getUTCFullYear() !== year)
    throw new Error("Historical date/year mismatch");
  return date.toISOString();
};
const positions: Record<string, string> = {
  jng: "jungle",
  jungle: "jungle",
  bot: "bottom",
  adc: "bottom",
  bottom: "bottom",
  sup: "support",
  support: "support",
  top: "top",
  mid: "mid",
  middle: "mid",
  team: "team",
};
const nonnegative = new Set([
  "gamelength",
  "kills",
  "deaths",
  "assists",
  "teamkills",
  "teamdeaths",
  "doublekills",
  "triplekills",
  "quadrakills",
  "pentakills",
  "dragons",
  "barons",
  "towers",
  "inhibitors",
  "damagetochampions",
  "damagetotowers",
  "visionscore",
  "totalgold",
  "total cs",
]);

function validateHeader(header: string[]) {
  if (!header.length) throw new Error("Expected an annual game CSV, not a summary export.");
  const normalizedHeaders = header.map(normalized);
  if (new Set(normalizedHeaders).size !== normalizedHeaders.length)
    throw new Error("CSV contains duplicate headers.");
  const unknown = header.filter((field) => {
    const key = normalized(field);
    return !contextFields.has(key) && !draftFields.has(key) && !metricFields.has(key);
  });
  if (unknown.length) throw new Error(`Unmapped Oracle headers: ${unknown.join(", ")}`);
  for (const needed of ["gameid", "league", "date", "position", "side"])
    if (!normalizedHeaders.includes(needed))
      throw new Error("Expected an annual game CSV, not a summary export.");
}

function normalizeRow(
  sourceRow: Record<string, string>,
  year: number,
  warningCounts: Map<string, number>,
): ArchiveRow {
  const values = new Map(Object.entries(sourceRow).map(([key, value]) => [canonical(key), value]));
  const sourceGameId = valueFor(values, ["gameid"]);
  const sourceLeague = valueFor(values, ["league"]);
  if (!sourceGameId || !sourceLeague) throw new Error("Missing archive game identity");
  const statedYear = valueFor(values, ["year"]);
  if (statedYear && (!/^\d{4}$/.test(statedYear) || Number(statedYear) < 2014))
    throw new Error("Invalid historical source year");
  const date = valueFor(values, ["date"]);
  if (!date) throw new Error("Missing historical date");
  const occurredAt = parseDate(date, year);
  const sideRaw = valueFor(values, ["side"])?.toLowerCase();
  const side =
    sideRaw === "blue" || sideRaw === "100"
      ? "blue"
      : sideRaw === "red" || sideRaw === "200"
        ? "red"
        : null;
  if (!side) throw new Error("Invalid historical side");
  const position = positions[valueFor(values, ["position"])?.toLowerCase() ?? ""];
  if (!position) throw new Error("Invalid historical position");
  const teamName = valueFor(values, ["teamname", "team"]) ?? "";
  const metrics: Record<string, number | null> = {};
  for (const [field, rawValue] of Object.entries(sourceRow)) {
    const key = canonical(field);
    if (!metricFields.has(normalized(field))) continue;
    const raw = rawValue.trim();
    if (!raw || /^(?:na|nan|null)$/i.test(raw)) {
      metrics[key] = null;
      continue;
    }
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || (nonnegative.has(key) && parsed < 0)) {
      metrics[key] = null;
      warningCounts.set(key, (warningCounts.get(key) ?? 0) + 1);
    } else metrics[key] = parsed;
  }
  const outcome = metrics.result;
  if (outcome !== null && outcome !== undefined && outcome !== 0 && outcome !== 1)
    throw new Error("Invalid historical result");
  const draft = Object.fromEntries(
    Object.entries(sourceRow)
      .filter(([field]) => draftFields.has(normalized(field)))
      .map(([field, value]) => [normalized(field), value.trim() || null]),
  );
  const gameId = archiveId(year, sourceLeague, sourceGameId);
  const participantId = valueFor(values, ["participantid"]);
  const slot = `${side}:${position}`;
  const rowHash = createHash("sha256").update(JSON.stringify(sourceRow)).digest("hex");
  const playoffsRaw = valueFor(values, ["playoffs"]);
  if (playoffsRaw && !/^(?:0|1|true|false)$/i.test(playoffsRaw))
    throw new Error("Invalid historical playoffs flag");
  const duration = metrics.gamelength;
  return {
    gameId,
    archiveYear: year,
    sourceYear: statedYear ? Number(statedYear) : null,
    sourceLeague,
    sourceGameId,
    sourceUrl: valueFor(values, ["url"]),
    occurredAt,
    split: valueFor(values, ["split"]),
    week: valueFor(values, ["week"]),
    playoffs: playoffsRaw == null ? null : /^(?:1|true)$/i.test(playoffsRaw),
    gameNumber: valueFor(values, ["game"]),
    patch: valueFor(values, ["patch", "patchno"]),
    durationSeconds:
      duration == null ? null : duration < 100 ? Math.round(duration * 60) : Math.round(duration),
    declaredComplete:
      (valueFor(values, ["datacompleteness"]) ?? "complete").toLowerCase() === "complete",
    slot,
    participantId,
    side,
    position,
    playerName: position === "team" ? null : valueFor(values, ["playername", "player"]),
    playerSourceId: position === "team" ? null : valueFor(values, ["playerid"]),
    teamName,
    teamSourceId: valueFor(values, ["teamid"]),
    champion: position === "team" ? null : valueFor(values, ["champion"]),
    result: outcome == null ? null : outcome === 1,
    kills: metrics.kills ?? null,
    deaths: metrics.deaths ?? null,
    assists: metrics.assists ?? null,
    damageToChampions: metrics.damagetochampions ?? null,
    visionScore: metrics.visionscore ?? null,
    totalGold: metrics.totalgold ?? null,
    totalCs: metrics["total cs"] ?? null,
    statistics: metrics,
    draft,
    sourceRow,
    rowHash,
  };
}

export async function streamOracleArchive(
  input: string | Readable,
  year: number,
  consume: (rows: ArchiveRow[]) => Promise<void>,
): Promise<ArchiveParseResult> {
  z.number().int().min(2014).max(2100).parse(year);
  let header: string[] = [];
  const parser = parse({
    bom: true,
    columns: (fields: string[]) => {
      header = fields;
      validateHeader(fields);
      return fields;
    },
    skip_empty_lines: true,
    max_record_size: 200_000,
  });
  const source = typeof input === "string" ? createReadStream(input) : input;
  source.pipe(parser);
  const warnings = new Map<string, number>();
  const slots = new Map<string, string>();
  const games = new Map<
    string,
    {
      context: string;
      declaredComplete: boolean;
      players: Set<string>;
      playerIdentities: Set<string>;
      teams: Map<string, string>;
      results: Map<string, boolean>;
      resultConflict: boolean;
      teamConflict: boolean;
      missingTeamName: boolean;
    }
  >();
  let rows = 0;
  let duplicates = 0;
  let firstGameMillis = Number.POSITIVE_INFINITY;
  let lastGameMillis = Number.NEGATIVE_INFINITY;
  let batch: ArchiveRow[] = [];
  for await (const unknownRow of parser) {
    rows++;
    const row = normalizeRow(z.record(z.string(), z.string()).parse(unknownRow), year, warnings);
    const key = `${row.gameId}\0${row.slot}`;
    const seen = slots.get(key);
    if (seen) {
      if (seen !== row.rowHash) throw new Error("Conflicting duplicate participant in CSV");
      duplicates++;
      continue;
    }
    slots.set(key, row.rowHash);
    const context = JSON.stringify([
      row.occurredAt,
      row.sourceYear,
      row.sourceUrl,
      row.split,
      row.week,
      row.playoffs,
      row.gameNumber,
      row.patch,
      row.durationSeconds,
    ]);
    const game = games.get(row.gameId) ?? {
      context,
      declaredComplete: true,
      players: new Set<string>(),
      playerIdentities: new Set<string>(),
      teams: new Map<string, string>(),
      results: new Map<string, boolean>(),
      resultConflict: false,
      teamConflict: false,
      missingTeamName: false,
    };
    if (game.context !== context) throw new Error("Conflicting game context");
    game.declaredComplete &&= row.declaredComplete;
    if (row.position !== "team") {
      game.players.add(row.slot);
      game.playerIdentities.add(row.playerSourceId ?? row.slot);
    }
    const teamIdentity = row.teamSourceId ?? row.teamName;
    const existingTeam = game.teams.get(row.side);
    if (existingTeam && existingTeam !== teamIdentity) game.teamConflict = true;
    if (!row.teamName) game.missingTeamName = true;
    game.teams.set(row.side, teamIdentity);
    const existingResult = game.results.get(row.side);
    if (row.result !== null && existingResult !== undefined && existingResult !== row.result)
      game.resultConflict = true;
    if (row.result !== null) game.results.set(row.side, row.result);
    const blueResult = game.results.get("blue");
    const redResult = game.results.get("red");
    if (blueResult !== undefined && redResult !== undefined && blueResult === redResult)
      game.resultConflict = true;
    games.set(row.gameId, game);
    const gameMillis = Date.parse(row.occurredAt);
    firstGameMillis = Math.min(firstGameMillis, gameMillis);
    lastGameMillis = Math.max(lastGameMillis, gameMillis);
    batch.push(row);
    if (batch.length >= 500) {
      await consume(batch);
      batch = [];
    }
  }
  if (batch.length) await consume(batch);
  if (!rows) throw new Error("CSV contains no archive rows.");
  let eligibleGames = 0;
  let inconsistentGames = 0;
  let inconsistentTeams = 0;
  let missingTeamNames = 0;
  for (const game of games.values())
    if (game.resultConflict || game.teamConflict || game.missingTeamName) {
      if (game.resultConflict) inconsistentGames++;
      if (game.teamConflict) inconsistentTeams++;
      if (game.missingTeamName) missingTeamNames++;
    } else if (
      game.declaredComplete &&
      game.players.size === 10 &&
      game.playerIdentities.size === 10 &&
      game.teams.size === 2
    )
      eligibleGames++;
  return {
    header,
    rows,
    uniqueRows: slots.size,
    duplicates,
    games: games.size,
    eligibleGames,
    firstGameAt: Number.isFinite(firstGameMillis) ? new Date(firstGameMillis).toISOString() : null,
    lastGameAt: Number.isFinite(lastGameMillis) ? new Date(lastGameMillis).toISOString() : null,
    warnings: [
      ...[...warnings].map(([field, count]) => ({
        field,
        count,
        reason: "invalid optional statistic" as const,
      })),
      ...(inconsistentGames
        ? [
            {
              field: "result",
              count: inconsistentGames,
              reason: "inconsistent game result" as const,
            },
          ]
        : []),
      ...(inconsistentTeams
        ? [
            {
              field: "team",
              count: inconsistentTeams,
              reason: "inconsistent team context" as const,
            },
          ]
        : []),
      ...(missingTeamNames
        ? [{ field: "teamname", count: missingTeamNames, reason: "missing team name" as const }]
        : []),
    ],
  };
}
