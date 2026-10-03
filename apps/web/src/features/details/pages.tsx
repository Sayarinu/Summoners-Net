"use client";
import { useState } from "react";
import {
  Breadcrumb,
  Button,
  Table,
  TextLink,
  TeamIdentity,
  PlayerIdentity,
  EmptyState,
  MatchRow,
} from "@esportsviewer/ui";
import type { Match, Game, Profile, BrowseQuery } from "@esportsviewer/data";
import { dateTime, identityHref, matchDisplay, gameTeams } from "../browse/presentation";
import { Filters, GamesTable, Pages } from "../browse/components";
import { WatchPlayer } from "../watch/player";
export function MatchPage({
  match,
  timezone,
  hideSpoilers,
  now,
}: {
  match: Match;
  timezone: string;
  hideSpoilers: boolean;
  now: string;
}) {
  const [hidden, setHidden] = useState(hideSpoilers);
  const gamesWithStatistics = match.games.filter((game) => game.state === "finished");
  const display = matchDisplay(match, timezone, now);
  const canWatch = match.state === "live" || match.state === "final";
  return (
    <div className="np-stack">
      <Breadcrumb items={[{ label: "Matches", href: "/" }, { label: match.league }]} />
      <header className="ev-title">
        <div>
          <span className="np-overline">
            {match.league} · Best of {match.bestOf}
          </span>
          <h1>
            {match.teams.length > 0
              ? display.teams.map((team) => team.name).join(" vs ")
              : match.name}
          </h1>
          <p className="np-body-sm">
            {match.event} · {dateTime(match.startsAt, timezone)}
          </p>
        </div>
      </header>
      <MatchRow
        match={{ ...display, streamAvailable: false }}
        spoilerHidden={hidden}
        onSpoilerReveal={() => setHidden(false)}
      />
      {canWatch && match.broadcasts.length > 0 ? (
        <WatchPlayer broadcasts={match.broadcasts} />
      ) : null}
      {gamesWithStatistics.length > 0 ? (
        <section className="np-stack">
          <h2>Game information</h2>
          <Table
            caption="Game context"
            rows={gamesWithStatistics}
            getRowKey={(g) => g.sourceId}
            columns={[
              { id: "number", header: "Game", render: (g) => g.number },
              { id: "state", header: "Status", render: (g) => g.state },
              {
                id: "start",
                header: "Started",
                render: (g) => dateTime(g.startsAt, timezone),
              },
              {
                id: "winner",
                header: "Winner",
                render: (g) =>
                  hidden
                    ? "Hidden"
                    : (match.teams.find((t) => t.id === g.winnerId)?.name ?? "Unknown"),
              },
            ]}
          />
        </section>
      ) : null}
    </div>
  );
}
export function GamePage({
  game,
  timezone,
  hideSpoilers,
}: {
  game: Game;
  timezone: string;
  hideSpoilers: boolean;
}) {
  const [hidden, setHidden] = useState(hideSpoilers);
  return (
    <div className="np-stack">
      <Breadcrumb
        items={[{ label: "History", href: "/history" }, { label: `Game ${game.number}` }]}
      />
      <header className="ev-title">
        <div>
          <span className="np-overline">{game.event}</span>
          <h1>
            {gameTeams(game)
              .map((t) => t.name)
              .join(" vs ")}
          </h1>
          <p className="np-body-sm">
            {dateTime(game.occurredAt, timezone)} · Game {game.number} · Patch{" "}
            {game.patch ?? "unknown"}
          </p>
        </div>
      </header>
      <p className="np-body-sm">
        {game.complete
          ? "Eligible for basic statistics."
          : "Partial record · excluded from summary statistics."}{" "}
        Lineups show who played this game.
      </p>
      {hidden ? <Button onPress={() => setHidden(false)}>Reveal game statistics</Button> : null}
      <Table
        caption="Historical played lineup"
        getRowKey={(p) => p.slot}
        rows={game.participants.filter((p) => p.player)}
        columns={[
          { id: "side", header: "Side", render: (p) => p.side },
          {
            id: "team",
            header: "Team",
            render: (p) => (
              <TeamIdentity
                name={p.team.name}
                shortName={p.team.name}
                size="compact"
                href={identityHref(p.team)}
                {...(p.team.imageUrl ? { logo: p.team.imageUrl } : {})}
              />
            ),
          },
          { id: "role", header: "Role", render: (p) => p.role },
          {
            id: "player",
            header: "Player",
            render: (p) =>
              p.player ? (
                <PlayerIdentity
                  handle={p.player.name}
                  href={identityHref(p.player)}
                  {...(p.player.imageUrl ? { portrait: p.player.imageUrl } : {})}
                />
              ) : (
                "—"
              ),
          },
          {
            id: "champion",
            header: "Champion",
            render: (p) => (hidden ? "Hidden" : (p.champion ?? "—")),
          },
          {
            id: "kda",
            header: "K / D / A",
            render: (p) =>
              hidden ? "Hidden" : `${p.kills ?? "—"} / ${p.deaths ?? "—"} / ${p.assists ?? "—"}`,
          },
          {
            id: "result",
            header: "Result",
            render: (p) =>
              hidden ? "Hidden" : p.won === null ? "Unknown" : p.won ? "Win" : "Loss",
          },
        ]}
      />
      <p className="np-meta">Series association {game.matchId ? "verified" : "unconfirmed"}.</p>
    </div>
  );
}
export function ProfilePage({
  profile,
  query,
  hideSpoilers,
}: {
  profile: Profile;
  query: BrowseQuery;
  hideSpoilers: boolean;
}) {
  const [hidden, setHidden] = useState(hideSpoilers);
  const { identity, summary } = profile;
  return (
    <div className="np-stack">
      <Breadcrumb
        items={[
          {
            label: identity.kind === "team" ? "Teams" : "Players",
            href: identity.kind === "team" ? "/teams" : "/players",
          },
          { label: identity.name },
        ]}
      />
      <header className="ev-title">
        <div className="ev-profile-title">
          <span className="np-overline">{identity.kind}</span>
          <h1 className="np-visually-hidden">{identity.name}</h1>
          {identity.kind === "team" ? (
            <TeamIdentity
              name={identity.name}
              shortName={identity.name}
              size="large"
              {...(identity.imageUrl ? { logo: identity.imageUrl } : {})}
            />
          ) : (
            <PlayerIdentity
              handle={identity.name}
              {...(identity.imageUrl ? { portrait: identity.imageUrl } : {})}
            />
          )}
        </div>
      </header>
      <details className="np-stack">
        <summary>Identity details</summary>
        <p className="np-body-sm">{(profile.aliases ?? [identity.name]).join(" · ")}</p>
        {(profile.resolution ?? []).map((evidence) => (
          <p key={evidence.gameId} className="np-body-sm">
            Linked using{" "}
            {evidence.method === "fixtures"
              ? `${evidence.matchedFixtures} corresponding fixtures against multiple opponents, including a`
              : `${evidence.matchedPlayers} matching players and roles in a`}{" "}
            <TextLink href={`/games/${encodeURIComponent(evidence.gameId)}`}>
              played lineup
            </TextLink>{" "}
            played {dateTime(evidence.playedAt, query.timezone ?? "UTC")}. Roster observed{" "}
            {dateTime(evidence.observedAt, query.timezone ?? "UTC")}. This is identity evidence, not
            a contract timeline.
          </p>
        ))}
      </details>
      <section className="np-stack">
        <h2>Observed current roster</h2>
        <p className="np-body-sm">
          Current roster records describe the latest supplied lineup, not contractual roster
          history.
        </p>
        {profile.roster.length ? (
          <Table
            caption="Latest roster observation"
            getRowKey={(r) => `${r.team.id}:${r.player.id}`}
            rows={profile.roster}
            columns={[
              {
                id: "player",
                header: "Player",
                render: (r) => (
                  <PlayerIdentity
                    handle={r.player.name}
                    href={identityHref(r.player)}
                    {...(r.player.imageUrl ? { portrait: r.player.imageUrl } : {})}
                    {...(r.player.role ? { role: r.player.role } : {})}
                  />
                ),
              },
              {
                id: "team",
                header: "Team",
                render: (r) => (
                  <TeamIdentity
                    name={r.team.name}
                    shortName={r.team.name}
                    size="compact"
                    href={identityHref(r.team)}
                    {...(r.team.imageUrl ? { logo: r.team.imageUrl } : {})}
                  />
                ),
              },
              {
                id: "observed",
                header: "Observed",
                render: (r) => dateTime(r.observedAt, query.timezone ?? "UTC"),
              },
            ]}
          />
        ) : (
          <EmptyState
            title="No current roster observation"
            description="Historical played lineups remain available through individual games."
          />
        )}
      </section>
      <section className="np-stack">
        <h2>Historical appearances</h2>
        <Filters query={query} history />
        {hidden ? (
          <Button onPress={() => setHidden(false)}>Reveal summary statistics</Button>
        ) : (
          <>
            <dl className="ev-summary">
              <div>
                <dt>Eligible games</dt>
                <dd>{summary.eligibleGames}</dd>
              </div>
              <div>
                <dt>Wins / result sample</dt>
                <dd>
                  {summary.wins} / {summary.resultGames}
                </dd>
              </div>
              <div>
                <dt>Win rate</dt>
                <dd>{summary.winRate === null ? "—" : `${(summary.winRate * 100).toFixed(1)}%`}</dd>
              </div>
              <div>
                <dt>KDA · {summary.kdaGames} games</dt>
                <dd>{summary.kda?.toFixed(2) ?? "—"}</dd>
              </div>
            </dl>
            <p className="np-body-sm">
              Only complete ten-player games contribute. Missing values stay unknown. KDA is (kills
              + assists) / deaths; zero deaths has no finite ratio.
            </p>
            {summary.champions.length > 0 && (
              <Table
                caption="Champion usage"
                rows={summary.champions}
                getRowKey={(r) => r.name}
                columns={[
                  { id: "name", header: "Champion", render: (r) => r.name },
                  { id: "games", header: "Games", render: (r) => r.games },
                  {
                    id: "wins",
                    header: "Wins / results",
                    render: (r) => `${r.wins} / ${r.resultGames}`,
                  },
                ]}
              />
            )}
          </>
        )}
        <GamesTable games={profile.games.items} timezone={query.timezone ?? "UTC"} />
        <Pages data={profile.games} />
      </section>
    </div>
  );
}
