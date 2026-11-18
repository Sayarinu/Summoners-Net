"use client";
import Link from "next/link";
import { useState, useSyncExternalStore, type ReactNode } from "react";
import {
  Avatar,
  Breadcrumb,
  Button,
  EmptyState,
  MatchLifecycleLabel,
  TeamIdentity,
  TextLink,
} from "@summonersnet/ui";
import type {
  Broadcast,
  Game,
  HistoricalGameDetail,
  Match,
  ProGameWinProbability,
  SeriesGame,
} from "@summonersnet/data";
import { gameReplayUrl, recordingUrl } from "@summonersnet/data/contracts";
import { type ChampionPortraits } from "../browse/visuals";
import {
  identityHref,
  matchDisplay,
  gameTeams,
  seriesGameHref,
  seriesHref,
  seriesRound,
} from "../browse/presentation";
import { useSpoilerPreference } from "../browse/match-group";
import { WatchPlayer, watchableBroadcasts } from "../watch/player";
import { Disclosure } from "./disclosure";
import { DraftPanel, type FearlessPick } from "./draft";
import { LineupTable } from "./lineup";
import { ProTimeline } from "./pro-win-probability";

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

function seriesScoreAt(teams: Match["teams"], games: SeriesGame[], through: number): number[] {
  if (teams.length !== 2) return [];
  const scores = [0, 0];
  for (let number = 1; number <= through; number++) {
    const game = games.find((entry) => entry.number === number);
    if (game?.state === "running" && number === through) break;
    if (game?.state !== "finished") return [];
    const winner = teams.findIndex((team) => team.id === game.winnerId);
    if (winner < 0) return [];
    scores[winner] = scores[winner]! + 1;
  }
  return scores;
}

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
  vodUrl,
  gameStartsAt,
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
  vodUrl?: string | null;
  gameStartsAt?: string | null;
}) {
  const display = matchDisplay(match, timezone, now);
  const overview = current === "overview";
  const [first, second] = display.teams;
  const scores = overview
    ? display.teams.map((team) => team.score)
    : seriesScoreAt(match.teams, games, current);
  const showScore =
    match.teams.length > 0 &&
    (!hidden || (overview && match.state !== "final")) &&
    scores.some((score) => score !== undefined);
  const margin =
    (!overview || match.state === "final") && scores[0] !== undefined && scores[1] !== undefined
      ? scores[0] - scores[1]
      : 0;
  const [firstColor, secondColor] =
    margin > 0
      ? ["ev-outcome--win", "ev-outcome--loss"]
      : margin < 0
        ? ["ev-outcome--loss", "ev-outcome--win"]
        : [];
  const round = seriesRound(match);
  const event = round
    ? `${match.league} · ${round === "Grand Final" ? "Grand Finals" : round}`
    : match.event || match.league;
  const startsAt = gameStartsAt ?? match.startsAt;
  const date = startsAt ? (
    <time dateTime={startsAt}>
      {new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: timezone }).format(
        new Date(startsAt),
      )}
    </time>
  ) : null;
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
    <div className="np-stack ev-series-page ev-series-page--wide ev-series-shell">
      <Breadcrumb
        items={
          overview
            ? [parent, { label: title }]
            : [parent, { label: title, href: seriesHref(match) }, { label: `Game ${current}` }]
        }
      />
      <header className="ev-title">
        <div>
          <div className="np-cluster ev-series-title__facts">
            <span className="np-overline">
              {event}
              {date ? <> · {date}</> : null} · Best of {match.bestOf}
            </span>
            {overview && match.state !== "final" ? (
              <MatchLifecycleLabel lifecycle={match.state} />
            ) : null}
          </div>
          <h1>
            {match.teams.length > 0
              ? display.teams.map((team, index) => {
                  const identity = match.teams[index];
                  const side = identity && sides?.get(identity.entityId ?? identity.id);
                  const name = (
                    <span
                      className="ev-side-name"
                      data-side={side}
                      title={side ? `${side} side` : undefined}
                    >
                      {team.name}
                    </span>
                  );
                  const logo = team.logo ? (
                    <Avatar
                      alt=""
                      aria-hidden="true"
                      entityKind="team"
                      fallback={team.shortName}
                      size="small"
                      src={team.logo}
                    />
                  ) : null;
                  const score = showScore ? (
                    <span
                      className={`ev-series-title__score ${(index ? secondColor : firstColor) ?? ""}`}
                    >
                      {index ? null : " "}
                      {scores[index] ?? "—"}
                      {index ? " " : null}
                    </span>
                  ) : null;
                  const identityContent = (
                    <>
                      {index ? logo : name}
                      {index ? name : logo}
                    </>
                  );
                  return (
                    <span key={index}>
                      {index ? " vs " : null}
                      <span className="ev-series-title__team">
                        {index ? score : null}
                        {identity && team.name !== "TBD" ? (
                          <a className="ev-series-title__identity" href={identityHref(identity)}>
                            {identityContent}
                          </a>
                        ) : (
                          identityContent
                        )}
                        {index ? null : score}
                      </span>
                    </span>
                  );
                })
              : title}
          </h1>
        </div>
        {overview && hidden && match.state === "final" ? (
          <Button
            variant="secondary"
            aria-label={`Reveal score for ${first.name} versus ${second.name}`}
            onPress={onReveal}
          >
            Reveal Score
          </Button>
        ) : vodUrl ? (
          <TextLink href={vodUrl} target="_blank" rel="noreferrer">
            Watch Game VOD
          </TextLink>
        ) : null}
      </header>
      <nav aria-label="Series" className="ev-tabs ev-series-tabs">
        <Link
          className="ev-tab"
          href={seriesHref(match)}
          prefetch={false}
          scroll={false}
          aria-current={current === "overview" ? "page" : undefined}
        >
          Overview
        </Link>
        {games.map((game) =>
          played(game) ? (
            <Link
              key={game.number}
              className="ev-tab"
              href={seriesGameHref(match, game.number)}
              prefetch={false}
              scroll={false}
              aria-current={current === game.number ? "page" : undefined}
            >
              Game {game.number}
            </Link>
          ) : (
            <span key={game.number} className="ev-tab" aria-disabled="true">
              Game {game.number}
            </span>
          ),
        )}
      </nav>
      <div className="np-stack ev-series-content" key={current}>
        {children}
      </div>
    </div>
  );
}

