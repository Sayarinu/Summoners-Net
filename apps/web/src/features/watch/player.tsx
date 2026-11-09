"use client";
import { useState } from "react";
import {
  Button,
  EmptyState,
  Select,
  StreamConsent,
  StreamEmbedShell,
  TextLink,
} from "@summonersnet/ui";
import type { Broadcast } from "@summonersnet/data";
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

function providerLabel(provider: Broadcast["provider"]) {
  return provider === "youtube" ? "YouTube" : "Twitch";
}

export function WatchPlayer({
  broadcasts,
  defaultProvider = "youtube",
  showHeading = true,
  showPlayerActions = true,
  showPreConsentLink = true,
}: {
  broadcasts: Broadcast[];
  defaultProvider?: Broadcast["provider"];
  showHeading?: boolean;
  showPlayerActions?: boolean;
  showPreConsentLink?: boolean;
}) {
  const orderedBroadcasts = [...broadcasts].sort(
    (a, b) => Number(b.provider === "youtube") - Number(a.provider === "youtube"),
  );
  const preferredBroadcast = orderedBroadcasts.findIndex(
    (broadcast) => broadcast.provider === defaultProvider,
  );
  const [selected, setSelected] = useState(String(Math.max(0, preferredBroadcast)));
  const [consented, setConsented] = useState(false);
  const [failed, setFailed] = useState(false);
  const b = orderedBroadcasts[Number(selected)];
  if (!b)
    return (
      <EmptyState
        title="No broadcast supplied"
        description="This match has no available Twitch or YouTube link."
      />
    );
  const src = consented ? embedUrl(b, window.location.origin) : null;
  return (
    <section className="np-stack ev-watch-player" aria-label="Watch match">
      <div className="np-split">
        {showHeading ? <h2>Watch</h2> : null}
        <Select
          label="Broadcast"
          value={selected}
          onValueChange={(value) => {
            setSelected(value);
            setConsented(false);
            setFailed(false);
          }}
          options={orderedBroadcasts.map((b, i) => ({
            value: String(i),
            label: providerLabel(b.provider),
          }))}
        />
      </div>
      {!consented ? (
        <StreamConsent provider={providerLabel(b.provider)} onAccept={() => setConsented(true)} />
      ) : (
        <>
          <StreamEmbedShell
            provider={providerLabel(b.provider)}
            title="Match player"
            state={failed || !src ? "failed" : "ready"}
            fallbackHref={b.url}
            onRetry={() => setFailed(false)}
          >
            {src && !failed && (
              <iframe
                key={src}
                src={src}
                title="Match broadcast"
                allow="fullscreen; picture-in-picture"
                allowFullScreen
                referrerPolicy="no-referrer-when-downgrade"
              />
            )}
          </StreamEmbedShell>
          {showPlayerActions ? (
            <div className="np-cluster">
              <Button onPress={() => setConsented(false)}>Unload player</Button>
              <Button variant="ghost" onPress={() => setFailed(true)}>
                Player not working
              </Button>
            </div>
          ) : null}
        </>
      )}
      {!consented && showPreConsentLink ? (
        <TextLink href={b.url} target="_blank" rel="noreferrer" variant="accent">
          Open on {providerLabel(b.provider)} <span aria-hidden="true">↗</span>
        </TextLink>
      ) : null}
    </section>
  );
}
