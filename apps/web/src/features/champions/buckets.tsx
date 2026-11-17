"use client";
import { BarChart } from "@summonersnet/ui";
import type { BucketKind, ChampionBuckets } from "@summonersnet/data/contracts";

const charts: { kind: BucketKind; title: string; xLabel: string }[] = [
  { kind: "length", title: "Win Rate by Game Length", xLabel: "Game Length" },
  { kind: "gold10", title: "Win Rate by Gold Lead at 10 Minutes", xLabel: "Gold Lead" },
  { kind: "gold15", title: "Win Rate by Gold Lead at 15 Minutes", xLabel: "Gold Lead" },
  { kind: "level10", title: "Win Rate by Level Lead at 10 Minutes", xLabel: "Level Lead" },
  { kind: "level15", title: "Win Rate by Level Lead at 15 Minutes", xLabel: "Level Lead" },
];
export function BucketsSection({ buckets }: { buckets: ChampionBuckets | null }) {
  if (!buckets) return null;
  // Charts without a single known rate are left out rather than drawn empty.
  const shown = charts.filter(({ kind }) => buckets[kind].some((b) => b.winRate.value !== null));
  return (
    <section className="np-stack" aria-labelledby="buckets-heading">
      <h2 id="buckets-heading">When It Wins</h2>
      {shown.length ? null : <p className="np-meta">No bucket has enough results yet.</p>}
      <div className="ev-chart-grid">
        {shown.map(({ kind, title, xLabel }) => (
          <BarChart
            key={kind}
            title={title}
            xLabel={xLabel}
            yLabel="Win Rate"
            points={buckets[kind].map((b) => ({
              id: `${kind}:${b.index}`,
              label: `${b.label} · ${b.games} ${b.games === 1 ? "game" : "games"}`,
              x: b.index,
              y: b.winRate.value,
              sampleCount: b.winRate.sampleCount,
            }))}
          />
        ))}
      </div>
    </section>
  );
}
