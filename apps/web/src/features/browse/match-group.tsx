"use client";
import { useEffect, useState } from "react";
import { MatchRow } from "@summonersnet/ui";
import type { Match } from "@summonersnet/data";
import { InlineMatchStream } from "./inline-stream";
import { watchableBroadcasts } from "../watch/player";
import { matchDisplay } from "./presentation";
import { preferencesChangedEvent } from "../preferences/model";

/** Follows the saved spoiler preference, including changes made on another page or tab. */
export function useSpoilerPreference(hideSpoilers: boolean) {
  const [spoilersHidden, setSpoilersHidden] = useState(hideSpoilers);
  useEffect(() => setSpoilersHidden(hideSpoilers), [hideSpoilers]);
  useEffect(() => {
    const onPreferencesChanged = (event: Event) => {
      const next = (event as CustomEvent<{ hideSpoilers?: unknown }>).detail;
      if (typeof next?.hideSpoilers === "boolean") setSpoilersHidden(next.hideSpoilers);
    };
    window.addEventListener(preferencesChangedEvent, onPreferencesChanged);
    return () => window.removeEventListener(preferencesChangedEvent, onPreferencesChanged);
  }, []);
  return spoilersHidden;
}

/** A titled group of flat match rows, shared by the schedule and past matches. */
export function MatchSection({
  title,
  teamId,
  matches,
  timezone,
  now,
  spoilersHidden,
  revealed,
  onReveal,
  openStreamId,
  onStreamToggle,
}: {
  title: string;
  teamId?: string;
  matches: Match[];
  timezone: string;
  now: string;
  spoilersHidden: boolean;
  revealed: readonly string[];
  onReveal: (id: string) => void;
  openStreamId: string | null;
  onStreamToggle: (id: string) => void;
}) {
  return (
    <section className="ev-match-section">
      <h2>{title}</h2>
      <div className="ev-match-group">
        {matches.map((match) => {
          const streamOpen = openStreamId === match.id;
          const watchLabel = match.state === "live" ? "Watch Live" : "Watch";
          const streamPanelId = `match-stream-${match.id.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
          const team = teamId
            ? match.teams.find((t) => (t.entityId ?? t.id) === teamId)
            : undefined;
          const opponent = match.teams.find((t) => t !== team);
          const hidden = spoilersHidden && !revealed.includes(match.id);
          const outcome =
            !hidden && team?.score != null && opponent?.score != null
              ? team.score > opponent.score
                ? "Win"
                : team.score < opponent.score
                  ? "Loss"
                  : "Draw"
              : null;
          return (
            <div key={match.id}>
              <MatchRow
                match={matchDisplay(match, timezone, now)}
                spoilerHidden={hidden}
                statusLabel={
                  outcome && (
                    <strong className={`ev-outcome ev-outcome--${outcome.toLowerCase()}`}>
                      {outcome}
                    </strong>
                  )
                }
                onSpoilerReveal={() => onReveal(match.id)}
                streamAction={
                  watchableBroadcasts(match).length > 0 ? (
                    <button
                      aria-controls={streamOpen ? streamPanelId : undefined}
                      aria-expanded={streamOpen}
                      aria-label={streamOpen ? "Close Stream" : watchLabel}
                      className="ev-watch-toggle"
                      onClick={() => onStreamToggle(match.id)}
                      type="button"
                    >
                      {watchLabel}
                    </button>
                  ) : undefined
                }
                expandedContent={
                  streamOpen ? <InlineMatchStream match={match} id={streamPanelId} /> : undefined
                }
              />
              {!teamId &&
                new Date(now).valueOf() - new Date(match.updatedAt).valueOf() >
                  (match.state === "live" ? 300000 : 1200000) && (
                  <p className="ev-row-note">Saved observation · refresh overdue</p>
                )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

/** Row state shared by every section on a page: revealed results and the one open stream. */
export function useMatchRows(hideSpoilers: boolean) {
  const [revealed, setRevealed] = useState<string[]>([]);
  const [openStreamId, setOpenStreamId] = useState<string | null>(null);
  const spoilersHidden = useSpoilerPreference(hideSpoilers);
  return {
    spoilersHidden,
    revealed,
    onReveal: (id: string) => setRevealed((current) => [...current, id]),
    openStreamId,
    onStreamToggle: (id: string) => setOpenStreamId((current) => (current === id ? null : id)),
  };
}
