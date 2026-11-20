import type { Broadcast, Match, SeriesGame } from "./models.js";

export function parseBroadcast(raw: string, language = "unknown"): Broadcast | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.username || url.password) return null;
  const host = url.hostname.toLowerCase();
  if (host === "twitch.tv" || host === "www.twitch.tv") {
    const path = url.pathname.split("/").filter(Boolean);
    let externalId = "";
    if (path[0] === "videos" && /^\d+$/.test(path[1] ?? "")) externalId = `v${path[1]}`;
    else if (path.length === 1 && /^[a-zA-Z0-9_]{3,25}$/.test(path[0] ?? ""))
      externalId = path[0] ?? "";
    return { provider: "twitch", externalId, url: url.toString(), language };
  }
  if (["youtube.com", "www.youtube.com", "youtu.be"].includes(host)) {
    const candidate =
      host === "youtu.be"
        ? url.pathname.slice(1)
        : (url.searchParams.get("v") ??
          (url.pathname.startsWith("/live/") ? url.pathname.slice(6) : ""));
    return {
      provider: "youtube",
      externalId: /^[\w-]{11}$/.test(candidate) ? candidate : "",
      url: url.toString(),
      language,
    };
  }
  return null;
}
export function recordingUrl(value: string | null | undefined): string | null {
  const broadcast = value ? parseBroadcast(value) : null;
  return broadcast && isRecording(broadcast) ? broadcast.url : null;
}

export function isRecording(broadcast: Broadcast): boolean {
  return broadcast.provider === "youtube"
    ? /^[\w-]{11}$/.test(broadcast.externalId)
    : /^v\d+$/.test(broadcast.externalId) &&
        /^https:\/\/(?:www\.)?twitch\.tv\/videos\//.test(broadcast.url);
}

/** Seconds in a `t` offset such as `540`, `540s` or `1h2m3s`; null when absent or malformed. */
export function offsetSeconds(value: string | null | undefined): number | null {
  const match = value?.match(/^(?:(\d{1,3})h)?(?:(\d{1,4})m)?(?:(\d{1,6})s?)?$/);
  if (!value || !match) return null;
  const [, hours = "0", minutes = "0", seconds = "0"] = match;
  return Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds);
}

/**
 * A YouTube (`youtu.be` or `youtube.com/watch`) or Twitch video link rebuilt from its video ID,
 * keeping only its `t` start offset; null for anything else, including live channels.
 */
export function recordingAt(value: string | null | undefined): string | null {
  const broadcast = value ? parseBroadcast(value) : null;
  if (!broadcast || !isRecording(broadcast)) return null;
  const source = new URL(broadcast.url);
  if (
    broadcast.provider === "youtube" &&
    source.hostname !== "youtu.be" &&
    source.pathname !== "/watch"
  )
    return null;
  const start = offsetSeconds(source.searchParams.get("t"));
  if (broadcast.provider === "youtube") {
    const url = new URL("https://www.youtube.com/watch");
    url.searchParams.set("v", broadcast.externalId);
    if (start) url.searchParams.set("t", `${start}s`);
    return url.toString();
  }
  const url = new URL(`https://www.twitch.tv/videos/${broadcast.externalId.slice(1)}`);
  if (start) {
    const [hours, minutes, seconds] = [
      Math.floor(start / 3600),
      Math.floor(start / 60) % 60,
      start % 60,
    ];
    url.searchParams.set("t", `${hours}h${minutes}m${seconds}s`);
  }
  return url.toString();
}

/**
 * The recording of one finished game: the archive game's own VOD (which opens where the game
 * starts), then the provider's per-game VOD, then a best-of-one series' recorded broadcast.
 */
export function gameReplayUrl(
  match: Pick<Match, "state" | "bestOf" | "broadcasts">,
  game: Pick<SeriesGame, "state" | "vodUrl" | "gameVodUrl">,
): string | null {
  if (game.state !== "finished") return null;
  return (
    recordingUrl(game.gameVodUrl) ??
    recordingUrl(game.vodUrl) ??
    (match.state === "final" && match.bestOf === 1
      ? (match.broadcasts.find(isRecording)?.url ?? null)
      : null)
  );
}
