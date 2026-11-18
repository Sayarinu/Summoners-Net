import { z } from "zod";
import { recordingAt } from "../domain/broadcasts.js";
import { proGamePlatformPattern } from "./leaguepedia-game.js";

const proGameId = z.string().max(30).regex(new RegExp(proGamePlatformPattern));
/** Riot game IDs per request; each adds about 25 characters to the query's `IN` list. */
export const leaguepediaVodBatchSize = 50;
/** Rows per reply. A game normally has one row, so a full batch fits with room to spare. */
const rowLimit = 500;
const link = z.string().max(2000).nullable().optional();
const row = z.object({
  title: z.object({
    GameId: z.string().max(300).nullable().optional(),
    Vod: link,
    VodGameStart: link,
    VodPB: link,
    RiotPlatformGameId: z.string().max(100).nullable().optional(),
  }),
});
const reply = z.union([
  z.object({ error: z.object({ code: z.string().max(100) }) }),
  z.object({ cargoquery: z.array(row).max(rowLimit) }),
]);

/** One game's recordings on Leaguepedia, each a validated link opening at its own offset. */
export interface LeaguepediaVod {
  /** Leaguepedia's own `MatchScheduleGame` identifier for the row. */
  leaguepediaGameId: string | null;
  /** The recording opening where the game itself starts. */
  gameStartUrl: string | null;
  /** The recording opening where the draft starts. */
  draftStartUrl: string | null;
  /** A recording of the game without a stated start. */
  vodUrl: string | null;
}

export type LeaguepediaVodReply =
  | { state: "lagged" }
  /** Each requested game's recordings; null when the wiki has no row or no usable link. */
  | { state: "rows"; vods: Map<string, LeaguepediaVod | null> };

/** One Cargo query for the recordings of up to `leaguepediaVodBatchSize` games. */
export function leaguepediaVodsUrl(ids: readonly string[]) {
  if (!ids.length || ids.length > leaguepediaVodBatchSize)
    throw new Error(`Request between 1 and ${leaguepediaVodBatchSize} games.`);
  // The pattern admits only letters, digits and an underscore, so the list needs no escaping.
  const list = ids.map((id) => `'${proGameId.parse(id)}'`).join(",");
  const params = new URLSearchParams({
    action: "cargoquery",
    format: "json",
    tables: "MatchScheduleGame",
    fields: "GameId,Vod,VodGameStart,VodPB,RiotPlatformGameId",
    where: `RiotPlatformGameId IN (${list})`,
    order_by: "GameId",
    limit: String(rowLimit),
    // Ask the wiki to refuse the request while its replicas lag, rather than add to the load.
    maxlag: "5",
  });
  return `https://lol.fandom.com/api.php?${params}`;
}

/** Validates one reply and keeps, for each requested game, its first row with a usable link. */
export function parseLeaguepediaVods(input: unknown, ids: readonly string[]): LeaguepediaVodReply {
  const body = reply.parse(input);
  if ("error" in body) {
    if (body.error.code === "maxlag") return { state: "lagged" };
    throw new Error("Leaguepedia refused the request.");
  }
  const vods = new Map<string, LeaguepediaVod | null>(ids.map((id) => [id, null]));
  for (const { title } of body.cargoquery) {
    const id = title.RiotPlatformGameId?.trim() ?? "";
    if (!vods.has(id) || vods.get(id)) continue;
    const vod = {
      leaguepediaGameId: title.GameId?.trim() || null,
      gameStartUrl: recordingAt(title.VodGameStart?.trim()),
      draftStartUrl: recordingAt(title.VodPB?.trim()),
      vodUrl: recordingAt(title.Vod?.trim()),
    };
    if (vod.gameStartUrl || vod.draftStartUrl || vod.vodUrl) vods.set(id, vod);
  }
  return { state: "rows", vods };
}
