"use client";
import "../teams/teams.css";
import "./players.css";
import { useState, type ReactNode } from "react";
import type {
  BrowseQuery,
  Game,
  PlayerPerformance,
  PlayerSeason,
  Profile,
  SampledValue,
} from "@summonersnet/data";
import { Breadcrumb, Button, PlayerIdentity, TeamIdentity } from "@summonersnet/ui";
import { Filters, Pages } from "../browse/components";
import { useSpoilerPreference } from "../browse/match-group";
import { dateTime, gameTeams, identityHref } from "../browse/presentation";
import { ChampionPortrait, GameRecord, type ChampionPortraits } from "../browse/visuals";
import { ChampionPool } from "../teams/pages";

type Metric = keyof Omit<PlayerPerformance, "games">;
type Stat = { label: string; metric: Metric; format: (value: number) => string };

const percent = (value: number) => `${(value * 100).toFixed(1)}%`;
const fixed = (digits: number) => (value: number) => value.toFixed(digits);
const signed = (value: number) => {
  const rounded = Math.round(value);
  return rounded > 0 ? `+${rounded}` : String(rounded);
};

const combat: Stat[] = [
  { label: "Kill Participation", metric: "killParticipation", format: percent },
  { label: "Average Kills", metric: "killsPerGame", format: fixed(1) },
  { label: "Average Deaths", metric: "deathsPerGame", format: fixed(1) },
  { label: "Average Assists", metric: "assistsPerGame", format: fixed(1) },
  { label: "Pentakills", metric: "pentakills", format: fixed(0) },
];
const earlyGame: Stat[] = [
  { label: "Gold Diff at 15", metric: "goldDiffAt15", format: signed },
  { label: "CS Diff at 15", metric: "csDiffAt15", format: signed },
  { label: "XP Diff at 15", metric: "xpDiffAt15", format: signed },
  { label: "First Blood Participation", metric: "firstBloodParticipation", format: percent },
  { label: "First Blood Victim", metric: "firstBloodVictim", format: percent },
];
const economy: Stat[] = [
  { label: "CS per Minute", metric: "csPerMinute", format: fixed(1) },
  { label: "Gold per Minute", metric: "goldPerMinute", format: fixed(0) },
  { label: "Gold Share", metric: "goldShare", format: percent },
  { label: "Damage per Minute", metric: "damagePerMinute", format: fixed(0) },
  { label: "Damage Share", metric: "damageShare", format: percent },
  { label: "Vision Score per Minute", metric: "visionScorePerMinute", format: fixed(2) },
  { label: "Wards per Minute", metric: "wardsPerMinute", format: fixed(2) },
  { label: "Wards Cleared per Minute", metric: "wardsClearedPerMinute", format: fixed(2) },
  { label: "Control Wards per Game", metric: "controlWardsPerGame", format: fixed(1) },
];

/** A value with its sample size whenever some selected games did not record it. */
function SampledStat({
  value,
  games,
  format,
}: {
  value: SampledValue;
  games: number;
  format: (value: number) => string;
}) {
  return (
    <>
      {value.value === null ? "—" : format(value.value)}
      {value.sampleCount !== games && (
        <small>
          {value.sampleCount} {value.sampleCount === 1 ? "game" : "games"}
        </small>
      )}
    </>
  );
}

function StatList({
  stats,
  performance,
  children,
}: {
  stats: Stat[];
  performance: PlayerPerformance;
  children?: ReactNode;
}) {
  return (
    <dl className="ev-team-stats ev-player-stats">
      {children}
      {stats.map((stat) => (
        <div key={stat.metric}>
          <dt>{stat.label}</dt>
          <dd>
            <SampledStat
              value={performance[stat.metric]}
              games={performance.games}
              format={stat.format}
            />
          </dd>
        </div>
      ))}
    </dl>
  );
}

function StatPanel({
  title,
  hidden,
  onReveal,
  games,
  children,
  className,
}: {
  title: string;
  hidden: boolean;
  onReveal: () => void;
  games: number;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={["ev-team-panel", className].filter(Boolean).join(" ")}>
      <h2>{title}</h2>
      {hidden ? (
        <Button onPress={onReveal}>Reveal Statistics</Button>
      ) : games === 0 ? (
        <p>No eligible games in this selection.</p>
      ) : (
        children
      )}
    </section>
  );
}

