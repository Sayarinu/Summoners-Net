"use client";
import { useState, type ReactNode } from "react";
import { Breadcrumb, Button, EmptyState, MatchRow, TeamIdentity, TextLink } from "@summonersnet/ui";
import type {
  Game,
  HistoricalGameDetail,
  Match,
  ProGameWinProbability,
  SeriesGame,
} from "@summonersnet/data";
import { gameReplayUrl, recordingUrl } from "@summonersnet/data/contracts";
import { ChampionPortrait, type ChampionPortraits } from "../browse/visuals";
import { dateTime, matchDisplay, gameTeams } from "../browse/presentation";
import { useSpoilerPreference } from "../browse/match-group";
import { WatchPlayer, watchableBroadcasts } from "../watch/player";
import { LineupTable } from "./lineup";
import { ProWinProbability } from "./pro-win-probability";

export const seriesHref = (match: Pick<Match, "id">) => `/matches/${encodeURIComponent(match.id)}`;
export const seriesGameHref = (match: Pick<Match, "id">, number: number) =>
  `${seriesHref(match)}/games/${number}`;

/** A game counts as played once the provider reports it finished or under way. */
const played = (game: SeriesGame) => game.state === "finished" || game.state === "running";

/** Elapsed time between two observed timestamps as m:ss, or null when either is unknown. */
export function length(seconds: number | null) {
  if (seconds === null || !Number.isFinite(seconds) || seconds < 0) return null;
  const whole = Math.round(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}
const observedSeconds = (game: SeriesGame) =>
  game.startsAt && game.finishedAt
    ? (Date.parse(game.finishedAt) - Date.parse(game.startsAt)) / 1000
    : null;

function SeriesShell({
  match,
  games,
  current,
  timezone,
  now,
  hidden,
  onReveal,
  children,
  game,
}: {
  match: Match;
  games: SeriesGame[];
  current: "overview" | number;
  timezone: string;
  now: string;
  hidden: boolean;
  onReveal: () => void;
  children: ReactNode;
  game?: Game | null;
}) {
  const display = matchDisplay(match, timezone, now);
  const title =
    match.teams.length > 0 ? display.teams.map((team) => team.name).join(" vs ") : match.name;
  const sides = game
    ? new Map(gameTeams(game).map((team) => [team.entityId ?? team.id, team.side]))
    : null;
  const parent =
    match.state === "final"
      ? { label: "Past Matches", href: "/history" }
      : { label: "Matches", href: "/" };
  return (
    <div className="np-stack">
      <Breadcrumb
        items={
          current === "overview"
            ? [parent, { label: title }]
            : [parent, { label: title, href: seriesHref(match) }, { label: `Game ${current}` }]
        }
      />
      <header className="ev-title">
        <div>
          <span className="np-overline">
            {match.league} · Best of {match.bestOf}
          </span>
          <h1>
            {sides && match.teams.length > 0
              ? match.teams.map((team, index) => {
                  const side = sides.get(team.entityId ?? team.id);
                  return (
                    <span key={team.id}>
                      {index ? " vs " : null}
                      <span
                        className="ev-side-name"
                        data-side={side}
                        title={side ? `${side} side` : undefined}
                      >
                        {team.name}
                      </span>
                    </span>
                  );
                })
              : title}
          </h1>
          <p className="np-body-sm">
            {match.event} · {dateTime(match.startsAt, timezone)}
          </p>
        </div>
      </header>
      <div className="ev-match-group">
        <MatchRow
          match={{ ...display, streamAvailable: false }}
          spoilerHidden={hidden}
          onSpoilerReveal={onReveal}
        />
      </div>
      <nav aria-label="Series" className="ev-tabs ev-series-tabs">
        <a
          className="ev-tab"
          href={seriesHref(match)}
          aria-current={current === "overview" ? "page" : undefined}
        >
          Overview
        </a>
        {games.map((game) =>
          played(game) ? (
            <a
              key={game.number}
              className="ev-tab"
              href={seriesGameHref(match, game.number)}
              aria-current={current === game.number ? "page" : undefined}
            >
              Game {game.number}
            </a>
          ) : (
            <span key={game.number} className="ev-tab" aria-disabled="true">
              Game {game.number}
            </span>
          ),
        )}
      </nav>
      {children}
    </div>
  );
}

function Winner({ match, game, hidden }: { match: Match; game: SeriesGame; hidden: boolean }) {
  if (hidden) return <span className="np-meta">Result hidden</span>;
  const team = match.teams.find((t) => t.id === game.winnerId);
  if (!team)
    return <span className="np-meta">{played(game) ? "Winner unknown" : "Not played"}</span>;
  return (
    <TeamIdentity
      name={team.name}
      shortName={team.name}
      size="compact"
      {...(team.imageUrl ? { logo: team.imageUrl } : {})}
    />
  );
}

export function MatchPage({
  match,
  games,
  timezone,
  hideSpoilers,
  now,
}: {
  match: Match;
  games: SeriesGame[];
  timezone: string;
  hideSpoilers: boolean;
  now: string;
}) {
  const preferenceHidden = useSpoilerPreference(hideSpoilers);
  const [revealed, setRevealed] = useState(false);
  const hidden = preferenceHidden && !revealed;
  const canWatch = match.state === "live" || match.state === "final";
  return (
    <SeriesShell
      match={match}
      games={games}
      current="overview"
      timezone={timezone}
      now={now}
      hidden={hidden}
      onReveal={() => setRevealed(true)}
    >
      {canWatch && match.broadcasts.length > 0 ? (
        <WatchPlayer
          broadcasts={watchableBroadcasts(match)}
          mode={match.state === "final" ? "replay" : "live"}
        />
      ) : null}
      {games.length > 0 ? (
        <section className="np-stack">
          <h2>Games</h2>
          <ol className="ev-series-games">
            {games.map((game) => {
              const vodUrl = gameReplayUrl(match, game);
              const body = (
                <>
                  <span className="ev-series-game__number">Game {game.number}</span>
                  <Winner match={match} game={game} hidden={hidden} />
                  <span className="np-meta">
                    {played(game)
                      ? `${length(observedSeconds(game)) ?? "—"} · ${dateTime(game.startsAt, timezone)}`
                      : "Not played"}
                  </span>
                </>
              );
              return (
                <li key={game.number} className="ev-series-game">
                  {played(game) ? (
                    <a
                      href={seriesGameHref(match, game.number)}
                      aria-label={`Open Game ${game.number}`}
                    >
                      {body}
                    </a>
                  ) : (
                    <div aria-disabled="true">{body}</div>
                  )}
                  {vodUrl ? (
                    <TextLink
                      className="ev-series-game__replay"
                      href={vodUrl}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`Watch Game ${game.number} VOD`}
                    >
                      Watch Game VOD
                    </TextLink>
                  ) : null}
                </li>
              );
            })}
          </ol>
        </section>
      ) : (
        <EmptyState title="No Games Reported Yet" />
      )}
    </SeriesShell>
  );
}

