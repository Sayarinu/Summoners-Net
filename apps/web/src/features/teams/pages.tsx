"use client";
import "../browse/directory.css";
import "./teams.css";
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
import { Breadcrumb, Button, EmptyState, PlayerIdentity, TeamIdentity } from "@summonersnet/ui";
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
    <div className="ev-teams ev-teams--directory np-stack">
      <header className="ev-title">
        <div>
          <h1>Teams</h1>
        </div>
      </header>
      <div className="ev-browse-toolbar">
        <Filters teams query={query} />
      </div>
      {data.items.length ? (
        <FillingGrid
          className="ev-directory-grid"
          page={data.page}
          pageSize={data.pageSize}
          total={data.total}
        >
          {data.items.map((t) => (
            <li key={t.id}>
              <TeamIdentity
                name={t.name}
                shortName={t.name}
                href={identityHref(t)}
                size="large"
                {...(t.league ? { detail: t.league } : {})}
                {...(t.imageUrl ? { logo: t.imageUrl } : {})}
              />
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
    <section className="ev-team-panel">
      <h2>Current Roster</h2>
      {players.length ? (
        <ul className="ev-roster">
          {players.map(({ player, role }) => (
            <li key={player.id}>
              <PlayerIdentity
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
    </section>
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
    <section className="ev-team-panel">
      <h2>Champion Pool</h2>
      <ul className="ev-champ-pool">
        {(expanded ? champions : champions.slice(0, 5)).map((c) => (
          <li key={c.name}>
            <ChampionPortrait name={c.name} portraits={portraits} />
            <span>
              <GameRecord wins={c.wins} known={c.resultGames} total={c.games} />
            </span>
          </li>
        ))}
      </ul>
      {champions.length > 5 && (
        <Button onPress={() => setExpanded(!expanded)}>
          {expanded ? "Show Fewer Champions" : "Show All Champions"}
        </Button>
      )}
    </section>
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
}: {
  profile: Profile;
  portraits?: ChampionPortraits;
  seasons: TeamSeason[];
  query: BrowseQuery;
  series: Page<Match> | null;
  now: string;
  hideSpoilers: boolean;
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
    <div className="ev-teams np-stack">
      <Breadcrumb items={[{ label: "Teams", href: "/teams" }, { label: identity.name }]} />
      <header className="ev-team-banner">
        <div>
          <h1 className="np-visually-hidden">{identity.name}</h1>
          <TeamIdentity
            name={identity.name}
            shortName={identity.name}
            size="large"
            {...(league ? { detail: league } : {})}
            {...(identity.imageUrl ? { logo: identity.imageUrl } : {})}
          />
        </div>
        <Filters
          key={[year, view, query.q, query.league].join("-")}
          history
          view={view}
          query={query}
          seasons={years}
          selectedYear={year}
        />
      </header>
      <div className="ev-team-overview">
        <Roster roster={roster} />
        <section className="ev-team-panel">
          <h2>Season Performance</h2>
          {hidden ? (
            <Button onPress={() => setRevealed(true)}>Reveal Statistics</Button>
          ) : summary.eligibleGames === 0 ? (
            <p>No eligible games in this selection.</p>
          ) : (
            <dl className="ev-team-stats">
              <div>
                <dt>Game Record</dt>
                <dd>
                  <GameRecord
                    wins={summary.wins}
                    known={summary.resultGames}
                    total={summary.eligibleGames}
                  />
                </dd>
              </div>
              <div>
                <dt>Win Rate</dt>
                <dd>{summary.winRate === null ? "—" : (summary.winRate * 100).toFixed(1) + "%"}</dd>
              </div>
              <div>
                <dt>KDA</dt>
                <dd>
                  {summary.kda?.toFixed(2) ?? "—"}
                  {summary.kdaGames !== summary.resultGames && (
                    <small>{summary.kdaGames} games</small>
                  )}
                </dd>
              </div>
            </dl>
          )}
        </section>
      </div>
      <section className="ev-team-history">
        <div className="ev-team-history-head">
          <h2>Past Matches</h2>
          <nav className="ev-tabs ev-tabs--segmented" aria-label="Past Matches View">
            {(["series", "games"] as const).map((v) => (
              <a
                key={v}
                aria-current={view === v ? "page" : undefined}
                className="ev-tab"
                href={`?${params}${v === "games" ? "&view=games" : ""}`}
              >
                {v === "series" ? "Series" : "Games"}
              </a>
            ))}
          </nav>
        </div>
        {series ? (
          series.items.length ? (
            <MatchSection
              title="Finished Series"
              matches={series.items}
              timezone={timezone}
              now={now}
              {...rows}
            />
          ) : (
            <p>
              No finished series match these filters.{" "}
              <a href={`?${params}&view=games`}>Browse Games</a>
            </p>
          )
        ) : (
          <GamesTable games={games.items} timezone={timezone} hideSpoilers={rows.spoilersHidden} />
        )}
        {(series ?? games).total > 5 && <Pages data={series ?? games} />}
      </section>
      {!hidden && summary.champions.length > 0 && (
        <ChampionPool champions={summary.champions} portraits={portraits} />
      )}
    </div>
  );
}
