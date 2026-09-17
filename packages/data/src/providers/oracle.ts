import { parse } from "csv-parse/sync";
import { z } from "zod";
import { coveredLeague, sourceIdentity } from "../domain/coverage.js";
import { gameSchema, type Game, type Identity, type Participant } from "../domain/models.js";
import archiveFiles from "./archive-files.json" with { type: "json" };
export const archiveUrl =
  "https://drive.google.com/drive/folders/1gLSw0RLjBbtaNy0dgnGQDAZOHIgCe-HH";
export function archiveDownload(year: number): string {
  const id = (archiveFiles as Record<string, string>)[String(year)];
  if (!id) throw new Error("Archive year is not indexed; use a local annual CSV.");
  return `https://drive.google.com/uc?export=download&id=${id}`;
}
function number(value: string | undefined): number | null {
  if (!value?.trim()) return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n))
    throw new Error("Invalid historical count");
  return n;
}
function identity(
  row: Record<string, string>,
  kind: "player" | "team",
  game: string,
  slot: string,
): Identity {
  const external = row[`${kind}id`]?.trim();
  const sourceId = external || `observation:${game}:${slot}`;
  return {
    id: sourceIdentity("oracle", kind, external, `${game}:${slot}`),
    source: "oracle",
    sourceId,
    kind,
    name: row[`${kind}name`]?.trim() || row[kind]?.trim() || `Unknown ${kind}`,
    imageUrl: null,
    country: null,
    role: kind === "player" ? (row.position ?? null) : null,
  };
}
export function parseHistory(csv: string, year: number): Game[] {
  z.number().int().min(2014).max(2100).parse(year);
  if (/<\s*(?:!doctype|html)|quota exceeded|download quota/i.test(csv.slice(0, 4096)))
    throw new Error("Archive returned an HTML/quota page. Import a local annual CSV.");
  if (Buffer.byteLength(csv) > 256 * 1024 * 1024) throw new Error("CSV exceeds 256 MiB");
  const rows = z.array(z.record(z.string(), z.string())).parse(
    parse(csv, {
      bom: true,
      columns: true,
      skip_empty_lines: true,
      max_record_size: 200000,
    }),
  );
  const header = rows[0];
  if (!header || !["gameid", "league", "date", "position", "side"].every((k) => k in header))
    throw new Error("Expected an annual game CSV, not a summary export.");
  const games = new Map<string, Game>();
  const slots = new Map<string, string>();
  for (const row of rows) {
    const league = coveredLeague(row.league ?? "", year);
    if (!league) continue;
    const sourceId = row.gameid?.trim();
    if (!sourceId) throw new Error("Missing source game ID");
    const time = (row.date ?? "").replace(" ", "T");
    const occurredAt = new Date(/Z$|[+-]\d\d:\d\d$/.test(time) ? time : `${time}Z`);
    if (!Number.isFinite(occurredAt.valueOf()) || occurredAt.getUTCFullYear() !== year)
      throw new Error("Historical date/year mismatch");
    const side = ({ blue: "blue", red: "red", "100": "blue", "200": "red" } as const)[
      (row.side ?? "").toLowerCase() as "blue"
    ];
    if (!side) throw new Error("Invalid historical side");
    const rawRole = (row.position ?? "").toLowerCase();
    const role =
      (
        {
          jng: "jungle",
          bot: "bottom",
          adc: "bottom",
          sup: "support",
        } as Record<string, string>
      )[rawRole] ?? rawRole;
    if (!["top", "jungle", "mid", "bottom", "support", "team"].includes(role))
      throw new Error("Invalid historical position");
    const slot = `${side}:${role}`;
    const id = `oracle:game:${sourceId}`;
    const won = row.result?.trim();
    if (won && won !== "0" && won !== "1") throw new Error("Invalid historical result");
    const participant: Participant = {
      slot,
      side,
      role,
      team: identity(row, "team", sourceId, side),
      player: role === "team" ? null : identity(row, "player", sourceId, slot),
      champion: row.champion?.trim() || null,
      won: won ? won === "1" : null,
      kills: number(row.kills),
      deaths: number(row.deaths),
      assists: number(row.assists),
    };
    const duplicateKey = `${id}:${slot}`;
    const content = JSON.stringify(participant);
    if (slots.has(duplicateKey)) {
      if (slots.get(duplicateKey) !== content)
        throw new Error("Conflicting duplicate participant in CSV");
      continue;
    }
    slots.set(duplicateKey, content);
    const completeness = (row.datacompleteness ?? "complete").toLowerCase() === "complete";
    const game = games.get(id) ?? {
      id,
      sourceId,
      matchId: null,
      league,
      event: [row.league, row.split, year].filter(Boolean).join(" · "),
      year,
      occurredAt: occurredAt.toISOString(),
      number: number(row.game) ?? 1,
      patch: row.patch?.trim() || null,
      complete: true,
      participants: [],
    };
    if (game.league !== league || game.occurredAt !== occurredAt.toISOString())
      throw new Error("Conflicting game context");
    game.complete = game.complete && completeness;
    game.participants.push(participant);
    games.set(id, game);
  }
  for (const game of games.values()) {
    const players = game.participants.filter((p) => p.role !== "team");
    game.complete =
      game.complete &&
      players.length === 10 &&
      new Set(players.map((p) => p.player?.id)).size === 10 &&
      new Set(players.map((p) => p.team.id)).size === 2 &&
      ["blue", "red"].every(
        (side) =>
          new Set(game.participants.filter((p) => p.side === side).map((p) => p.team.id)).size ===
          1,
      );
    gameSchema.parse(game);
  }
  if (!games.size) throw new Error("CSV contains no games in the configured coverage.");
  return [...games.values()];
}