/** One game from the player's point of view: their champion, both teams, line and result. */
function PlayerGameRow({
  game,
  playerIds,
  portraits,
  timezone,
  hidden,
  onReveal,
}: {
  game: Game;
  playerIds: ReadonlySet<string>;
  portraits?: ChampionPortraits | undefined;
  timezone: string;
  hidden: boolean;
  onReveal: () => void;
}) {
  const own = game.participants.find(
    (p) => p.player && (playerIds.has(p.player.id) || playerIds.has(p.player.entityId ?? "")),
  );
  const teams = gameTeams(game);
  const ordered = own ? [...teams].sort((a) => (a.id === own.team.id ? -1 : 1)) : teams;
  const href = `/games/${encodeURIComponent(game.id)}`;
  const line =
    own && own.kills !== null && own.deaths !== null && own.assists !== null
      ? `${own.kills} / ${own.deaths} / ${own.assists}`
      : null;
  return (
    <article className="ev-player-game" data-result={hidden ? undefined : (own?.won ?? undefined)}>
      <div className="ev-player-game__time">
        <span>
          {game.league} · Game {game.number}
        </span>
        <span>{dateTime(game.occurredAt, timezone)}</span>
      </div>
      <div className="ev-player-game__champion">
        <ChampionPortrait name={own?.champion ?? null} portraits={portraits} size="medium" />
      </div>
      <a
        className="ev-player-game__teams"
        href={href}
        aria-label={`Game ${game.number}: ${ordered.map((t) => t.name).join(" versus ")}, ${dateTime(game.occurredAt, timezone)}`}
      >
        {ordered.map((team, index) => (
          <span key={team.id} className="ev-player-game__team">
            {index ? <span className="ev-player-game__versus">vs</span> : null}
            <TeamIdentity
              name={team.name}
              shortName={team.name}
              size="compact"
              {...(team.imageUrl ? { logo: team.imageUrl } : {})}
            />
          </span>
        ))}
      </a>
      {hidden ? (
        <button
          aria-label={`Reveal result for game ${game.number}, ${ordered.map((t) => t.name).join(" versus ")}`}
          className="ev-player-game__spoiler"
          onClick={onReveal}
          type="button"
        >
          Result Hidden
        </button>
      ) : (
        <div className="ev-player-game__line">
          <span>{line ?? "—"}</span>
          <span
            className={own?.won ? "ev-outcome--win" : own?.won === false ? "ev-outcome--loss" : ""}
          >
            {own?.won ? "Win" : own?.won === false ? "Loss" : "Unknown"}
          </span>
        </div>
      )}
    </article>
  );
}

export function PlayerProfile({
  profile,
  performance,
  portraits,
  seasons,
  query,
  hideSpoilers,
}: {
  profile: Profile;
  performance: PlayerPerformance;
  portraits?: ChampionPortraits;
  seasons: PlayerSeason[];
  query: BrowseQuery;
  hideSpoilers: boolean;
}) {
  const { identity, summary, roster, games } = profile;
  const spoilersHidden = useSpoilerPreference(hideSpoilers);
  const [revealed, setRevealed] = useState(false);
  const [revealedGames, setRevealedGames] = useState<string[]>([]);
  const hidden = spoilersHidden && !revealed;
  const reveal = () => setRevealed(true);
  const season =
    seasons.find((s) => s.year === query.year) ?? (!query.year ? seasons[0] : undefined);
  const year = typeof query.year === "number" ? String(query.year) : "all";
  const years = seasons.map((s) => s.year);
  if (typeof query.year === "number" && !years.includes(query.year)) years.push(query.year);
  // A player profile's roster lists only this player's observed teams; the newest is current.
  const team = [...roster].sort((a, b) => b.observedAt.localeCompare(a.observedAt))[0]?.team;
  const playerIds = new Set([identity.id, ...(profile.sources ?? []).map((s) => s.id)]);
  const timezone = query.timezone ?? "UTC";
  return (
    <div className="ev-teams ev-player-profile np-stack">
      <Breadcrumb items={[{ label: "Players", href: "/players" }, { label: identity.name }]} />
      <header className="ev-team-banner">
        <div className="ev-player-heading">
          <h1 className="np-visually-hidden">{identity.name}</h1>
          <PlayerIdentity
            handle={identity.name}
            role={identity.role}
            {...(identity.imageUrl ? { portrait: identity.imageUrl } : {})}
          />
          {team ? (
            <TeamIdentity
              name={team.name}
              shortName={team.name}
              size="compact"
              href={identityHref(team)}
              {...(season ? { detail: season.league } : {})}
              {...(team.imageUrl ? { logo: team.imageUrl } : {})}
            />
          ) : season ? (
            <span className="np-meta">{season.league}</span>
          ) : null}
        </div>
        <Filters
          key={[year, query.q, query.league].join("-")}
          history
          view="series"
          query={query}
          seasons={years}
          selectedYear={year}
        />
      </header>
      <div className="ev-team-overview">
        <StatPanel
          title="Season Performance"
          hidden={hidden}
          onReveal={reveal}
          games={summary.eligibleGames}
        >
          <StatList stats={combat} performance={performance}>
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
              <dd>{summary.winRate === null ? "—" : percent(summary.winRate)}</dd>
            </div>
            <div>
              <dt>KDA</dt>
              <dd>
                {summary.kda?.toFixed(2) ?? "—"}
                {summary.kdaGames !== summary.eligibleGames && (
                  <small>
                    {summary.kdaGames} {summary.kdaGames === 1 ? "game" : "games"}
                  </small>
                )}
              </dd>
            </div>
          </StatList>
        </StatPanel>
        <StatPanel title="Early Game" hidden={hidden} onReveal={reveal} games={performance.games}>
          <StatList stats={earlyGame} performance={performance} />
        </StatPanel>
      </div>
      <StatPanel
        title="Economy, Damage and Vision"
        hidden={hidden}
        onReveal={reveal}
        games={performance.games}
      >
        <StatList stats={economy} performance={performance} />
      </StatPanel>
      <section className="ev-team-history">
        <div className="ev-team-history-head">
          <h2>Past Games</h2>
        </div>
        {games.items.length ? (
          <div className="ev-player-games">
            {games.items.map((game) => (
              <PlayerGameRow
                key={game.id}
                game={game}
                playerIds={playerIds}
                portraits={portraits}
                timezone={timezone}
                hidden={spoilersHidden && !revealed && !revealedGames.includes(game.id)}
                onReveal={() => setRevealedGames((current) => [...current, game.id])}
              />
            ))}
          </div>
        ) : (
          <p>No games match these filters.</p>
        )}
        {games.total > games.pageSize && <Pages data={games} />}
      </section>
      {!hidden && summary.champions.length > 0 && (
        <ChampionPool champions={summary.champions} portraits={portraits} />
      )}
    </div>
  );
}
