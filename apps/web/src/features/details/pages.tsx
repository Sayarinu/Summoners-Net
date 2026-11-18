"use client";
import { useState } from "react";
import { Avatar, Breadcrumb, Button, TextLink } from "@summonersnet/ui";
import type { Game, HistoricalGameDetail, ProGameWinProbability } from "@summonersnet/data";
import { type ChampionPortraits } from "../browse/visuals";
import { identityHref, gameTeams, seriesGameHref, seriesHref } from "../browse/presentation";
import { DraftPanel } from "./draft";
import type { ProItemIcons } from "./player-build";
import { LineupTable } from "./lineup";
import { ProTimeline } from "./pro-win-probability";
import { GameDistributions } from "./game-distributions";
export { MatchPage, SeriesGamePage } from "./series";
export function GamePage({
  game,
  timezone,
  hideSpoilers,
  winProbability,
  detail,
  portraits,
  items,
  vodUrl,
  round,
  series = null,
}: {
  game: Game;
  detail?: HistoricalGameDetail | null;
  timezone: string;
  hideSpoilers: boolean;
  portraits?: ChampionPortraits;
  items?: ProItemIcons | undefined;
  vodUrl?: string | null;
  round?: string | null;
  /** Win probability estimates from recorded game states. */
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
          {
            label: teams.map((team) => team.name).join(" vs "),
            ...(series ? { href: seriesHref({ id: series.matchId }) } : {}),
          },
          { label: `Game ${game.number}` },
        ]}
      />
      <header className="ev-title">
        <div>
          <div className="np-cluster ev-series-title__facts">
            <span className="np-overline">
              {[game.event, round].filter(Boolean).join(" · ")} ·{" "}
              <time dateTime={game.occurredAt}>
                {new Intl.DateTimeFormat("en-US", {
                  dateStyle: "medium",
                  timeZone: timezone,
                }).format(new Date(game.occurredAt))}
              </time>{" "}
              · Game {game.number}
              {game.patch ? ` · Patch ${game.patch}` : ""}
            </span>
            {game.complete ? null : <span className="np-meta">Partial Record</span>}
          </div>
          <h1>
            {teams.map((team, index) => {
              const logo = team.imageUrl ? (
                <Avatar
                  alt=""
                  aria-hidden="true"
                  entityKind="team"
                  fallback={team.name}
                  size="small"
                  src={team.imageUrl}
                />
              ) : null;
              const name = (
                <span className="ev-side-name" data-side={team.side} title={`${team.side} side`}>
                  {team.name}
                </span>
              );
              return (
                <span key={team.id}>
                  {index ? " vs " : null}
                  <span className="ev-series-title__team">
                    <a className="ev-series-title__identity" href={identityHref(team)}>
                      {index ? logo : name}
                      {index ? name : logo}
                    </a>
                  </span>
                </span>
              );
            })}
          </h1>
        </div>
        {vodUrl ? (
          <TextLink href={vodUrl} target="_blank" rel="noreferrer">
            Watch Game VOD
          </TextLink>
        ) : null}
      </header>
      {hidden ? <Button onPress={() => setHidden(false)}>Reveal Game Statistics</Button> : null}
      {!hidden && detail ? <DraftPanel detail={detail} portraits={portraits} /> : null}
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
      {series ? (
        <TextLink href={seriesGameHref({ id: series.matchId }, series.number)}>
          Open in Series
        </TextLink>
      ) : null}
    </div>
  );
}
