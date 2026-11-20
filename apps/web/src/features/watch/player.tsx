"use client";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { EmptyState, Select, StreamEmbedShell } from "@summonersnet/ui";
import type { Broadcast, Match } from "@summonersnet/data";
import { isRecording } from "@summonersnet/data/contracts";
import { playbackLabel, playerPlayback, youtubeOrigin, type Playback } from "./playback";
export function embedUrl(b: Broadcast, siteOrigin: string) {
  const origin = siteOrigin.includes("://") ? siteOrigin : `http://${siteOrigin}`;
  if (b.provider === "youtube" && /^[\w-]{11}$/.test(b.externalId)) {
    const query = new URLSearchParams({ autoplay: "0", enablejsapi: "1", origin });
    return `https://www.youtube-nocookie.com/embed/${b.externalId}?${query}`;
  }
  if (b.provider === "twitch" && /^(?:v\d+|[a-zA-Z0-9_]{3,25})$/.test(b.externalId)) {
    const query = new URLSearchParams({
      parent: new URL(origin).hostname,
      autoplay: "false",
      [b.externalId.startsWith("v") && /^v\d+$/.test(b.externalId) ? "video" : "channel"]:
        b.externalId,
    });
    return `https://player.twitch.tv/?${query}`;
  }
  return null;
}

/**
 * The broadcasts that still show this match. A Twitch channel only plays what is live now, so
 * a finished match keeps its recordings: YouTube videos (a YouTube live stream keeps its ID as
 * a VOD) and Twitch videos.
 */
