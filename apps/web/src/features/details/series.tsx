"use client";
import { useState, useSyncExternalStore, type ReactNode } from "react";
import {
  Avatar,
  Breadcrumb,
  Button,
  DisclosurePanel,
  EmptyState,
  MatchLifecycleLabel,
  PageHeader,
  Panel,
  SideName,
  TabNav,
  Table,
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
import { DraftPanel, type FearlessPick } from "./draft";
import type { ProItemIcons } from "./player-build";
import { LineupTable } from "./lineup";
import { ProTimeline } from "./pro-win-probability";
import { GameDistributions } from "./game-distributions";
import {
  TitleFacts,
  TitleTeam,
  detailHeaderClass,
  detailPageClass,
  outcomeClass,
  titlePart,
} from "./title";

const gameCardBody = "grid h-full gap-1 px-3 py-2 text-inherit no-underline";
const replayClass = "mx-3 mb-2 justify-self-start";

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
      ? [outcomeClass.win, outcomeClass.loss]
      : margin < 0
        ? [outcomeClass.loss, outcomeClass.win]
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
    // The shell stays put between tabs; only the content below the tabs fades in.
    <div className={`${detailPageClass} animate-none!`}>
      <Breadcrumb
        items={
          overview
            ? [parent, { label: title }]
            : [parent, { label: title, href: seriesHref(match) }, { label: `Game ${current}` }]
        }
      />
      <PageHeader
        className={detailHeaderClass}
        eyebrow={
          <TitleFacts
            label={
              overview && match.state !== "final" ? (
                <MatchLifecycleLabel lifecycle={match.state} />
              ) : null
            }
          >
            {event}
            {date ? <> · {date}</> : null} · Best of {match.bestOf}
          </TitleFacts>
        }
        title={
          match.teams.length > 0
            ? display.teams.map((team, index) => {
                const identity = match.teams[index];
                const side = identity && sides?.get(identity.entityId ?? identity.id);
                const name = <SideName side={side}>{team.name}</SideName>;
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
                    className={`font-mono tabular-nums ${(index ? secondColor : firstColor) ?? ""}`}
                  >
                    {index ? null : " "}
                    {scores[index] ?? "—"}
                    {index ? " " : null}
                  </span>
                ) : null;
                return (
                  <span className={titlePart} key={index}>
                    {index ? " vs " : null}
                    <TitleTeam
                      href={identity && team.name !== "TBD" ? identityHref(identity) : undefined}
                      before={index ? score : null}
                      after={index ? null : score}
                    >
                      {index ? logo : name}
                      {index ? name : logo}
                    </TitleTeam>
                  </span>
                );
              })
            : title
        }
        actions={
          overview && hidden && match.state === "final" ? (
            <Button
              variant="secondary"
              aria-label={`Reveal score for ${first.name} versus ${second.name}`}
              onPress={onReveal}
            >
              Reveal Score
            </Button>
          ) : vodUrl ? (
            <TextLink className="whitespace-nowrap" href={vodUrl} target="_blank" rel="noreferrer">
              Watch Game VOD
            </TextLink>
          ) : null
        }
      />
      <TabNav
        className="@max-[25rem]:[&>*]:px-2"
        label="Series"
        items={[
          { href: seriesHref(match), label: "Overview", current: current === "overview" },
          ...games.map((game) => ({
            href: seriesGameHref(match, game.number),
            label: `Game ${game.number}`,
            current: current === game.number,
            disabled: !played(game),
          })),
        ]}
      />
      <div
        className="flex min-w-0 flex-col gap-4 motion-safe:transition-opacity motion-safe:duration-(--motion-duration-fast) motion-safe:ease-(--motion-easing-enter) motion-safe:starting:opacity-80"
        key={current}
      >
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
    <aside className="mx-auto w-[min(100%,67.5rem)] min-w-0">
      {wide ? player : <DisclosurePanel title="Replay">{player}</DisclosurePanel>}
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

export interface SeriesGameSummary {
  number: number;
  /** In-game length from the archive, which excludes the draft. */
  durationSeconds: number | null;
  /** When the archive game started, after the draft. */
  startsAt?: string | null;
  teams: { id: string; side: "blue" | "red"; kills: number | null }[];
}

function TeamLogo({ team }: { team: Match["teams"][number] }) {
  return team.imageUrl && team.name !== "TBD" ? (
    <Avatar
      alt=""
      aria-hidden="true"
      entityKind="team"
      fallback={team.name}
      size="small"
      src={team.imageUrl}
    />
  ) : null;
}

