"use client";
import { ChampionIcon, EmptyState, SearchResult, TextLink, RoleIcon } from "@summonersnet/ui";
import type { BrowseQuery, Match, Game, Identity, Page, SearchHit } from "@summonersnet/data";
import { Filters, Pages, GamesTable } from "./components";
import { identityHref } from "./presentation";
import { MatchSection, useMatchRows } from "./match-group";

const matchSections = [
  { id: "live", label: "Live", states: ["live"] },
  {
    id: "upcoming",
    label: "Upcoming",
    states: ["scheduled", "postponed", "cancelled", "unknown"],
  },
  { id: "past", label: "Past Games", states: ["final"] },
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
  const rows = useMatchRows(hideSpoilers);
  const timezone = query.timezone ?? "UTC";
  return (
    <div className="ev-matches-page np-stack">
      <header className="ev-title">
        <div>
          <h1>Matches</h1>
        </div>
      </header>
      <Filters query={query} />
      {matchSections.map((section) => {
        const sectionItems = data.items.filter((match) =>
          (section.states as readonly string[]).includes(match.state),
        );
        if (!sectionItems.length) return null;
        return (
          <MatchSection
            key={section.id}
            title={section.label}
            matches={sectionItems}
            timezone={timezone}
            now={now}
            {...rows}
          />
        );
      })}
      {!data.items.length && <EmptyState title="No Matches in This View" />}
      <Pages data={data} />
      <TextLink href="/history" variant="accent">
        Browse Past Matches
      </TextLink>
    </div>
  );
}

/** Month headings in the viewer's timezone, in the order the matches arrive. */
function byMonth(matches: Match[], timezone: string) {
  const format = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    month: "long",
    year: "numeric",
  });
  const groups = new Map<string, Match[]>();
  for (const match of matches) {
    const label = match.startsAt ? format.format(new Date(match.startsAt)) : "Date to Be Confirmed";
    groups.set(label, [...(groups.get(label) ?? []), match]);
  }
  return [...groups];
}

function viewHref(query: BrowseQuery, view: "series" | "games") {
  const params = new URLSearchParams();
  if (query.league) params.set("league", query.league);
  if (typeof query.year === "number" || typeof query.year === "string")
    params.set("year", String(query.year));
  if (query.q) params.set("q", query.q);
  if (view === "games") params.set("view", "games");
  const search = params.toString();
  return search ? `/history?${search}` : "/history";
}

export function PastMatchesPage({
  view,
  series,
  games,
  query,
  hideSpoilers,
  now,
}: {
  view: "series" | "games";
  series?: Page<Match>;
  games?: Page<Game>;
  query: BrowseQuery;
  hideSpoilers: boolean;
  now: string;
}) {
  const rows = useMatchRows(hideSpoilers);
  const timezone = query.timezone ?? "UTC";
  return (
    <div className="ev-matches-page np-stack">
      <header className="ev-title">
        <div>
          <h1>Past Matches</h1>
        </div>
      </header>
      <div className="ev-history-toolbar">
        <nav aria-label="Past Matches View" className="ev-tabs ev-tabs--segmented ev-view-switch">
          {(["series", "games"] as const).map((option) => (
            <a
              key={option}
              className="ev-tab"
              href={viewHref(query, option)}
              aria-current={view === option ? "page" : undefined}
            >
              {option === "series" ? "Series" : "Games"}
            </a>
          ))}
        </nav>
        <Filters query={query} history view={view} />
      </div>
      {view === "series" && series ? (
        <>
          {byMonth(series.items, timezone).map(([label, matches]) => (
            <MatchSection
              key={label}
              title={label}
              matches={matches}
              timezone={timezone}
              now={now}
              {...rows}
            />
          ))}
          {!series.items.length && <EmptyState title="No Past Matches in This View" />}
          <Pages data={series} />
        </>
      ) : null}
      {view === "games" && games ? (
        <>
          <GamesTable games={games.items} timezone={timezone} hideSpoilers={rows.spoilersHidden} />
          <Pages data={games} />
        </>
      ) : null}
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
          <h1>{kind === "team" ? "Teams" : "Players"}</h1>
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
            showType={false}
            {...(i.role ? { meta: <RoleIcon role={i.role} /> } : {})}
            href={identityHref(i)}
            {...(i.imageUrl ? { image: i.imageUrl } : {})}
          />
        ))}
      </div>
      {!data.items.length && <EmptyState title="No Identities Found" />}
      <Pages data={data} />
    </div>
  );
}
export function SearchPage({ data, query }: { data: Page<SearchHit>; query: BrowseQuery }) {
  return (
    <div className="np-stack">
      <header className="ev-title">
        <div>
          <h1>Search</h1>
        </div>
      </header>
      <Filters query={query} search />
      {data.items.map((i) =>
        i.kind === "champion" ? (
          <ChampionIcon
            key={i.id}
            id={i.id}
            name={i.name}
            imageUrl={i.imageUrl ?? null}
            href={`/champions/${encodeURIComponent(i.id)}`}
          />
        ) : (
          <SearchResult
            key={i.id}
            name={i.name}
            shortName={i.name}
            type={i.kind === "game" ? "match" : i.kind}
            showType={false}
            href={
              i.kind === "team" || i.kind === "player"
                ? identityHref({ ...i, kind: i.kind })
                : i.kind === "summoner"
                  ? `/summoners/${encodeURIComponent(i.id)}`
                  : `/${i.kind === "game" ? "games" : "matches"}/${encodeURIComponent(i.id)}`
            }
            {...(i.imageUrl ? { image: i.imageUrl } : {})}
          />
        ),
      )}
      {!data.items.length && (
        <EmptyState title={query.q ? "No Results" : "Find a Team, Player or Match"} />
      )}
      <Pages data={data} />
    </div>
  );
}
