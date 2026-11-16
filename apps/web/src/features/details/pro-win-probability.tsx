"use client";
import { LineChart } from "@summonersnet/ui";
import type { ProGameWinProbability } from "@summonersnet/data";

/** Blue side's coarse win probability at the four Oracle's Elixir checkpoints. */
export function ProWinProbability({ winProbability }: { winProbability: ProGameWinProbability }) {
  const { model, points, reason } = winProbability;
  return (
    <section className="np-stack" aria-labelledby="pro-wp-heading">
      <h2 id="pro-wp-heading">Win probability (coarse, 4 checkpoints)</h2>
      {model && points.length ? (
        <>
          <p className="np-meta">
            Lower fidelity than solo-queue charts: only the gold, XP, CS and kill differences at 10,
            15, 20 and 25 minutes are known. Pro checkpoint model v{model.modelVersion} (#
            {model.id}), trained on {model.years.join("–")} games; Brier score{" "}
            {model.brier === null ? "unknown" : model.brier.toFixed(3)} on held-out games (0.25 is a
            coin flip). Missing checkpoints are gaps.
          </p>
          <LineChart
            title="Blue side win probability at checkpoints (coarse)"
            xLabel="Minute"
            yLabel="Blue win probability (%)"
            color="blue"
            points={points.map((p) => ({
              id: String(p.minute),
              label: `${p.minute} min`,
              x: p.minute,
              y:
                p.blueWinProbability === null ? null : Math.round(p.blueWinProbability * 1000) / 10,
              sampleCount: null,
            }))}
          />
        </>
      ) : (
        <p role="status">{reason}</p>
      )}
    </section>
  );
}
