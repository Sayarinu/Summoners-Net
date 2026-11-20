import { z } from "zod";

/** What an embedded player reports about itself. */
export type Playback = "ready" | "playing" | "paused" | "buffering" | "ended" | "offline";

export const youtubeOrigin = /^https:\/\/www\.youtube(?:-nocookie)?\.com$/;
export const twitchOrigin = "https://player.twitch.tv";

// YouTube's IFrame API states: -1 unstarted, 0 ended, 1 playing, 2 paused, 3 buffering, 5 cued.
const youtubeStates: Record<number, Playback> = {
  [-1]: "ready",
  0: "ended",
  1: "playing",
  2: "paused",
  3: "buffering",
  5: "ready",
};
const youtubeMessage = z.union([
  z.object({ event: z.literal("onReady") }),
  z.object({ event: z.literal("onStateChange"), info: z.number() }),
  z.object({
    event: z.literal("infoDelivery"),
    info: z.object({ playerState: z.number().optional() }).loose(),
  }),
]);
// The Twitch player reports its state with every update and announces a few events by name.
const twitchStates: Record<string, Playback> = {
  Idle: "ready",
  Ready: "ready",
  Playing: "playing",
  Paused: "paused",
  Buffering: "buffering",
  Ended: "ended",
};
const twitchEvents: Record<string, Playback> = {
  ready: "ready",
  "video.ready": "ready",
  play: "playing",
  playing: "playing",
  pause: "paused",
  ended: "ended",
  offline: "offline",
};
const twitchMessage = z.union([
  z.object({
    eventName: z.literal("UPDATE_STATE"),
    params: z.object({ playback: z.string() }).loose(),
  }),
  z.object({ namespace: z.literal("twitch-embed"), eventName: z.string() }),
]);

function decode(data: unknown): unknown {
  if (typeof data !== "string") return data;
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

/**
 * The playback state in a message from an embedded player, or null when the message says nothing
 * about playback. Only messages from the provider's own origin count.
 */
export function playerPlayback(
  provider: "youtube" | "twitch",
  origin: string,
  data: unknown,
): Playback | null {
  const message = decode(data);
  if (provider === "youtube") {
    if (!youtubeOrigin.test(origin)) return null;
    const parsed = youtubeMessage.safeParse(message);
    if (!parsed.success) return null;
    if (parsed.data.event === "onReady") return "ready";
    const state =
      parsed.data.event === "onStateChange" ? parsed.data.info : parsed.data.info.playerState;
    return state === undefined ? null : (youtubeStates[state] ?? null);
  }
  if (origin !== twitchOrigin) return null;
  const parsed = twitchMessage.safeParse(message);
  if (!parsed.success) return null;
  return "params" in parsed.data
    ? (twitchStates[parsed.data.params.playback] ?? null)
    : (twitchEvents[parsed.data.eventName] ?? null);
}

/** A short line naming what the player is doing, such as "Playing on Twitch". */
export function playbackLabel(playback: Playback, provider: string) {
  return {
    ready: `Ready on ${provider}`,
    playing: `Playing on ${provider}`,
    paused: `Paused on ${provider}`,
    buffering: `Buffering on ${provider}`,
    ended: `Ended on ${provider}`,
    offline: `Channel offline on ${provider}`,
  }[playback];
}