const replayLayout = "(min-width: 76rem)";
function subscribeToReplayLayout(onChange: () => void) {
  const query = window.matchMedia(replayLayout);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function SeriesReplay({ broadcasts }: { broadcasts: Broadcast[] }) {
  const wide = useSyncExternalStore(
    subscribeToReplayLayout,
    () => window.matchMedia(replayLayout).matches,
    () => false,
  );
  const player = <WatchPlayer broadcasts={broadcasts} mode="replay" compact />;
  return (
    <aside className="ev-series-replay">
      {wide ? player : <Disclosure title="Replay">{player}</Disclosure>}
    </aside>
  );
}

function Winner({ match, game, hidden }: { match: Match; game: SeriesGame; hidden: boolean }) {
  if (!played(game)) return <span className="np-meta">Not played</span>;
  if (hidden) return <span className="np-meta">Result hidden</span>;
  const team = match.teams.find((t) => t.id === game.winnerId);
  if (!team) return <span className="np-meta">Winner unknown</span>;
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
  const broadcasts = watchableBroadcasts(match);
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
      {match.state === "live" && broadcasts.length ? (
        <div className="ev-compact-player">
          <WatchPlayer broadcasts={broadcasts} />
        </div>
      ) : null}
      <div className="ev-series-overview">
        {games.length > 0 ? (
          <section className="np-stack ev-series-overview__games">
            <h2>Games</h2>
            <ol className="ev-series-games">
              {games.map((game) => {
                const vodUrl = gameReplayUrl(match, game);
                const duration = played(game) ? length(observedSeconds(game)) : null;
                const body = (
                  <>
                    <span className="ev-series-game__number">Game {game.number}</span>
                    <Winner match={match} game={game} hidden={hidden} />
                    {duration !== null ? <span className="np-meta">{duration}</span> : null}
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
        {match.state === "final" && broadcasts.length ? (
          <SeriesReplay broadcasts={broadcasts} />
        ) : null}
      </div>
    </SeriesShell>
  );
}

export function SeriesGamePage({
  match,
  games,
  number,
  game,
  detail,
  portraits,
  fearless = null,
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
  fearless?: FearlessPick[] | null;
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
  const vodUrl = gameReplayUrl(match, current) ?? recordingUrl(detail?.context.sourceUrl);
  return (
    <SeriesShell
      match={match}
      games={games}
      current={number}
      game={game}
      vodUrl={vodUrl}
      gameStartsAt={current.startsAt ?? game?.occurredAt ?? null}
      timezone={timezone}
      now={now}
      hidden={hidden}
      onReveal={() => setRevealed(true)}
    >
      {game ? (
        <>
          {hidden ? (
            <Button onPress={() => setRevealed(true)}>Reveal Game Statistics</Button>
          ) : null}
          {detail && !hidden ? (
            <DraftPanel detail={detail} portraits={portraits} fearless={fearless} />
          ) : null}
          <LineupTable game={game} detail={detail} hidden={hidden} portraits={portraits} />
          {!hidden ? (
            <ProTimeline game={game} detail={detail} winProbability={winProbability} />
          ) : null}
        </>
      ) : (
        <EmptyState title="Game Details Not Available Yet" />
      )}
    </SeriesShell>
  );
}
