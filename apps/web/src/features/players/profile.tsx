"use client";
import { useState, type ReactNode } from "react";
import type { ChampionPool as ChampionPoolData } from "@summonersnet/data/contracts";
import type {
  BrowseQuery,
  Game,
  PlayerPerformance,
  PlayerSeason,
  Profile,
} from "@summonersnet/data";
import {
  Button,
  PageHeader,
  PlayerIdentity,
  Panel,
  Stat,
  StatGroup,
  TeamIdentity,
} from "@summonersnet/ui";
import { Filters, Pages } from "../browse/components";
import { useSpoilerPreference } from "../browse/match-group";
import { dateTime, gameTeams, identityHref } from "../browse/presentation";
import { ChampionPortrait, GameRecord, type ChampionPortraits } from "../browse/visuals";
import { ChampionPool } from "../teams/pages";
import { PlayerChampionPool } from "./champion-pool";

type Metric = keyof Omit<PlayerPerformance, "games">;
type StatLine = { label: string; metric: Metric; format: (value: number) => string };

const percent = (value: number) => `${(value * 100).toFixed(1)}%`;
const fixed = (digits: number) => (value: number) => value.toFixed(digits);
const signed = (value: number) => {
  const rounded = Math.round(value);
  return rounded > 0 ? `+${rounded}` : String(rounded);
};

