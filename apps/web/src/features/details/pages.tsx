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
} from "@summonersnet/ui";
import type { Game, Profile, BrowseQuery, ProGameWinProbability } from "@summonersnet/data";
import { dateTime, identityHref, gameTeams } from "../browse/presentation";
import { Filters, GamesTable, Pages } from "../browse/components";
import { LineupTable } from "./lineup";
import { ProWinProbability } from "./pro-win-probability";
import { seriesGameHref } from "./series";
export { MatchPage, SeriesGamePage } from "./series";
export function GamePage({
  game,
  timezone,
  hideSpoilers,
  winProbability,
  series = null,
}: {
  game: Game;
  timezone: string;
  hideSpoilers: boolean;
  /** Coarse checkpoint win probability; shown with the other statistics, never while hidden. */
  winProbability?: ProGameWinProbability | null;
  /** The series this archive game is confirmed to belong to, if any. */
  series?: { matchId: string; number: number } | null;
}) {
  const [hidden, setHidden] = useState(hideSpoilers);
  return (
    <div className="np-stack">
      <Breadcrumb
        items={[
          { label: "Past Matches", href: "/history?view=games" },
          { label: `Game ${game.number}` },
        ]}
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
          : "Partial record · excluded from summary statistics."}
      </p>
      {hidden ? <Button onPress={() => setHidden(false)}>Reveal Game Statistics</Button> : null}
      <LineupTable game={game} hidden={hidden} />
      {!hidden && winProbability ? <ProWinProbability winProbability={winProbability} /> : null}
      {series ? (
        <p className="np-meta">
          Part of a confirmed series.{" "}
          <TextLink href={seriesGameHref({ id: series.matchId }, series.number)}>
            Open in Series
          </TextLink>
        </p>
      ) : (
        <p className="np-meta">Series association unconfirmed.</p>
      )}
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
        <summary>Identity Details</summary>
        <p className="np-body-sm">{(profile.aliases ?? [identity.name]).join(" · ")}</p>
        {(profile.resolution ?? []).map((evidence) => (
          <p key={evidence.gameId} className="np-body-sm">
            Linked using{" "}
            {evidence.method === "fixtures"
              ? `${evidence.matchedFixtures} corresponding fixtures against multiple opponents, including a`
              : `${evidence.matchedPlayers} matching players and roles in a`}{" "}
            <TextLink href={`/games/${encodeURIComponent(evidence.gameId)}`}>
              Played Lineup
            </TextLink>{" "}
            played {dateTime(evidence.playedAt, query.timezone ?? "UTC")}. Roster observed{" "}
            {dateTime(evidence.observedAt, query.timezone ?? "UTC")}. This is identity evidence, not
            a contract timeline.
          </p>
        ))}
      </details>
      <section className="np-stack">
        <h2>Observed Current Roster</h2>
        {profile.roster.length ? (
          <Table
            caption="Latest Roster Observation"
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
            title="No Current Roster Observation"
            description="Historical played lineups remain available through individual games."
          />
        )}
      </section>
      <section className="np-stack">
        <h2>Historical Appearances</h2>
        <Filters query={query} history />
        {hidden ? (
          <Button onPress={() => setHidden(false)}>Reveal Summary Statistics</Button>
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
            {summary.champions.length > 0 && (
              <Table
                caption="Champion Usage"
                rows={summary.champions}
                getRowKey={(r) => r.name}
                columns={[
                  { id: "name", header: "Champion", render: (r) => r.name },
                  { id: "games", header: "Games", render: (r) => r.games },
                  {
                    id: "wins",
                    header: "Wins / Results",
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