function Draft({
  detail,
  teams,
  game,
  portraits,
}: {
  detail: HistoricalGameDetail;
  teams: Map<string, string>;
  portraits?: ChampionPortraits | undefined;
  game: Game;
}) {
  return (
    <section className="np-stack">
      <h2>Draft</h2>
      <div className="ev-series-draft">
        {detail.draft.map((side) => (
          <div key={side.side} className="ev-series-draft__side" data-side={side.side}>
            <h3>
              {side.side === "blue" ? "Blue" : "Red"} Side · {teams.get(side.side) ?? "Unknown"}
              {side.firstPick ? " · First Pick" : ""}
            </h3>
            <dl>
              {side.picks.some((pick) => pick !== null) ? (
                <div>
                  <dt>Picks</dt>
                  <dd className="np-cluster">
                    {side.picks.map((pick, index) => (
                      <ChampionPortrait key={index} name={pick} portraits={portraits} />
                    ))}
                  </dd>
                </div>
              ) : (
                // Without a recorded pick order, list the champions this side played instead.
                <div>
                  <dt>Played</dt>
                  <dd className="np-cluster">
                    {game.participants
                      .filter((p) => p.side === side.side && p.player)
                      .map((p) => (
                        <ChampionPortrait key={p.slot} name={p.champion} portraits={portraits} />
                      ))}
                  </dd>
                </div>
              )}
              <div>
                <dt>Bans</dt>
                <dd className="np-cluster">
                  {side.bans.length
                    ? side.bans.map((ban, index) => (
                        <ChampionPortrait key={index} name={ban} portraits={portraits} />
                      ))
                    : "—"}
                </dd>
              </div>
            </dl>
          </div>
        ))}
      </div>
    </section>
  );
}

