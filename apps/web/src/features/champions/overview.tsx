"use client";
import { PlayersSection } from "./players";
import {
  ChampionIdentity,
  DisclosurePanel,
  EmptyState,
  LineChart,
  PageHeader,
  Panel,
  RoleIcon,
  Stat,
  StatGroup,
  TabNav,
  TextLink,
} from "@summonersnet/ui";
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
import {
  PerformanceStats,
  ProHeaderStats,
  ProHistorySection,
  ProLeaguesSection,
  ProPlayersSection,
  ProSection,
} from "./pro";
import { ChampionFilters } from "./filters";
import { ItemsPanel, RunesPanel, SpellsAndSkillsPanel } from "./solo-build";
import { MatchupCards } from "./matchup-cards";
import { appendPatches, patchesLabel, percent, type MatchupSummary } from "./presentation";

const tierNotes = {
  S: "well above",
  A: "above",
  B: "close to",
  C: "below",
  D: "well below",
} as const;
const tierColors = {
  S: "text-success",
  A: "text-chart-1",
  B: "text-info",
  C: "text-warning",
  D: "text-loss",
} as const;
const roleTabs = ["ALL", "TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"] as const;

type Query = ChampionOverview["query"];
/** The champion page URL for this query with its source or role changed. */
function championHref(id: string, q: Query, change: Partial<Pick<Query, "source" | "role">>) {
  const next = { ...q, ...change };
  const params = new URLSearchParams({ source: next.source, role: next.role });
  appendPatches(params, next.patch ?? []);
  for (const name of ["region", "tier", "stage", "league"] as const) {
    const value = next[name];
    if (value) params.set(name, value);
  }
  return `/champions/${encodeURIComponent(id)}?${params}`;
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
  );
}

