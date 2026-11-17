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

export function gameReplayUrl(
  match: Pick<Match, "state" | "bestOf" | "broadcasts">,
  game: Pick<SeriesGame, "state" | "vodUrl">,
): string | null {
  if (game.state !== "finished") return null;
  return (
    recordingUrl(game.vodUrl) ??
    (match.state === "final" && match.bestOf === 1
      ? (match.broadcasts.find(isRecording)?.url ?? null)
      : null)
  );
}
