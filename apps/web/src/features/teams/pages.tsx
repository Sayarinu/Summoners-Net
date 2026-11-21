"use client";
import type { TeamStatistics } from "@summonersnet/data/contracts";
import { TeamStatisticsPanel } from "./statistics";
import { useState } from "react";
import type {
  BrowseQuery,
  Match,
  Page,
  Profile,
  TeamDirectoryEntry,
  TeamSeason,
} from "@summonersnet/data";
import { roleKey } from "@summonersnet/data/contracts";
import {
  Button,
  Card,
  EmptyState,
  PageHeader,
  Panel,
  PlayerIdentity,
  Stat,
  StatGroup,
  TabNav,
  TeamIdentity,
} from "@summonersnet/ui";
import { Filters, GamesTable, Pages } from "../browse/components";
import { MatchSection, useMatchRows } from "../browse/match-group";
import { FillingGrid } from "../browse/page-fill";
import { identityHref } from "../browse/presentation";
import { ChampionPortrait, GameRecord, type ChampionPortraits } from "../browse/visuals";

export function TeamFinder({
  data,
  query,
}: {
  data: Page<TeamDirectoryEntry>;
  query: BrowseQuery;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-6">
      <PageHeader title="Teams" />
      <Filters teams query={query} className="border-y border-line py-3" />
      {data.items.length ? (
        <FillingGrid
          className={directoryGrid}
          label="Teams"
          page={data.page}
          pageSize={data.pageSize}
          total={data.total}
        >
          {data.items.map((t) => (
            <li key={t.id}>
              <Card href={identityHref(t)}>
                <TeamIdentity
                  name={t.name}
                  shortName={t.name}
                  size="large"
                  {...(t.league ? { detail: t.league } : {})}
                  {...(t.imageUrl ? { logo: t.imageUrl } : {})}
                />
              </Card>
            </li>
          ))}
        </FillingGrid>
      ) : (
        <EmptyState title="No Teams Found" />
      )}
      <Pages data={data} />
    </div>
  );
}

/** Whole rows of cards that fill the content width; FillingGrid sizes pages from these columns. */
export const directoryGrid =
  "grid list-none auto-rows-fr grid-cols-4 gap-3 min-[1600px]:grid-cols-6 max-[1150px]:grid-cols-3 max-[900px]:grid-cols-2 max-[600px]:grid-cols-1";

const roles = ["top", "jungle", "mid", "bottom", "support"];
function Roster({ roster }: { roster: Profile["roster"] }) {
  const players = roster
    .map((r) => ({ player: r.player, role: roleKey(r.player.role?.toLowerCase() ?? null) }))
    .sort(
      (a, b) =>
        (a.role ? roles.indexOf(a.role) : roles.length) -
          (b.role ? roles.indexOf(b.role) : roles.length) ||
        a.player.name.localeCompare(b.player.name),
    );
  return (
    <Panel title="Current Roster">
      {players.length ? (
        <ul className="grid list-none grid-cols-[repeat(auto-fit,minmax(92px,1fr))] gap-3">
          {players.map(({ player, role }) => (
            <li key={player.id}>
              <PlayerIdentity
                layout="stacked"
                handle={player.name}
                href={identityHref(player)}
                {...(role ? { role } : {})}
                {...(player.imageUrl ? { portrait: player.imageUrl } : {})}
              />
            </li>
          ))}
        </ul>
      ) : (
        <p>No current roster is available.</p>
      )}
    </Panel>
  );
}

