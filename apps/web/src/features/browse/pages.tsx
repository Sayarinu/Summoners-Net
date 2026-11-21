"use client";
import {
  ChampionIcon,
  EmptyState,
  PageHeader,
  Panel,
  SearchResult,
  TabNav,
  TextLink,
} from "@summonersnet/ui";
import type { BrowseQuery, Match, Game, Page, SearchHit } from "@summonersnet/data";
import { Filters, Pages, GamesTable } from "./components";
import { searchHitHref } from "./presentation";
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
    <div className="flex flex-col gap-6">
      <PageHeader title="Matches" />
      <Filters query={query} className="border-y border-line py-4" />
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
      <Pages
        data={data}
        afterCount={
          <TextLink href="/history" variant="accent">
            Browse Past Matches
          </TextLink>
        }
      />
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
    <div className="flex flex-col gap-6">
      <PageHeader title="Past Matches" />
      <div className="flex flex-wrap items-end gap-x-6 gap-y-3 border-y border-line py-3">
        <Filters query={query} history view={view} className="flex-[1_1_440px]" />
        {/* The view switch trails the filters, at the right like other pages' controls. */}
        <TabNav
          label="Past Matches View"
          variant="segmented"
          className="self-end"
          items={(["series", "games"] as const).map((option) => ({
            href: viewHref(query, option),
            label: option === "series" ? "Series" : "Games",
            current: view === option,
          }))}
        />
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
          <GamesTable
            games={games.items}
            timezone={timezone}
            hideSpoilers={rows.spoilersHidden}
            pastMatches
          />
          <Pages data={games} />
        </>
      ) : null}
    </div>
  );
}
export function SearchPage({ data, query }: { data: Page<SearchHit>; query: BrowseQuery }) {
  return (
    <div className="mx-auto flex w-full max-w-content min-w-0 flex-col gap-6">
      <PageHeader
        title="Search"
        {...(query.q
          ? {
              eyebrow: `“${query.q}” · ${data.total.toLocaleString()} ${data.total === 1 ? "Result" : "Results"}`,
            }
          : {})}
      />
      {data.items.length ? (
        <Panel title="Results" padding="none">
          <ul className="flex list-none flex-col">
            {data.items.map((i) => (
              <li key={i.id} className="px-2 py-1">
                {i.kind === "champion" ? (
                  <span className="flex items-center gap-3 px-2 py-2">
                    <ChampionIcon
                      id={i.id}
                      name={i.name}
                      imageUrl={i.imageUrl ?? null}
                      href={searchHitHref(i)}
                    />
                    <span className="flex flex-col">
                      <span className="font-medium">{i.name}</span>
                      <small className="text-xs text-fg-muted">{i.detail}</small>
                    </span>
                  </span>
                ) : (
                  <SearchResult
                    name={i.name}
                    shortName={i.name}
                    type={i.kind === "game" ? "match" : i.kind}
                    showType={false}
                    href={searchHitHref(i)}
                    {...(i.detail ? { description: i.detail } : {})}
                    {...(i.imageUrl ? { image: i.imageUrl } : {})}
                  />
                )}
              </li>
            ))}
          </ul>
          <div className="px-4">
            <Pages data={data} />
          </div>
        </Panel>
      ) : (
        <>
          <EmptyState title={query.q ? "No Results" : "Find a Team, Player or Match"} />
          <Pages data={data} />
        </>
      )}
    </div>
  );
}
