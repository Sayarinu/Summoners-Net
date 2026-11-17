"use client";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { Button, EmptyState, Select, StreamEmbedShell } from "@summonersnet/ui";
import type { Broadcast, Match } from "@summonersnet/data";
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
  if (match.state !== "final") return match.broadcasts;
  return match.broadcasts.filter(
    (b) => b.provider === "youtube" || (b.provider === "twitch" && /^v\d+$/.test(b.externalId)),
  );
}

/**
 * YouTube player errors meaning this video will not play inside this page: 100 removed or
 * private, 101 and 150 embedding refused by the owner (LoL Esports allows its replays only on
 * its own site), 153 missing referrer.
 */
const embedRefusedCodes = new Set([100, 101, 150, 153]);
const youtubeOrigin = /^https:\/\/www\.youtube(?:-nocookie)?\.com$/;
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

/**
 * Embeds the selected broadcast as soon as it shows, with autoplay off, so nothing plays until
 * the viewer presses the player's own play button.
 */
export function WatchPlayer({
  broadcasts,
  defaultProvider = "youtube",
  mode = "live",
  showHeading = true,
  showPlayerActions = true,
}: {
  broadcasts: Broadcast[];
  defaultProvider?: Broadcast["provider"];
  mode?: "live" | "replay";
  showHeading?: boolean;
  showPlayerActions?: boolean;
}) {
  const orderedBroadcasts = [...broadcasts].sort(
    (a, b) => Number(b.provider === "youtube") - Number(a.provider === "youtube"),
  );
  const preferredBroadcast = orderedBroadcasts.findIndex(
    (broadcast) => broadcast.provider === defaultProvider,
  );
  const [selected, setSelected] = useState(String(Math.max(0, preferredBroadcast)));
  const [failed, setFailed] = useState(false);
  const [refused, setRefused] = useState(false);
  const frame = useRef<HTMLIFrameElement>(null);
  // The embed needs this page's origin, which only exists in the browser.
  const [origin, setOrigin] = useState<string | null>(null);
  useEffect(() => setOrigin(window.location.origin), []);
  const b = orderedBroadcasts[Number(selected)];
  const src = origin && b ? embedUrl(b, origin) : null;
  const listensForErrors = b?.provider === "youtube" && Boolean(src);
  useEffect(() => {
    if (!listensForErrors) return;
    const onMessage = (event: MessageEvent) => {
      if (!youtubeOrigin.test(event.origin) || event.source !== frame.current?.contentWindow)
        return;
      const code = youtubePlayerError(event.data);
      if (code !== null && embedRefusedCodes.has(code)) setRefused(true);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [listensForErrors, src]);
  if (!b)
    return (
      <EmptyState
        title={mode === "replay" ? "No Replay Available" : "No Broadcast Supplied"}
        description={
          mode === "replay"
            ? "This match has no recorded YouTube or Twitch video."
            : "This match has no available Twitch or YouTube link."
        }
      />
    );
  return (
    <section className="np-stack ev-watch-player" aria-label="Watch Match">
      <div className="np-split">
        {showHeading ? <h2>{mode === "replay" ? "Watch Replay" : "Watch"}</h2> : null}
        <Select
          label="Broadcast"
          value={selected}
          onValueChange={(value) => {
            setSelected(value);
            setFailed(false);
            setRefused(false);
          }}
          options={orderedBroadcasts.map((b, i) => ({
            value: String(i),
            label: providerLabel(b.provider),
          }))}
        />
      </div>
      <StreamEmbedShell
        provider={providerLabel(b.provider)}
        title="Match Player"
        mode={mode}
        state={!origin ? "loading" : failed || !src ? "failed" : "ready"}
        fallbackHref={b.url}
        onRetry={() => setFailed(false)}
      >
        {src && !failed && refused ? (
          <a className="ev-replay-link" href={b.url} target="_blank" rel="noreferrer">
            {/^[\w-]{11}$/.test(b.externalId) ? (
              <img alt="" src={`https://i.ytimg.com/vi/${b.externalId}/hqdefault.jpg`} />
            ) : null}
            <span className="ev-replay-link__copy">
              <span aria-hidden="true" className="ev-replay-link__play">
                ▶
              </span>
              <strong>Watch on {providerLabel(b.provider)}</strong>
              <small>The channel only lets this video play on {providerLabel(b.provider)}.</small>
            </span>
          </a>
        ) : src && !failed ? (
          <iframe
            key={src}
            ref={frame}
            src={src}
            title="Match Broadcast"
            allow="fullscreen; picture-in-picture; encrypted-media"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            onLoad={(event) => {
              // Ask the YouTube player for its events so a refused embed can be detected.
              if (b.provider === "youtube")
                event.currentTarget.contentWindow?.postMessage(
                  JSON.stringify({ event: "listening", id: 1, channel: "widget" }),
                  new URL(src).origin,
                );
            }}
          />
        ) : null}
      </StreamEmbedShell>
      {showPlayerActions ? (
        <div className="np-cluster">
          <Button variant="ghost" onPress={() => setFailed(true)}>
            Player Not Working
          </Button>
        </div>
      ) : null}
    </section>
  );
}