/** The most-played champions first, expandable to the whole pool. */
export function ChampionPool({
  champions,
  portraits,
}: {
  champions: Profile["summary"]["champions"];
  portraits?: ChampionPortraits | undefined;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <Panel
      title="Champion Pool"
      actions={
        champions.length > 5 && (
          <Button size="compact" onPress={() => setExpanded(!expanded)}>
            {expanded ? "Show Fewer Champions" : "Show All Champions"}
          </Button>
        )
      }
    >
      <ul className="grid list-none grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3">
        {(expanded ? champions : champions.slice(0, 5)).map((c) => (
          <li key={c.name} className="flex items-center justify-between gap-2 rounded-md p-3">
            <ChampionPortrait name={c.name} portraits={portraits} />
            <span>
              <GameRecord wins={c.wins} known={c.resultGames} total={c.games} />
            </span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

export function TeamProfile({
  profile,
  portraits,
  seasons,
  query,
  series,
  now,
  hideSpoilers,
  statistics,
}: {
  profile: Profile;
  portraits?: ChampionPortraits;
  seasons: TeamSeason[];
  query: BrowseQuery;
  series: Page<Match> | null;
  now: string;
  hideSpoilers: boolean;
  /** Side records, game lengths and objective control; omitted where not loaded. */
  statistics?: TeamStatistics;
}) {
  const { identity, summary, roster, games } = profile;
  const rows = useMatchRows(hideSpoilers);
  const [revealed, setRevealed] = useState(false);
  const hidden = rows.spoilersHidden && !revealed;
  const league = (
    seasons.find((s) => s.year === query.year) ?? (!query.year ? seasons[0] : undefined)
  )?.league;
  const year = typeof query.year === "number" ? String(query.year) : "all";
  const years = seasons.map((s) => s.year);
  if (typeof query.year === "number" && !years.includes(query.year)) years.push(query.year);
  const view = series ? "series" : "games";
  const params = new URLSearchParams({ year });
  if (query.league) params.set("league", query.league);
  if (query.q) params.set("q", query.q);
  const timezone = query.timezone ?? "UTC";
  return (
    <div className="mx-auto flex w-full max-w-content min-w-0 flex-col gap-6">
      <PageHeader
        breadcrumbs={[{ label: "Teams", href: "/teams" }, { label: identity.name }]}
        title={<span className="np-visually-hidden">{identity.name}</span>}
        className="gap-0"
      />
      <Panel aria-label={identity.name}>
        <div className="flex flex-wrap items-center justify-between gap-5 p-2 max-[600px]:p-0">
          <TeamIdentity
            name={identity.name}
            shortName={identity.name}
            size="display"
            {...(league ? { detail: league } : {})}
            {...(identity.imageUrl ? { logo: identity.imageUrl } : {})}
          />
          <Filters
            key={[year, view, query.q, query.league].join("-")}
            history
            view={view}
            query={query}
            seasons={years}
            selectedYear={year}
            className="max-[600px]:w-full"
          />
        </div>
      </Panel>
      <div className="grid grid-cols-[minmax(0,1.7fr)_minmax(270px,1fr)] gap-4 max-[1150px]:grid-cols-1">
        <Roster roster={roster} />
        <Panel title="Season Performance">
          {hidden ? (
            <Button onPress={() => setRevealed(true)}>Reveal Statistics</Button>
          ) : summary.eligibleGames === 0 ? (
            <p>No eligible games in this selection.</p>
          ) : (
            <StatGroup className="justify-between gap-2 max-[1150px]:justify-start max-[1150px]:gap-8">
              <Stat
                label="Game Record"
                value={
                  <GameRecord
                    wins={summary.wins}
                    known={summary.resultGames}
                    total={summary.eligibleGames}
                  />
                }
              />
              <Stat
                label="Win Rate"
                value={summary.winRate === null ? "—" : (summary.winRate * 100).toFixed(1) + "%"}
              />
              <Stat
                label="KDA"
                value={summary.kda?.toFixed(2) ?? "—"}
                {...(summary.kdaGames !== summary.resultGames
                  ? { detail: `${summary.kdaGames} games` }
                  : {})}
              />
            </StatGroup>
          )}
        </Panel>
      </div>
      {!hidden && statistics ? <TeamStatisticsPanel statistics={statistics} /> : null}
      <Panel
        title="Past Matches"
        padding="none"
        actions={
          <TabNav
            label="Past Matches View"
            variant="segmented"
            items={(["series", "games"] as const).map((v) => ({
              href: `?${params}${v === "games" ? "&view=games" : ""}`,
              label: v === "series" ? "Series" : "Games",
              current: view === v,
            }))}
          />
        }
      >
        {series ? (
          series.items.length ? (
            <MatchSection
              title="Finished Series"
              hideTitle
              matches={series.items}
              timezone={timezone}
              now={now}
              {...rows}
            />
          ) : (
            <p className="p-4">
              No finished series match these filters.{" "}
              <a href={`?${params}&view=games`}>Browse Games</a>
            </p>
          )
        ) : (
          <GamesTable games={games.items} timezone={timezone} hideSpoilers={rows.spoilersHidden} />
        )}
        {(series ?? games).total > 5 && (
          <div className="px-4">
            <Pages data={series ?? games} />
          </div>
        )}
      </Panel>
      {!hidden && summary.champions.length > 0 && (
        <ChampionPool champions={summary.champions} portraits={portraits} />
      )}
    </div>
  );
}