function SeriesSummary({
  match,
  games,
  summaries,
}: {
  match: Match;
  games: SeriesGame[];
  summaries: SeriesGameSummary[];
}) {
  const byNumber = new Map(summaries.map((summary) => [summary.number, summary]));
  const finished = games.filter((game) => game.state === "finished");
  const teamColumns = match.teams.map((team, index) => ({
    id: team.id,
    header: (
      <span className="inline-flex items-center gap-2 font-sans text-sm font-medium tracking-normal text-fg normal-case">
        {index ? <TeamLogo team={team} /> : null}
        {team.name}
        {index ? null : <TeamLogo team={team} />}
      </span>
    ),
    align: index === 0 ? ("end" as const) : ("start" as const),
    render: (game: SeriesGame) => {
      const entry = byNumber
        .get(game.number)
        ?.teams.find((item) => item.id === (team.entityId ?? team.id));
      const winner = game.winnerId === team.id;
      return (
        <span
          className={
            entry?.side
              ? index
                ? "border-s-2 border-[color:var(--np-team-side)] ps-2"
                : "border-e-2 border-[color:var(--np-team-side)] pe-2"
              : undefined
          }
          data-side={entry?.side}
        >
          <span className={winner ? outcomeClass.win : undefined}>
            {entry?.kills == null ? (winner ? "Winner" : "—") : `${entry.kills} kills`}
          </span>
          {winner && entry?.kills != null ? (
            <span className="np-visually-hidden">Winner</span>
          ) : null}
        </span>
      );
    },
  }));
  return (
    <Panel className="min-w-0" title="Series Summary" padding="none">
      <Table
        className="border-t-0 [&_table]:min-w-0 [&_th]:whitespace-normal [&_th]:wrap-anywhere"
        caption="Series Games at a Glance"
        compact
        rows={finished}
        getRowKey={(game) => String(game.number)}
        columns={[
          ...teamColumns.slice(0, 1),
          {
            id: "game",
            header: "Game",
            align: "center",
            width: "5.5rem",
            render: (game) => {
              const duration = length(byNumber.get(game.number)?.durationSeconds ?? null);
              return (
                <span className="grid justify-items-center gap-1">
                  <TextLink href={seriesGameHref(match, game.number)}>Game {game.number}</TextLink>
                  {duration !== null ? <span className="np-meta">{duration}</span> : null}
                </span>
              );
            },
          },
          ...teamColumns.slice(1),
        ]}
      />
    </Panel>
  );
}

export function MatchPage({
  match,
  games,
  summaries = [],
  timezone,
  hideSpoilers,
  now,
}: {
  match: Match;
  games: SeriesGame[];
  summaries?: SeriesGameSummary[];
  timezone: string;
  hideSpoilers: boolean;
  now: string;
}) {
  const preferenceHidden = useSpoilerPreference(hideSpoilers);
  const [revealed, setRevealed] = useState(false);
  const hidden = preferenceHidden && !revealed;
  const byNumber = new Map(summaries.map((summary) => [summary.number, summary]));
  const clock = new Intl.DateTimeFormat("en-US", { timeStyle: "short", timeZone: timezone });
  const broadcasts = watchableBroadcasts(match);
  const hasReplay = match.state === "final" && broadcasts.length > 0;
  const hasSummary =
    match.state === "final" &&
    !hidden &&
    match.teams.length === 2 &&
    games.some((game) => game.state === "finished");
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
        <div className="w-full max-w-[560px]">
          <WatchPlayer broadcasts={broadcasts} />
        </div>
      ) : null}
      <div className="grid items-start gap-4">
        {games.length > 0 ? (
          <section className="flex flex-col gap-2">
            <h2 className="text-lg font-medium">Games</h2>
            <ol className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(min(100%,9rem),1fr))] gap-2 p-0">
              {games.map((game) => {
                const vodUrl = gameReplayUrl(match, game);
                const summary = byNumber.get(game.number);
                // The provider's times include the draft, so the archive's length comes first.
                const duration = played(game)
                  ? length(summary?.durationSeconds ?? observedSeconds(game))
                  : null;
                const startedAt =
                  game.state === "finished" ? (summary?.startsAt ?? game.startsAt) : null;
                const body = (
                  <>
                    <span className="text-sm font-semibold">Game {game.number}</span>
                    <Winner match={match} game={game} hidden={hidden} />
                    {duration !== null ? <span className="np-meta">{duration}</span> : null}
                  </>
                );
                return (
                  <li
                    key={game.number}
                    className="grid rounded-md border border-line bg-raised focus-within:border-line-accent hover:border-line-accent"
                  >
                    {played(game) ? (
                      <a
                        className={gameCardBody}
                        href={seriesGameHref(match, game.number)}
                        aria-label={`Open Game ${game.number}`}
                      >
                        {body}
                      </a>
                    ) : (
                      <div className={`${gameCardBody} text-fg-muted`} aria-disabled="true">
                        {body}
                      </div>
                    )}
                    {vodUrl ? (
                      <TextLink
                        className={replayClass}
                        href={vodUrl}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={`Watch Game ${game.number} VOD`}
                      >
                        Watch Game VOD
                      </TextLink>
                    ) : startedAt ? (
                      <span className={`${replayClass} np-meta`}>
                        Started{" "}
                        <time dateTime={startedAt}>{clock.format(new Date(startedAt))}</time>
                      </span>
                    ) : null}
                  </li>
                );
              })}
            </ol>
          </section>
        ) : (
          <EmptyState title="No Games Reported Yet" />
        )}
        {hasReplay || hasSummary ? (
          <div
            className={`grid items-start gap-4 ${hasReplay && hasSummary ? "@min-[70rem]:grid-cols-[minmax(0,67.5rem)_minmax(26rem,1fr)]" : ""}`}
          >
            {hasReplay ? <SeriesReplay broadcasts={broadcasts} /> : null}
            {hasSummary ? (
              <SeriesSummary match={match} games={games} summaries={summaries} />
            ) : null}
          </div>
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
  items,
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
  items?: ProItemIcons | undefined;
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
            <Button className="self-start" onPress={() => setRevealed(true)}>
              Reveal Game Statistics
            </Button>
          ) : null}
          {detail && !hidden ? (
            <DraftPanel detail={detail} portraits={portraits} fearless={fearless} />
          ) : null}
          <LineupTable
            game={game}
            detail={detail}
            hidden={hidden}
            portraits={portraits}
            items={items}
          />
          {!hidden ? (
            <>
              <ProTimeline game={game} detail={detail} winProbability={winProbability} />
              <GameDistributions game={game} detail={detail} portraits={portraits} />
            </>
          ) : null}
        </>
      ) : (
        <EmptyState title="Game Details Not Available Yet" />
      )}
    </SeriesShell>
  );
}
