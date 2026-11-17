"use client";
import { PlayersSection } from "./players";
import { ChampionIcon, EmptyState, LineChart, RoleIcon, TextLink } from "@summonersnet/ui";
import type {
  ChampionBlindability,
  ChampionJunglePaths,
  ChampionOverview,
} from "@summonersnet/data/contracts";
import { CounterPickSummary } from "../matchups/pages";
import { JunglePathsSection } from "./jungle-paths";
import { SavedViewsPanel } from "../saved-views/panel";
import { BuildsSection, LoadoutsSection, SkillsSection } from "./builds";
import { BucketsSection } from "./buckets";
import { SynergiesSection } from "./synergies";
import { ProSection } from "./pro";
import { ChampionFilters } from "./filters";
import { BuildCard } from "./build-card";
import { MatchupCards } from "./matchup-cards";
import { interval, percent, roleLabels, type MatchupSummary } from "./presentation";

const tierNotes = {
  S: "well above",
  A: "above",
  B: "close to",
  C: "below",
  D: "well below",
} as const;
const roleTabs = ["ALL", "TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"] as const;

type Query = ChampionOverview["query"];
/** The champion page URL for this query with its source or role changed. */
function championHref(id: string, q: Query, change: Partial<Pick<Query, "source" | "role">>) {
  const next = { ...q, ...change };
  const params = new URLSearchParams({ source: next.source, role: next.role });
  for (const name of ["patch", "region", "tier", "league"] as const) {
    const value = next[name];
    if (value) params.set(name, value);
  }
  return `/champions/${encodeURIComponent(id)}?${params}`;
}

function StatTile({ label, value, sample }: { label: string; value: string; sample: string }) {
  return (
    <div className="ev-stat-tile">
      <dt>
        {label}
        <small>{sample}</small>
      </dt>
      <dd>{value}</dd>
    </div>
  );
}

function TrendChart({
  title,
  rate,
  trend,
  color,
}: {
  title: string;
  rate: "winRate" | "pickRate" | "banRate";
  trend: ChampionOverview["trend"];
  color: 1 | 2 | 3;
}) {
  return (
    <div className="ev-card ev-trend">
      <LineChart
        title={title}
        color={color}
        xLabel="Patch"
        yLabel="%"
        xTicks={trend.map((t, i) => ({ x: i, label: t.patch }))}
        points={trend.map((t, i) => ({
          id: t.patch,
          label: `Patch ${t.patch}`,
          x: i,
          y: t[rate].value === null ? null : Math.round(t[rate].value * 1000) / 10,
          sampleCount: t[rate].sampleCount,
        }))}
      />
    </div>
  );
}

