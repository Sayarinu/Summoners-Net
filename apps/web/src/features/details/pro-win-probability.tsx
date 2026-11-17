"use client";
import { LineChart, TextLink } from "@summonersnet/ui";
import type { ProGameWinProbability } from "@summonersnet/data";
import { Disclosure } from "./disclosure";

/** Blue side's coarse win probability at the four Oracle's Elixir checkpoints. */
export function ProWinProbability({ winProbability }: { winProbability: ProGameWinProbability }) {
  const { model, points } = winProbability;
  if (!model || !points.some((point) => point.blueWinProbability !== null)) return null;
  return (
    <Disclosure title="Win Probability">
      <section className="np-stack" aria-labelledby="pro-wp-heading">
        <h2 id="pro-wp-heading">Win Probability (Coarse, 4 Checkpoints)</h2>
        <LineChart
          title="Blue Side Win Probability at Checkpoints (Coarse)"
          xLabel="Minute"
          yLabel="Blue Win Probability (%)"
          color="blue"
          points={points.map((p) => ({
            id: String(p.minute),
            label: `${p.minute} min`,
            x: p.minute,
            y: p.blueWinProbability === null ? null : Math.round(p.blueWinProbability * 1000) / 10,
            sampleCount: null,
          }))}
        />
        <TextLink href={`/models?model=${model.id}`}>Model Diagnostics</TextLink>
      </section>
    </Disclosure>
  );
}
