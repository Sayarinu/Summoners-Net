"use client";
import { useState } from "react";
import {
  Avatar,
  Breadcrumb,
  Button,
  Table,
  TextLink,
  TeamIdentity,
  PlayerIdentity,
  EmptyState,
} from "@summonersnet/ui";
import type {
  Game,
  HistoricalGameDetail,
  Profile,
  BrowseQuery,
  ProGameWinProbability,
} from "@summonersnet/data";
import { ChampionPortrait, GameRecord, type ChampionPortraits } from "../browse/visuals";
import { dateTime, identityHref, gameTeams, seriesGameHref } from "../browse/presentation";
import { Filters, GamesTable, Pages } from "../browse/components";
import { DraftPanel } from "./draft";
import { LineupTable } from "./lineup";
import { ProWinProbability } from "./pro-win-probability";
export { MatchPage, SeriesGamePage } from "./series";
export function GamePage({
  game,
  timezone,
  hideSpoilers,
  winProbability,
  detail,
  portraits,
  vodUrl,
  round,
  series = null,
}: {
  game: Game;
  detail?: HistoricalGameDetail | null;
  timezone: string;
  hideSpoilers: boolean;
  portraits?: ChampionPortraits;
  vodUrl?: string | null;
  round?: string | null;
  /** Coarse checkpoint win probability; shown with the other statistics, never while hidden. */
  winProbability?: ProGameWinProbability | null;
  /** The series this archive game is confirmed to belong to, if any. */
  series?: { matchId: string; number: number } | null;
}) {
  const [hidden, setHidden] = useState(hideSpoilers);
  const teams = gameTeams(game);
  return (
    <div className="np-stack ev-series-page ev-series-page--wide">
      <Breadcrumb
        items={[
          { label: "Past Matches", href: "/history?view=games" },
          { label: `Game ${game.number}` },
        ]}
      />
      <header className="ev-title">
        <div>
          <span className="np-overline">{[game.event, round].filter(Boolean).join(" · ")}</span>
          <h1>
            {teams.map((team, index) => (
              <span key={team.id}>
                {index ? " vs " : null}
                <a className="ev-series-title__identity" href={identityHref(team)}>
                  {team.imageUrl ? (
                    <Avatar
                      alt=""
                      aria-hidden="true"
                      entityKind="team"
                      fallback={team.name}
                      size="small"
                      src={team.imageUrl}
                    />
                  ) : null}
                  <span className="ev-side-name" data-side={team.side} title={`${team.side} side`}>
                    {team.name}
                  </span>
                </a>
              </span>
            ))}
          </h1>
          <p className="np-body-sm">
            {dateTime(game.occurredAt, timezone)} · Game {game.number}
            {game.patch ? ` · Patch ${game.patch}` : ""}
            {game.complete ? "" : " · Partial Record"}
          </p>
        </div>
        {vodUrl ? (
          <TextLink href={vodUrl} target="_blank" rel="noreferrer">
            Watch Game VOD
          </TextLink>
        ) : null}
      </header>
      {hidden ? <Button onPress={() => setHidden(false)}>Reveal Game Statistics</Button> : null}
      {!hidden && detail ? <DraftPanel detail={detail} portraits={portraits} /> : null}
      <LineupTable game={game} detail={detail} hidden={hidden} portraits={portraits} />
      {!hidden && winProbability ? <ProWinProbability winProbability={winProbability} /> : null}
      {series ? (
        <TextLink href={seriesGameHref({ id: series.matchId }, series.number)}>
          Open in Series
        </TextLink>
      ) : null}
    </div>
  );
}
export function ProfilePage({
  profile,
  portraits,
  query,
  hideSpoilers,
}: {
  profile: Profile;
  portraits?: ChampionPortraits;
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
              role={identity.role}
              {...(identity.imageUrl ? { portrait: identity.imageUrl } : {})}
            />
          )}
        </div>
      </header>
      <section className="np-stack">
        <h2>Current Roster</h2>
        {profile.roster.length ? (
          <Table
            caption="Current Roster"
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
                    role={r.player.role}
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
          <EmptyState title="No Current Roster" />
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
                <dt>Eligible Games</dt>
                <dd>{summary.eligibleGames}</dd>
              </div>
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
                  {
                    id: "name",
                    header: "Champion",
                    render: (r) => <ChampionPortrait name={r.name} portraits={portraits} />,
                  },
                  { id: "games", header: "Games", render: (r) => r.games },
                  {
                    id: "wins",
                    header: "Game Record",
                    render: (r) => (
                      <GameRecord wins={r.wins} known={r.resultGames} total={r.games} />
                    ),
                  },
                ]}
              />
            )}
          </>
        )}
        <GamesTable
          games={profile.games.items}
          timezone={query.timezone ?? "UTC"}
          hideSpoilers={hideSpoilers}
        />
        <Pages data={profile.games} />
      </section>
    </div>
  );
}