export function SeriesGamePage({
  match,
  games,
  number,
  game,
  detail,
  portraits,
  winProbability,
  timezone,
  hideSpoilers,
  now,
}: {
  match: Match;
  games: SeriesGame[];
  number: number;
  /** The linked archive game, or null while no archive record is confirmed. */
  game: Game | null;
  detail: HistoricalGameDetail | null;
  portraits?: ChampionPortraits;
  winProbability: ProGameWinProbability | null;
  timezone: string;
  hideSpoilers: boolean;
  now: string;
}) {
  const preferenceHidden = useSpoilerPreference(hideSpoilers);
  const [revealed, setRevealed] = useState(false);
  const hidden = preferenceHidden && !revealed;
  const playedGames = games.filter(played);
  const index = playedGames.findIndex((g) => g.number === number);
  const current = playedGames[index]!;
  const previous = playedGames[index - 1];
  const next = playedGames[index + 1];
  const seconds = detail?.context.durationSeconds ?? observedSeconds(current);
  const vodUrl = gameReplayUrl(match, current) ?? recordingUrl(detail?.context.sourceUrl);
  return (
    <SeriesShell
      match={match}
      games={games}
      current={number}
      game={game}
      timezone={timezone}
      now={now}
      hidden={hidden}
      onReveal={() => setRevealed(true)}
    >
      <nav aria-label="Series Games" className="ev-series-steps">
        {previous ? (
          <TextLink href={seriesGameHref(match, previous.number)}>
            Previous: Game {previous.number}
          </TextLink>
        ) : (
          <TextLink href={seriesHref(match)}>Series Overview</TextLink>
        )}
        {next ? (
          <TextLink href={seriesGameHref(match, next.number)}>Next: Game {next.number}</TextLink>
        ) : null}
      </nav>
      {vodUrl ? (
        <TextLink href={vodUrl} target="_blank" rel="noreferrer">
          Watch Game VOD
        </TextLink>
      ) : null}
      <dl className="ev-summary">
        <div>
          <dt>Started</dt>
          <dd>{dateTime(current.startsAt, timezone)}</dd>
        </div>
        <div>
          <dt>Length</dt>
          <dd>{length(seconds) ?? "—"}</dd>
        </div>
        <div>
          <dt>Winner</dt>
          <dd>
            <Winner match={match} game={current} hidden={hidden} />
          </dd>
        </div>
        <div>
          <dt>Patch</dt>
          <dd>{game?.patch ?? "—"}</dd>
        </div>
      </dl>
      {game ? (
        <>
          {hidden ? (
            <Button onPress={() => setRevealed(true)}>Reveal Game Statistics</Button>
          ) : null}
          {detail && !hidden ? (
            <Draft
              detail={detail}
              game={game}
              portraits={portraits}
              teams={new Map(detail.teams.map((team) => [team.side, team.name]))}
            />
          ) : null}
          <section className="np-stack">
            <h2>Lineups</h2>
            <LineupTable game={game} hidden={hidden} portraits={portraits} />
          </section>
          {!hidden && winProbability ? <ProWinProbability winProbability={winProbability} /> : null}
          <TextLink href={`/games/${encodeURIComponent(game.id)}`}>Open Archive Record</TextLink>
        </>
      ) : (
        <EmptyState title="Game Details Not Available Yet" />
      )}
    </SeriesShell>
  );
}
