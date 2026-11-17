"use client";
import { BarChart } from "@summonersnet/ui";
import type { BucketKind, ChampionBuckets } from "@summonersnet/data/contracts";

const charts: { kind: BucketKind; title: string; xLabel: string }[] = [
  { kind: "length", title: "Win rate by game length", xLabel: "Game length" },
  { kind: "gold10", title: "Win rate by gold lead at 10 minutes", xLabel: "Gold lead" },
  { kind: "gold15", title: "Win rate by gold lead at 15 minutes", xLabel: "Gold lead" },
  { kind: "level10", title: "Win rate by level lead at 10 minutes", xLabel: "Level lead" },
  { kind: "level15", title: "Win rate by level lead at 15 minutes", xLabel: "Level lead" },
];
export function BucketsSection({ buckets }: { buckets: ChampionBuckets | null }) {
  if (!buckets) return null;
  return (
    <section className="np-stack" aria-labelledby="buckets-heading">
      <h2 id="buckets-heading">When it wins</h2>
      {charts.map(({ kind, title, xLabel }) => (
        <BarChart
          key={kind}
          title={title}
          xLabel={xLabel}
          yLabel="Win rate"
          points={buckets[kind].map((b) => ({
            id: `${kind}:${b.index}`,
            label: `${b.label} · ${b.games} ${b.games === 1 ? "game" : "games"}`,
            x: b.index,
            y: b.winRate.value,
            sampleCount: b.winRate.sampleCount,
          }))}
        />
      ))}
    </section>
  );
}
