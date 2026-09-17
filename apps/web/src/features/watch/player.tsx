"use client";
import { useState } from "react";
import {
  Button,
  EmptyState,
  Select,
  StreamConsent,
  StreamEmbedShell,
  TextLink,
} from "@esportsviewer/ui";
import type { Broadcast } from "@esportsviewer/data";
export function embedUrl(b: Broadcast, hostname: string) {
  if (b.provider === "youtube" && /^[\w-]{11}$/.test(b.externalId))
    return `https://www.youtube-nocookie.com/embed/${b.externalId}?autoplay=0`;
  if (b.provider === "twitch" && /^(?:v\d+|[a-zA-Z0-9_]{3,25})$/.test(b.externalId)) {
    const query = new URLSearchParams({
      parent: hostname,
      autoplay: "false",
      [b.externalId.startsWith("v") && /^v\d+$/.test(b.externalId) ? "video" : "channel"]:
        b.externalId,
    });
    return `https://player.twitch.tv/?${query}`;
  }
  return null;
}
export function WatchPlayer({ broadcasts }: { broadcasts: Broadcast[] }) {
  const [selected, setSelected] = useState("0");
  const [consented, setConsented] = useState(false);
  const [failed, setFailed] = useState(false);
  const b = broadcasts[Number(selected)];
  if (!b)
    return (
      <EmptyState
        title="No broadcast supplied"
        description="This match has no Twitch or YouTube link in the source."
      />
    );
  const src = consented ? embedUrl(b, window.location.hostname) : null;
  return (
    <section className="np-stack" aria-label="Watch match">
      <div className="np-split">
        <h2>Watch</h2>
        <Select
          label="Broadcast"
          value={selected}
          onValueChange={(value) => {
            setSelected(value);
            setConsented(false);
            setFailed(false);
          }}
          options={broadcasts.map((b, i) => ({
            value: String(i),
            label: `${b.provider} · ${b.language} · ${i + 1}`,
          }))}
        />
      </div>
      {!consented ? (
        <StreamConsent provider={b.provider} onAccept={() => setConsented(true)} />
      ) : (
        <>
          <StreamEmbedShell
            provider={b.provider}
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
                referrerPolicy="strict-origin-when-cross-origin"
              />
            )}
          </StreamEmbedShell>
          <div className="np-cluster">
            <Button onPress={() => setConsented(false)}>Unload player</Button>
            <Button variant="ghost" onPress={() => setFailed(true)}>
              Player not working
            </Button>
          </div>
        </>
      )}
      <TextLink href={b.url} target="_blank" rel="noreferrer" variant="accent">
        Open on {b.provider}
      </TextLink>
    </section>
  );
}
