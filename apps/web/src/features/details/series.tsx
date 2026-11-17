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
import { type ChampionPortraits } from "../browse/visuals";
import { dateTime, matchDisplay, gameTeams } from "../browse/presentation";
import { useSpoilerPreference } from "../browse/match-group";
import { WatchPlayer, watchableBroadcasts } from "../watch/player";
import { Disclosure } from "./disclosure";
import { DraftPanel } from "./draft";
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
      {current === "overview" ? (
        <div className="ev-match-group">
          <MatchRow
            match={{ ...display, streamAvailable: false }}
            spoilerHidden={hidden}
            onSpoilerReveal={onReveal}
          />
        </div>
      ) : null}
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
        {match.state === "final" && broadcasts.length ? (
          <Disclosure title="Watch Replay">
            <WatchPlayer broadcasts={broadcasts} mode="replay" showHeading={false} />
          </Disclosure>
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
      <div className="np-split ev-game-meta">
        <div className="np-cluster np-meta">
          <span>{dateTime(current.startsAt, timezone)}</span>
          {seconds !== null ? <span>{length(seconds)}</span> : null}
          {game?.patch ? <span>Patch {game.patch}</span> : null}
          {!game ? <Winner match={match} game={current} hidden={hidden} /> : null}
        </div>
        {vodUrl ? (
          <TextLink href={vodUrl} target="_blank" rel="noreferrer">
            Watch Game VOD
          </TextLink>
        ) : null}
      </div>
      {hidden ? <Button onPress={() => setRevealed(true)}>Reveal Game Statistics</Button> : null}
      {game ? (
        <>
          <LineupTable game={game} hidden={hidden} portraits={portraits} />
          {detail && !hidden ? <DraftPanel detail={detail} portraits={portraits} /> : null}
          {!hidden && winProbability ? (
            <Disclosure title="Win Probability">
              <ProWinProbability winProbability={winProbability} />
            </Disclosure>
          ) : null}
          <TextLink href={`/games/${encodeURIComponent(game.id)}`}>Open Archive Record</TextLink>
        </>
      ) : (
        <EmptyState title="Game Details Not Available Yet" />
      )}
    </SeriesShell>
  );
}
