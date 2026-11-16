"use client";
import { ChampionIcon, EmptyState, Sparkline, TextLink } from "@summonersnet/ui";
import type { ChampionOverview } from "@summonersnet/data/contracts";
import { BuildsSection, LoadoutsSection, SkillsSection } from "./builds";
import { BucketsSection } from "./buckets";
import { SynergiesSection } from "./synergies";
import { ChampionFilters } from "./filters";
import { interval, percent, roleLabels } from "./presentation";

const tierNotes = {
  S: "well above",
  A: "above",
  B: "close to",
  C: "below",
  D: "well below",
} as const;
export function ChampionOverviewPage({
  overview,
  error,
}: {
  overview: ChampionOverview;
  error: string | null;
}) {
  const { champion, query: q } = overview;
  return (
    <div className="np-stack">
      <header className="ev-title">
        <div className="ev-champion">
          <ChampionIcon
            id={champion.id}
            name={champion.name}
            imageUrl={champion.imageUrl}
            size="large"
          />
          <div>
            <span className="np-overline">
              {q.source === "pro" ? "Pro play" : "Solo queue"} · {roleLabels[q.role]}
            </span>
            <h1>{champion.name}</h1>
          </div>
        </div>
      </header>
      <ChampionFilters action={`/champions/${champion.id}`} query={q} facets={overview.facets} />
      {error ? (
        <p role="alert">{error}</p>
      ) : !overview.patch ? (
        <EmptyState
          title="No statistics for this selection"
          description={
            <span>
              Statistics appear once games are ingested and aggregated. See the{" "}
              <TextLink href="/tier-list">tier list</TextLink> or{" "}
              <TextLink href="/sources">Sources</TextLink>.
            </span>
          }
        />
      ) : (
        <section className="np-stack" aria-label="Champion statistics">
          <p className="np-meta">
            Patch {overview.patch} · {overview.games} {overview.games === 1 ? "game" : "games"} of{" "}
            {overview.sliceGames} in this selection.
          </p>
          <dl className="ev-summary">
            <div>
              <dt>Tier</dt>
              <dd>{overview.tier ?? "Unknown"}</dd>
            </div>
            <div>
              <dt>Win rate · {overview.winRate.sampleCount} results</dt>
              <dd>{percent(overview.winRate)}</dd>
            </div>
            <div>
              <dt>95% interval</dt>
              <dd>{interval(overview.winRate)}</dd>
            </div>
            <div>
              <dt>Pick rate · {overview.pickRate.sampleCount} games</dt>
              <dd>{percent(overview.pickRate)}</dd>
            </div>
            <div>
              <dt>Ban rate · {overview.banRate.sampleCount} games</dt>
              <dd>{percent(overview.banRate)}</dd>
            </div>
          </dl>
          <p className="np-body-sm">
            {overview.tier && overview.baseline !== null && overview.shrunkWinRate.value !== null
              ? `Tier ${overview.tier}: after shrinking toward the ${percent({ value: overview.baseline, sampleCount: 1 })} average of this selection, the win rate is ${percent(overview.shrunkWinRate)}, ${tierNotes[overview.tier]} average.`
              : "The tier is unknown until this champion has games with known results in this selection."}
          </p>
          <Sparkline
            title={`${champion.name} win rate by patch`}
            yLabel="Win rate"
            points={overview.trend.map((t, i) => ({
              id: t.patch,
              label: `Patch ${t.patch}`,
              x: i,
              y: t.winRate.value,
              sampleCount: t.winRate.sampleCount,
            }))}
          />
          <LoadoutsSection builds={overview.builds} />
          <BucketsSection buckets={overview.buckets} />
          <SynergiesSection overview={overview} />
          <SkillsSection builds={overview.builds} />
          <BuildsSection builds={overview.builds} />
        </section>
      )}
    </div>
  );
}