export function ChampionOverviewPage({
  overview,
  draftValue = null,
  error,
  junglePaths = null,
  matchupSummary = null,
}: {
  overview: ChampionOverview;
  draftValue?: ChampionBlindability | null;
  error: string | null;
  junglePaths?: ChampionJunglePaths | null;
  matchupSummary?: MatchupSummary | null;
}) {
  const { champion, query: q } = overview;
  const roleShare = new Map<string, ChampionOverview["roles"][number]["share"]>(
    overview.roles.map((r) => [r.role, r.share]),
  );
  const matchupRole = q.role === "ALL" ? (overview.roles[0]?.role ?? "MIDDLE") : q.role;
  return (
    <div className="np-stack ev-champion-page">
      <section className="ev-card ev-champion-hero" aria-label="Champion">
        <header className="ev-champion-hero__title">
          <ChampionIcon
            id={champion.id}
            name={champion.name}
            imageUrl={champion.imageUrl}
            size="large"
          />
          <div>
            <h1>{champion.name}</h1>
            {overview.patch ? (
              <p className="ev-champion-hero__subtitle">Patch {overview.patch}</p>
            ) : null}
            <nav aria-label="Champion Pages" className="ev-champion-hero__links">
              <TextLink
                href={`/champions/${champion.id}/matchups?source=${q.source}&role=${matchupRole}${overview.patch ? `&patch=${overview.patch}` : ""}`}
              >
                Lane Matchups
              </TextLink>
              <TextLink
                href={`/heatmaps?subjectKind=champion&subject=${champion.id}${q.source === "solo" && overview.patch ? `&patch=${overview.patch}` : ""}`}
              >
                Heatmaps
              </TextLink>
            </nav>
          </div>
        </header>
        <div className="ev-champion-hero__controls">
          <nav aria-label="Role" className="ev-tabs">
            {roleTabs.map((role) => {
              const share = roleShare.get(role);
              return (
                <a
                  key={role}
                  className="ev-tab ev-tab--role"
                  href={championHref(champion.id, q, { role })}
                  aria-current={q.role === role ? "page" : undefined}
                  aria-label={share ? `${roleLabels[role]} ${percent(share)}` : roleLabels[role]}
                >
                  <RoleIcon role={role} />
                  {share ? <small>{percent(share)}</small> : null}
                </a>
              );
            })}
          </nav>
          <nav aria-label="Source" className="ev-tabs ev-tabs--segmented">
            {(["solo", "pro"] as const).map((source) => (
              <a
                key={source}
                className="ev-tab"
                href={championHref(champion.id, q, { source })}
                aria-current={q.source === source ? "page" : undefined}
              >
                {source === "solo" ? "Solo Queue" : "Pro Play"}
              </a>
            ))}
          </nav>
        </div>
        <ChampionFilters
          action={`/champions/${champion.id}`}
          query={q}
          facets={overview.facets}
          scopeOnly
        />
      </section>
      {error ? (
        <p role="alert">{error}</p>
      ) : !overview.patch ? (
        <EmptyState
          title="No Statistics for This Selection"
          description={
            <span>
              Statistics appear once games are stored and aggregated. See the{" "}
              <TextLink href="/tier-list">tier list</TextLink>.
            </span>
          }
        />
      ) : (
        <section className="np-stack" aria-label="Champion Statistics">
          <dl className={`ev-card ev-stat-strip ev-stat-strip--${overview.tier ?? "unknown"}`}>
            <div className="ev-stat-tile ev-stat-tile--tier">
              <dt>Tier</dt>
              <dd>
                <span
                  className="ev-tier-badge"
                  title={
                    overview.tier &&
                    overview.baseline !== null &&
                    overview.shrunkWinRate.value !== null
                      ? `Shrunk win rate ${percent(overview.shrunkWinRate)}, ${tierNotes[overview.tier]} the ${percent({ value: overview.baseline, sampleCount: 1 })} average of this selection.`
                      : "Unknown until this champion has games with known results."
                  }
                >
                  {overview.tier ?? "Unknown"}
                </span>
              </dd>
            </div>
            <StatTile
              label="Win Rate"
              value={percent(overview.winRate)}
              sample={`${interval(overview.winRate)} · ${overview.winRate.sampleCount.toLocaleString()} Results`}
            />
            <StatTile
              label="Pick Rate"
              value={percent(overview.pickRate)}
              sample={`${overview.pickRate.sampleCount.toLocaleString()} Games`}
            />
            <StatTile
              label="Ban Rate"
              value={percent(overview.banRate)}
              sample={`${overview.banRate.sampleCount.toLocaleString()} Games`}
            />
            <StatTile
              label="Games"
              value={overview.games.toLocaleString()}
              sample={`of ${overview.sliceGames.toLocaleString()}`}
            />
          </dl>
          <BuildCard builds={overview.builds} />
          <MatchupCards championId={champion.id} summary={matchupSummary} />
          <div className="ev-trend-grid">
            <TrendChart
              title={`${champion.name} Win Rate by Patch`}
              rate="winRate"
              trend={overview.trend}
              color={1}
            />
            <TrendChart
              title={`${champion.name} Pick Rate by Patch`}
              rate="pickRate"
              trend={overview.trend}
              color={2}
            />
            <TrendChart
              title={`${champion.name} Ban Rate by Patch`}
              rate="banRate"
              trend={overview.trend}
              color={3}
            />
          </div>
          {draftValue ? (
            <section className="ev-card np-stack" aria-labelledby="counter-pick-value">
              <h2 id="counter-pick-value">Counter-Pick Value</h2>
              <CounterPickSummary
                value={draftValue}
                listHref={`/matchups/${q.role}/counter-picks?source=${q.source}&patch=${overview.patch}`}
              />
            </section>
          ) : null}
          <div className="ev-card">
            <ProSection overview={overview} />
          </div>
          {overview.buckets ? (
            <div className="ev-card">
              <BucketsSection buckets={overview.buckets} />
            </div>
          ) : null}
          {junglePaths && (junglePaths.games > 0 || q.role === "JUNGLE") ? (
            <div className="ev-card">
              <JunglePathsSection paths={junglePaths} champion={champion.name} />
            </div>
          ) : null}
          {overview.synergies ? (
            <div className="ev-card">
              <SynergiesSection overview={overview} />
            </div>
          ) : null}
          {overview.builds ? (
            <details className="ev-card ev-all-builds">
              <summary>All Builds, Runes and Skills</summary>
              <LoadoutsSection builds={overview.builds} />
              <SkillsSection builds={overview.builds} />
              <BuildsSection builds={overview.builds} />
            </details>
          ) : null}
          <PlayersSection overview={overview} />
        </section>
      )}
      <SavedViewsPanel path={`/champions/${champion.id}`} defaultName={champion.name} />
    </div>
  );
}
