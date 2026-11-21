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
  if (!shown.length) return null;
  return (
    <section aria-labelledby="when-it-wins-heading" className="flex flex-col gap-3">
      <h3 id="when-it-wins-heading">When It Wins</h3>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-5 max-[420px]:grid-cols-1">
        {shown.map(({ kind, title, xLabel }) => (
          <BarChart
            key={kind}
            title={title}
            xLabel={xLabel}
            yLabel="Win Rate (%)"
            points={buckets[kind].map((b) => ({
              id: `${kind}:${b.index}`,
              label: b.label,
              x: b.index,
              y: b.winRate.value === null ? null : Math.round(b.winRate.value * 1000) / 10,
              sampleCount: b.winRate.sampleCount,
            }))}
          />
        ))}
      </div>
    </section>
  );
}