const combat: StatLine[] = [
  { label: "Kill Participation", metric: "killParticipation", format: percent },
  { label: "Average Kills", metric: "killsPerGame", format: fixed(1) },
  { label: "Average Deaths", metric: "deathsPerGame", format: fixed(1) },
  { label: "Average Assists", metric: "assistsPerGame", format: fixed(1) },
  { label: "Pentakills", metric: "pentakills", format: fixed(0) },
];
const earlyGame: StatLine[] = [
  { label: "Gold Diff at 15", metric: "goldDiffAt15", format: signed },
  { label: "CS Diff at 15", metric: "csDiffAt15", format: signed },
  { label: "XP Diff at 15", metric: "xpDiffAt15", format: signed },
  { label: "First Blood Participation", metric: "firstBloodParticipation", format: percent },
  { label: "First Blood Victim", metric: "firstBloodVictim", format: percent },
];
const economy: StatLine[] = [
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

/** The sample behind a value whenever some selected games did not record it. */
function sample(count: number, games: number) {
  return count === games ? {} : { detail: `${count} ${count === 1 ? "game" : "games"}` };
}

const statGrid = "grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-x-3 gap-y-5";

function StatLines({ stats, performance }: { stats: StatLine[]; performance: PlayerPerformance }) {
  return stats.map((stat) => {
    const { value, sampleCount } = performance[stat.metric];
    return (
      <Stat
        key={stat.metric}
        label={stat.label}
        value={value === null ? "—" : stat.format(value)}
        {...sample(sampleCount, performance.games)}
      />
    );
  });
}

function StatPanel({
  title,
  hidden,
  onReveal,
  games,
  stats,
  performance,
  children,
}: {
  title: string;
  hidden: boolean;
  onReveal: () => void;
  games: number;
  stats: StatLine[];
  performance: PlayerPerformance;
  children?: ReactNode;
}) {
  return (
    <Panel title={title}>
      {hidden ? (
        <Button onPress={onReveal}>Reveal Statistics</Button>
      ) : games === 0 ? (
        <p>No eligible games in this selection.</p>
      ) : (
        <StatGroup className={statGrid}>
          {children}
          <StatLines stats={stats} performance={performance} />
        </StatGroup>
      )}
    </Panel>
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
  const versus = ordered.map((t) => t.name).join(" versus ");
  return (
    <article
      className="relative grid min-h-19 grid-cols-[minmax(120px,18%)_44px_minmax(0,1fr)_minmax(120px,max-content)] items-center gap-4 border-b border-line px-5 py-3 last:border-b-0 focus-within:bg-interactive/50 hover:bg-interactive/50 max-[700px]:grid-cols-[44px_minmax(0,1fr)_auto] max-[700px]:gap-x-3 max-[700px]:gap-y-2 max-[700px]:px-3"
      data-result={hidden ? undefined : (own?.won ?? undefined)}
    >
      <div className="grid gap-0.5 text-sm text-fg-muted max-[700px]:col-span-full max-[700px]:flex max-[700px]:gap-2">
        <span>
          {game.league} · Game {game.number}
        </span>
        <span className="font-mono text-xs">{dateTime(game.occurredAt, timezone)}</span>
      </div>
      <div>
        <ChampionPortrait name={own?.champion ?? null} portraits={portraits} size="medium" />
      </div>
      <a
        className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 text-inherit no-underline max-[700px]:flex-col max-[700px]:items-start"
        href={href}
        aria-label={`Game ${game.number}: ${versus}, ${dateTime(game.occurredAt, timezone)}`}
      >
        {ordered.map((team, index) => (
          <span key={team.id} className="inline-flex min-w-0 items-center gap-3">
            {index ? <span className="text-sm text-fg-muted max-[700px]:hidden">vs</span> : null}
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
        <Button
          aria-label={`Reveal result for game ${game.number}, ${versus}`}
          className="justify-self-end"
          size="compact"
          variant="ghost"
          onPress={onReveal}
        >
          Result Hidden
        </Button>
      ) : (
        <div className="grid justify-items-end gap-0.5 text-right text-sm">
          <span className="font-mono text-md text-fg">{line ?? "—"}</span>
          <span
            className={
              own?.won ? "text-success" : own?.won === false ? "text-loss" : "text-fg-muted"
            }
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
  championPool,
  splits,
}: {
  profile: Profile;
  performance: PlayerPerformance;
  portraits?: ChampionPortraits;
  seasons: PlayerSeason[];
  query: BrowseQuery;
  hideSpoilers: boolean;
  /** The player's champions with per-champion statistics; without it the compact pool shows. */
  championPool?: ChampionPoolData;
  /** The pro splits this player played in the selected year. */
  splits?: string[];
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
    <div className="mx-auto flex w-full max-w-content min-w-0 flex-col gap-6">
      <PageHeader
        breadcrumbs={[{ label: "Players", href: "/players" }, { label: identity.name }]}
        title={<span className="np-visually-hidden">{identity.name}</span>}
        className="gap-0"
      />
      <Panel aria-label={identity.name}>
        <div className="flex flex-wrap items-center justify-between gap-5 p-2 max-[600px]:p-0">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <PlayerIdentity
              handle={identity.name}
              size="display"
              role={identity.role}
              {...(identity.imageUrl ? { portrait: identity.imageUrl } : {})}
            />
            {team ? (
              <div className="border-l border-line-strong pl-6 max-[700px]:border-l-0 max-[700px]:pl-0">
                <TeamIdentity
                  name={team.name}
                  shortName={team.name}
                  size="medium"
                  href={identityHref(team)}
                  {...(season ? { detail: season.league } : {})}
                  {...(team.imageUrl ? { logo: team.imageUrl } : {})}
                />
              </div>
            ) : season ? (
              <span className="np-meta">{season.league}</span>
            ) : null}
          </div>
          <Filters
            key={[year, query.q, query.league, query.split, query.stage].join("-")}
            history
            view="series"
            query={query}
            seasons={years}
            selectedYear={year}
            {...(splits ? { splits } : {})}
            className="max-[600px]:w-full"
          />
        </div>
      </Panel>
      <div className="grid grid-cols-[minmax(0,1.7fr)_minmax(270px,1fr)] gap-4 max-[1150px]:grid-cols-1">
        <StatPanel
          title="Season Performance"
          hidden={hidden}
          onReveal={reveal}
          games={summary.eligibleGames}
          stats={combat}
          performance={performance}
        >
          <Stat
            label="Game Record"
            value={
              <GameRecord
                wins={summary.wins}
                known={summary.resultGames}
                total={summary.eligibleGames}
              />
            }
          />
          <Stat
            label="Win Rate"
            value={summary.winRate === null ? "—" : percent(summary.winRate)}
          />
          <Stat
            label="KDA"
            value={summary.kda?.toFixed(2) ?? "—"}
            {...sample(summary.kdaGames, summary.eligibleGames)}
          />
        </StatPanel>
        <StatPanel
          title="Early Game"
          hidden={hidden}
          onReveal={reveal}
          games={performance.games}
          stats={earlyGame}
          performance={performance}
        />
      </div>
      <StatPanel
        title="Economy, Damage and Vision"
        hidden={hidden}
        onReveal={reveal}
        games={performance.games}
        stats={economy}
        performance={performance}
      />
      <Panel title="Past Games" padding="none">
        {games.items.length ? (
          <div className="grid">
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
          <p className="p-4">No games match these filters.</p>
        )}
        {games.total > games.pageSize && (
          <div className="border-t border-line px-4">
            <Pages data={games} />
          </div>
        )}
      </Panel>
      {!hidden && championPool && championPool.page.total > 0 ? (
        <PlayerChampionPool
          pool={championPool}
          portraits={portraits}
          filters={{
            ...(typeof query.year === "number" ? { year: String(query.year) } : { year: "all" }),
            ...(query.league ? { league: query.league } : {}),
          }}
        />
      ) : !hidden && summary.champions.length > 0 ? (
        <ChampionPool champions={summary.champions} portraits={portraits} />
      ) : null}
    </div>
  );
}
