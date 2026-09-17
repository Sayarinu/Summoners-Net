"use client";
import { useState } from "react";
import { MatchRow, EmptyState, SearchResult, TextLink } from "@esportsviewer/ui";
import type {
  BrowseQuery,
  Match,
  Game,
  Identity,
  Page,
  SearchHit,
  SourceStatus,
} from "@esportsviewer/data";
import { Filters, Pages, GamesTable } from "./components";
import { identityHref, localDate, matchDisplay, dateTime } from "./presentation";
import { RefreshButton } from "../sources/refresh";
export function MatchesPage({
  data,
  query,
  hideSpoilers,
  now,
  source,
}: {
  data: Page<Match>;
  query: BrowseQuery;
  hideSpoilers: boolean;
  now: string;
  source: SourceStatus | undefined;
}) {
  const [revealed, setRevealed] = useState<string[]>([]);
  const timezone = query.timezone ?? "UTC";
  const groups = Object.groupBy(
    data.items,
    (m) => `${m.startsAt ? localDate(m.startsAt, timezone) : "Unscheduled"} · ${m.league}`,
  );
  return (
    <div className="np-stack">
      <header className="ev-title">
        <div>
          <span className="np-overline">League of Legends</span>
          <h1>Matches</h1>
          <p className="np-body-sm">Schedules, live status and results · {timezone}</p>
        </div>
        <RefreshButton kind="matches" />
      </header>
      <Filters query={query} />
      <p className="ev-source-line">
        PandaScore ·{" "}
        {source?.lastSuccess
          ? `Last received ${dateTime(source.lastSuccess, timezone)}`
          : "No successful refresh yet"}
        {source?.error ? ` · ${source.error}` : ""}
      </p>
      {Object.entries(groups).map(([name, items]) => (
        <section key={name} className="ev-match-group">
          <h2>{name}</h2>
          {items?.map((match) => (
            <div key={match.id}>
              <MatchRow
                match={matchDisplay(match, timezone, now)}
                spoilerHidden={hideSpoilers && !revealed.includes(match.id)}
                onSpoilerReveal={() => setRevealed([...revealed, match.id])}
              />
              {new Date(now).valueOf() - new Date(match.updatedAt).valueOf() >
                (match.state === "live" ? 300000 : 1200000) && (
                <p className="ev-row-note">Saved observation · refresh overdue</p>
              )}
            </div>
          ))}
        </section>
      ))}
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
          <span className="np-overline">Oracle’s Elixir</span>
          <h1>Game archive</h1>
          <p className="np-body-sm">
            Played lineups and basic statistics, from 2014 onward where imported.
          </p>
        </div>
        <TextLink href="/sources">Import & coverage</TextLink>
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
            Current observations and historical appearances, linked where lineup evidence agrees.
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
            description={
              i.sourceCount === 2 ? "Linked Oracle + PandaScore" : `${i.source} · ${i.sourceId}`
            }
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
          description={`${i.kind} · ${i.detail}`}
          {...(i.imageUrl ? { image: i.imageUrl } : {})}
        />
      ))}
      {!data.items.length && (
        <EmptyState
          title={query.q ? "No results" : "Find a team, player or match"}
          description="Search source names or paste a historical game ID."
        />
      )}
      <Pages data={data} />
    </div>
  );
}