export function watchableBroadcasts(match: Pick<Match, "broadcasts" | "state">) {
  const seen = new Set<string>();
  return match.broadcasts.filter((broadcast) => {
    if (match.state === "final" && !isRecording(broadcast)) return false;
    const id = `${broadcast.provider}:${broadcast.externalId || broadcast.url}`;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

/**
 * YouTube player errors meaning this video will not play inside this page: 100 removed or
 * private, 101 and 150 embedding refused by the owner (LoL Esports allows its replays only on
 * its own site), 153 missing referrer.
 */
const embedRefusedCodes = new Set([100, 101, 150, 153]);
const youtubeErrorSchema = z.object({ event: z.literal("onError"), info: z.number() });

/** The error code in a YouTube player message, or null for any other message. */
export function youtubePlayerError(data: unknown): number | null {
  try {
    const parsed = youtubeErrorSchema.safeParse(typeof data === "string" ? JSON.parse(data) : data);
    return parsed.success ? parsed.data.info : null;
  } catch {
    return null;
  }
}

function providerLabel(provider: Broadcast["provider"]) {
  return provider === "youtube" ? "YouTube" : "Twitch";
}

const languageNames = new Intl.DisplayNames("en", { type: "language", fallback: "none" });
function broadcastLabel(broadcast: Broadcast) {
  const provider = providerLabel(broadcast.provider);
  const language = broadcast.language.trim();
  if (!language || /^(unknown|und)$/i.test(language)) return provider;
  try {
    return `${provider} · ${languageNames.of(language.replaceAll("_", "-")) ?? language}`;
  } catch {
    return `${provider} · ${language}`;
  }
}

/**
 * Embeds the selected broadcast as soon as it shows, with autoplay off, so nothing plays until
 * the viewer presses the player's own play button.
 */
export function WatchPlayer({
  broadcasts,
  defaultProvider = "youtube",
  mode = "live",
  showHeading = true,
  compact = false,
  beside = false,
}: {
  broadcasts: Broadcast[];
  defaultProvider?: Broadcast["provider"];
  mode?: "live" | "replay";
  showHeading?: boolean;
  compact?: boolean;
  /** Puts the broadcast picker beside the player on wide screens, as under a match row. */
  beside?: boolean;
}) {
  const orderedBroadcasts = [...broadcasts].sort(
    (a, b) => Number(b.provider === "youtube") - Number(a.provider === "youtube"),
  );
  const preferredBroadcast = orderedBroadcasts.findIndex(
    (broadcast) => broadcast.provider === defaultProvider,
  );
  const [selected, setSelected] = useState(String(Math.max(0, preferredBroadcast)));
  const [refused, setRefused] = useState(false);
  // What the embedded player last reported; null until it reports anything.
  const [playback, setPlayback] = useState<Playback | "blocked" | null>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  // The embed needs this page's origin, which only exists in the browser.
  const [origin, setOrigin] = useState<string | null>(null);
  useEffect(() => setOrigin(window.location.origin), []);
  const b = orderedBroadcasts[Number(selected)];
  const src = origin && b ? embedUrl(b, origin) : null;
  const provider = b?.provider;
  useEffect(() => {
    if (!src || !provider) return;
    setPlayback(null);
    const onMessage = (event: MessageEvent) => {
      if (event.source !== frame.current?.contentWindow) return;
      if (provider === "youtube" && youtubeOrigin.test(event.origin)) {
        const code = youtubePlayerError(event.data);
        if (code !== null && embedRefusedCodes.has(code)) setRefused(true);
      }
      const state = playerPlayback(provider, event.origin, event.data);
      if (state) setPlayback(state);
    };
    window.addEventListener("message", onMessage);
    // A Twitch player that never reports was blocked before it loaded: offer Twitch itself.
    const silent =
      provider === "twitch"
        ? window.setTimeout(() => setPlayback((state) => (state ? state : "blocked")), 10_000)
        : undefined;
    return () => {
      window.removeEventListener("message", onMessage);
      window.clearTimeout(silent);
    };
  }, [provider, src]);
  if (!b)
    return (
      <EmptyState title={mode === "replay" ? "No Replay Available" : "No Broadcast Supplied"} />
    );
  const labels = orderedBroadcasts.map(broadcastLabel);
  const streamSelect =
    !compact || orderedBroadcasts.length > 1 ? (
      <Select
        label={compact ? "Stream" : "Broadcast"}
        hideLabel={compact}
        value={selected}
        onValueChange={(value) => {
          setSelected(value);
          setRefused(false);
          setPlayback(null);
        }}
        options={orderedBroadcasts.map((broadcast, index) => {
          const label = labels[index]!;
          return {
            value: String(index),
            label:
              labels.indexOf(label) === labels.lastIndexOf(label)
                ? label
                : `${label} · ${broadcast.externalId || broadcast.url}`,
          };
        })}
      />
    ) : null;
  return (
    <section
      className={
        beside
          ? "mx-auto grid w-full max-w-[780px] grid-cols-[minmax(0,560px)_minmax(160px,200px)] items-start gap-4 max-[850px]:max-w-[560px] max-[850px]:grid-cols-1"
          : `flex flex-col ${compact ? "gap-2" : "gap-4"}`
      }
      aria-label="Watch Match"
    >
      {!compact ? (
        <div
          className={
            beside
              ? "col-start-2 row-start-1 grid content-start gap-3 max-[850px]:col-start-1"
              : "flex flex-wrap items-center justify-between gap-4"
          }
        >
          {showHeading ? (
            <h2 className="text-lg font-medium">{mode === "replay" ? "Watch Replay" : "Watch"}</h2>
          ) : null}
          {streamSelect}
        </div>
      ) : null}
      <div
        className={beside ? "col-start-1 row-start-1 min-w-0 max-[850px]:row-start-2" : "contents"}
      >
        <StreamEmbedShell
          provider={providerLabel(b.provider)}
          title="Match Player"
          compact={compact}
          mode={mode}
          state={!origin ? "loading" : !src ? "failed" : "ready"}
          fallbackHref={b.url}
        >
          {src && (refused || playback === "blocked") ? (
            <a
              className="group absolute inset-0 grid place-items-center overflow-hidden bg-canvas text-fg no-underline"
              href={b.url}
              target="_blank"
              rel="noreferrer"
            >
              {b.provider === "youtube" && /^[\w-]{11}$/.test(b.externalId) ? (
                <img
                  className="absolute inset-0 size-full object-cover opacity-45"
                  alt=""
                  src={`https://i.ytimg.com/vi/${b.externalId}/hqdefault.jpg`}
                />
              ) : null}
              <span className="relative grid justify-items-center gap-2 p-4 text-center [text-shadow:0_1px_4px_rgb(0_0_0/85%)]">
                <span
                  aria-hidden="true"
                  className="grid size-16 place-items-center rounded-full bg-accent text-xl text-canvas group-hover:scale-106 group-focus-visible:scale-106"
                >
                  ▶
                </span>
                <strong>Watch on {providerLabel(b.provider)}</strong>
              </span>
            </a>
          ) : src ? (
            <iframe
              key={src}
              ref={frame}
              src={src}
              title="Match Broadcast"
              allow="fullscreen; picture-in-picture; encrypted-media"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
              onLoad={(event) => {
                // Ask the YouTube player for its events: playback state, and a refused embed.
                if (b.provider === "youtube")
                  event.currentTarget.contentWindow?.postMessage(
                    JSON.stringify({ event: "listening", id: 1, channel: "widget" }),
                    new URL(src).origin,
                  );
              }}
            />
          ) : null}
        </StreamEmbedShell>
        {playback && playback !== "blocked" && !refused ? (
          <p role="status" className="mt-2 font-mono text-xs text-fg-muted">
            {playbackLabel(playback, providerLabel(b.provider))}
            {b.provider === "twitch" && !b.externalId.startsWith("v") ? ` · ${b.externalId}` : ""}
          </p>
        ) : null}
      </div>
      {compact && streamSelect ? <div className="max-w-full self-end">{streamSelect}</div> : null}
    </section>
  );
}
