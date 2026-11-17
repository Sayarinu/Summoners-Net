"use client";
import { Table, TextLink } from "@summonersnet/ui";
import type { DraftInput, DraftWinProbability } from "@summonersnet/data/contracts";

const percent = (value: number | null) =>
  value === null ? "Unknown" : `${(value * 100).toFixed(1)}%`;
const points = (value: number | null) =>
  value === null ? "Unknown" : `${value > 0 ? "+" : ""}${(value * 100).toFixed(1)} pts`;
const kinds: Record<DraftInput["kind"], string> = {
  strength: "Champion Strength",
  lane: "Lane Matchup",
  synergy: "Synergy",
};

/**
 * The pre-game draft win probability with its calibration, coverage and every input's sample.
 * `side` picks whose chance is the headline; both sides are always shown.
 */
export function DraftWinProbabilitySection({
  value: v,
  side = "blue",
  name,
}: {
  value: DraftWinProbability;
  side?: "blue" | "red";
  name: (championKey: number) => string;
}) {
  const blue = v.blueWinProbability;
  const ours = blue === null ? null : side === "blue" ? blue : 1 - blue;
  return (
    <section className="np-stack" aria-labelledby="draft-wp-heading">
      <h2 id="draft-wp-heading">Draft Win Probability</h2>
      {!v.model || blue === null ? (
        <p role="status">{v.reason}</p>
      ) : (
        <>
          <dl className="ev-summary" aria-label="Draft Win Probability by Side">
            <div>
              <dt>{side === "blue" ? "Blue" : "Red"} side</dt>
              <dd>{percent(ours)}</dd>
            </div>
            <div>
              <dt>{side === "blue" ? "Red" : "Blue"} side</dt>
              <dd>{percent(ours === null ? null : 1 - ours)}</dd>
            </div>
            {(["strength", "lane", "synergy"] as const).map((k) => (
              <div key={k}>
                <dt>{kinds[k]} coverage</dt>
                <dd>
                  {v.coverage[k].known} of {v.coverage[k].total}
                </dd>
              </div>
            ))}
          </dl>
          <p className="np-meta">
            Draft model v{v.model.modelVersion} (#{v.model.id}), trained on patches{" "}
            {v.model.patches.join(", ")}. Brier score on {v.model.evalGames} held-out games:{" "}
            {v.model.brier === null ? "unknown" : v.model.brier.toFixed(3)} (lower is better; 0.25
            is a coin flip). <TextLink href={`/models?model=${v.model.id}`}>Calibration</TextLink>
          </p>
          <details>
            <summary>Inputs and Samples</summary>
            <p className="np-body-sm">
              The model adds up, from blue’s side, each champion’s role win rate, each lane’s shrunk
              matchup and each pair of teammates’ shrunk duo result, all in win-rate points above
              50% (or above the pair’s expected rate). Inputs with fewer than 10 games are left out
              and counted in the coverage above.
            </p>
            <Table
              caption="Draft Model Inputs"
              compact
              rows={v.inputs.map((input, i) => ({ ...input, id: i }))}
              getRowKey={(r) => String(r.id)}
              columns={[
                { id: "kind", header: "Input", render: (r) => kinds[r.kind] },
                {
                  id: "side",
                  header: "Favours",
                  render: (r) => (r.side === "blue" ? "Blue" : "Red"),
                },
                { id: "role", header: "Role", render: (r) => r.role },
                {
                  id: "champions",
                  header: "Champions",
                  render: (r) => r.championKeys.map(name).join(r.kind === "lane" ? " vs " : " + "),
                },
                { id: "value", header: "Value", render: (r) => points(r.value) },
                { id: "n", header: "Games", align: "end", render: (r) => r.sampleCount },
              ]}
            />
          </details>
        </>
      )}
    </section>
  );
}
