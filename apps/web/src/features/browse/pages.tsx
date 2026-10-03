"use client";
import { useEffect, useState } from "react";
import { MatchRow, EmptyState, SearchResult, TextLink } from "@esportsviewer/ui";
import type { BrowseQuery, Match, Game, Identity, Page, SearchHit } from "@esportsviewer/data";
import { Filters, Pages, GamesTable } from "./components";
import { InlineMatchStream } from "./inline-stream";
import { identityHref, localDate, matchDisplay } from "./presentation";
import { preferencesChangedEvent } from "../preferences/model";

const matchSections = [
  { id: "live", label: "Live", states: ["live"] },
  {
    id: "upcoming",
    label: "Upcoming",
    states: ["scheduled", "postponed", "cancelled", "unknown"],
  },
  { id: "past", label: "Past games", states: ["final"] },
] as const;

export function MatchesPage({
  data,
  query,
  hideSpoilers,
  now,
}: {
  data: Page<Match>;
  query: BrowseQuery;
  hideSpoilers: boolean;
  now: string;
}) {
  const [revealed, setRevealed] = useState<string[]>([]);
  const [spoilersHidden, setSpoilersHidden] = useState(hideSpoilers);
  const [openStreamId, setOpenStreamId] = useState<string | null>(null);
  const timezone = query.timezone ?? "UTC";
  useEffect(() => setSpoilersHidden(hideSpoilers), [hideSpoilers]);
  useEffect(() => {
    const onPreferencesChanged = (event: Event) => {
      const next = (event as CustomEvent<{ hideSpoilers?: unknown }>).detail;
      if (typeof next?.hideSpoilers === "boolean") setSpoilersHidden(next.hideSpoilers);
    };
    window.addEventListener(preferencesChangedEvent, onPreferencesChanged);
    return () => window.removeEventListener(preferencesChangedEvent, onPreferencesChanged);
  }, []);
  return (
    <div className="ev-matches-page np-stack">
      <header className="ev-title">
        <h1>Matches</h1>
      </header>
      <Filters query={query} />
      {matchSections.map((section) => {
        const sectionItems = data.items.filter((match) =>
          (section.states as readonly string[]).includes(match.state),
        );
        if (!sectionItems.length) return null;
        const groups = Object.groupBy(sectionItems, (match) =>
          match.startsAt ? localDate(match.startsAt, timezone) : "Date to be confirmed",
        );
        return (
          <section key={section.id} className="ev-match-section">
            <h2>{section.label}</h2>
            {Object.entries(groups).map(([date, items]) => (
              <section key={date} className="ev-match-group">
                <h3>{date}</h3>
                {items?.map((match) => {
                  const streamOpen = openStreamId === match.id;
                  const streamPanelId = `match-stream-${match.id.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
                  return (
                    <div key={match.id}>
                      <MatchRow
                        match={matchDisplay(match, timezone, now)}
                        spoilerHidden={spoilersHidden && !revealed.includes(match.id)}
                        onSpoilerReveal={() => setRevealed([...revealed, match.id])}
                        streamAction={
                          match.broadcasts.length > 0 ? (
                            <button
                              aria-controls={streamOpen ? streamPanelId : undefined}
                              aria-expanded={streamOpen}
                              aria-label={streamOpen ? "Close Stream" : "Watch Live"}
                              className="ev-watch-toggle"
                              onClick={() =>
                                setOpenStreamId((current) =>
                                  current === match.id ? null : match.id,
                                )
                              }
                              type="button"
                            >
                              Watch Live
                            </button>
                          ) : undefined
                        }
                        expandedContent={
                          streamOpen ? (
                            <InlineMatchStream broadcasts={match.broadcasts} id={streamPanelId} />
                          ) : undefined
                        }
                      />
                      {new Date(now).valueOf() - new Date(match.updatedAt).valueOf() >
                        (match.state === "live" ? 300000 : 1200000) && (
                        <p className="ev-row-note">Saved observation · refresh overdue</p>
                      )}
                    </div>
                  );
                })}
              </section>
            ))}
          </section>
        );
      })}
      {!data.items.length && (
        <EmptyState
          title="No matches in this view"
          description="Try another date or league. Refreshes are processed by the local synchronization worker."
        />
      )}
      <Pages data={data} />
      <p className="np-body-sm">
        Looking further back?{" "}
        <TextLink href="/history" variant="accent">
          Browse the game archive
        </TextLink>
      </p>
    </div>
  );
}
export function HistoryPage({ data, query }: { data: Page<Game>; query: BrowseQuery }) {
  return (
    <div className="np-stack">
      <header className="ev-title">
        <div>
          <span className="np-overline">Historical records</span>
          <h1>Game archive</h1>
          <p className="np-body-sm">
            Played lineups and basic statistics, from 2014 onward where imported.
          </p>
        </div>
        <TextLink href="/sources">Manage imports</TextLink>
      </header>
      <Filters query={query} history />
      <GamesTable games={data.items} timezone={query.timezone ?? "UTC"} />
      <Pages data={data} />
    </div>
  );
}
export function DirectoryPage({
  data,
  query,
  kind,
}: {
  data: Page<Identity>;
  query: BrowseQuery;
  kind: "team" | "player";
}) {
  return (
    <div className="np-stack">
      <header className="ev-title">
        <div>
          <span className="np-overline">Your library</span>
          <h1>{kind === "team" ? "Teams" : "Players"}</h1>
          <p className="np-body-sm">
            Recently active {kind === "team" ? "teams" : "players"} appear first. Search includes
            historical names and appearances.
          </p>
        </div>
      </header>
      <Filters query={query} search />
      <div>
        {data.items.map((i) => (
          <SearchResult
            key={i.id}
            name={i.name}
            shortName={i.name}
            type={i.kind}
            href={identityHref(i)}
            {...(i.imageUrl ? { image: i.imageUrl } : {})}
          />
        ))}
      </div>
      {!data.items.length && (
        <EmptyState
          title="No identities found"
          description="Try another name or import historical games."
        />
      )}
      <Pages data={data} />
    </div>
  );
}
export function SearchPage({ data, query }: { data: Page<SearchHit>; query: BrowseQuery }) {
  return (
    <div className="np-stack">
      <header className="ev-title">
        <div>
          <span className="np-overline">Across your library</span>
          <h1>Search</h1>
        </div>
      </header>
      <Filters query={query} search />
      {data.items.map((i) => (
        <SearchResult
          key={i.id}
          name={i.name}
          shortName={i.name}
          type={i.kind === "game" ? "match" : i.kind}
          href={
            i.kind === "team" || i.kind === "player"
              ? identityHref({ ...i, kind: i.kind })
              : `/${i.kind === "game" ? "games" : "matches"}/${encodeURIComponent(i.id)}`
          }
          {...(i.imageUrl ? { image: i.imageUrl } : {})}
        />
      ))}
      {!data.items.length && (
        <EmptyState
          title={query.q ? "No results" : "Find a team, player or match"}
          description="Search a team, player, match or historical game ID."
        />
      )}
      <Pages data={data} />
    </div>
  );
}