/** The headline figures beside the champion: tier, win, pick and ban rates, and games. */
function HeaderStats({ overview }: { overview: ChampionOverview }) {
  return (
    <StatGroup
      label="Headline Statistics"
      className="grid grid-cols-5 gap-5 max-[900px]:grid-cols-3 max-[500px]:grid-cols-2"
    >
      <Stat
        label="Tier"
        size="lg"
        value={
          <span
            className={overview.tier ? tierColors[overview.tier] : "text-fg-muted"}
            title={
              overview.tier && overview.baseline !== null && overview.shrunkWinRate.value !== null
                ? `Shrunk win rate ${percent(overview.shrunkWinRate)}, ${tierNotes[overview.tier]} the ${percent({ value: overview.baseline, sampleCount: 1 })} average of this selection.`
                : "Unknown until this champion has games with known results."
            }
          >
            {overview.tier ?? "Unknown"}
          </span>
        }
      />
      <Stat
        label="Win Rate"
        size="lg"
        value={percent(overview.winRate)}
        detail={`${overview.winRate.sampleCount.toLocaleString()} Games`}
      />
      <Stat
        label="Pick Rate"
        size="lg"
        value={percent(overview.pickRate)}
        detail={`${overview.pickRate.sampleCount.toLocaleString()} Games`}
      />
      <Stat
        label="Ban Rate"
        size="lg"
        value={percent(overview.banRate)}
        detail={`${overview.banRate.sampleCount.toLocaleString()} Games`}
      />
      <Stat
        label="Games"
        size="lg"
        value={overview.games.toLocaleString()}
        detail={`of ${overview.sliceGames.toLocaleString()}`}
      />
    </StatGroup>
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
  // Counter-pick value shows once it has a stored score.
  const counterPick =
    draftValue?.score !== null && draftValue?.score !== undefined ? (
      <Panel title="Counter-Pick Value">
        <CounterPickSummary
          value={draftValue}
          listHref={`/matchups/${q.role}/counter-picks?source=${q.source}&patch=${overview.patch}`}
        />
      </Panel>
    ) : null;
  // Jungle paths are shown for junglers: the jungle role, or a champion played mostly there.
  const jungler = q.role === "JUNGLE" || (q.role === "ALL" && overview.roles[0]?.role === "JUNGLE");
  return (
    <div className="mx-auto flex w-full max-w-content min-w-0 flex-col gap-6">
      <PageHeader
        breadcrumbs={[{ label: "Champions", href: "/champions" }, { label: champion.name }]}
        title={<span className="np-visually-hidden">{champion.name}</span>}
        className="gap-0"
      />
      <Panel aria-label={champion.name}>
        <div className="flex flex-col gap-4 p-2 max-[600px]:p-0">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <ChampionIdentity
              id={champion.id}
              name={champion.name}
              imageUrl={champion.imageUrl}
              size="display"
              {...(overview.patch ? { detail: patchesLabel(overview.combined) } : {})}
            />
            <TabNav
              label="Source"
              variant="segmented"
              items={(["solo", "pro"] as const).map((source) => ({
                href: championHref(champion.id, q, { source }),
                label: source === "solo" ? "Solo Queue" : "Pro Play",
                current: q.source === source,
              }))}
            />
          </div>
          {overview.patch ? (
            <div className="border-t border-line pt-4">
              {q.source === "pro" ? (
                <ProHeaderStats pro={overview.pro} />
              ) : (
                <HeaderStats overview={overview} />
              )}
            </div>
          ) : null}
          <div className="flex flex-wrap items-end justify-between gap-4 border-t border-line pt-4">
            <TabNav
              label="Role"
              variant="segmented"
              items={roleTabs.map((role) => {
                const share = roleShare.get(role);
                return {
                  href: championHref(champion.id, q, { role }),
                  // The space keeps the role and its share apart in the link's name.
                  label: (
                    <>
                      <RoleIcon role={role} />{" "}
                    </>
                  ),
                  current: q.role === role,
                  ...(share ? { meta: percent(share) } : {}),
                };
              })}
            />
            <ChampionFilters
              action={`/champions/${champion.id}`}
              query={q}
              facets={overview.facets}
              scopeOnly
            />
          </div>
        </div>
      </Panel>
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
        <section className="flex min-w-0 flex-col gap-6" aria-label="Champion Statistics">
          {overview.builds ? (
            <>
              <div className="grid grid-cols-2 items-start gap-4 max-[1150px]:grid-cols-1">
                <RunesPanel builds={overview.builds} />
                <SpellsAndSkillsPanel builds={overview.builds} />
              </div>
              <ItemsPanel builds={overview.builds} />
            </>
          ) : null}
          {q.source === "pro" ? (
            <>
              <ProSection overview={overview} />
              <ProLeaguesSection overview={overview} />
              <ProPlayersSection overview={overview} />
            </>
          ) : null}
          <MatchupCards summary={matchupSummary} />
          {counterPick}
          <SynergiesSection overview={overview} />
          {overview.performance && overview.performance.games > 0 ? (
            <Panel title="Game Statistics">
              <PerformanceStats
                label="Solo-Queue Performance"
                performance={overview.performance}
                omitUnrecorded
              />
            </Panel>
          ) : null}
          {q.source === "pro" ? <ProHistorySection overview={overview} /> : null}
          {jungler && junglePaths ? (
            <JunglePathsSection paths={junglePaths} champion={champion.name} />
          ) : null}
          <DisclosurePanel title="Patch Trends and When It Wins">
            <div className="flex flex-col gap-6">
              <div className="grid grid-cols-3 gap-4 max-[1150px]:grid-cols-2 max-[700px]:grid-cols-1">
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
              <BucketsSection buckets={overview.buckets} />
            </div>
          </DisclosurePanel>
          {overview.builds ? (
            <DisclosurePanel title="All Builds, Runes and Skills">
              <div className="flex flex-col gap-6">
                <LoadoutsSection builds={overview.builds} />
                <SkillsSection builds={overview.builds} />
                <BuildsSection builds={overview.builds} />
              </div>
            </DisclosurePanel>
          ) : null}
          <PlayersSection overview={overview} />
        </section>
      )}
      <SavedViewsPanel path={`/champions/${champion.id}`} defaultName={champion.name} />
    </div>
  );
}
