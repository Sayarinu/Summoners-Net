"use client";
import { Panel, RoleIcon, Stat, StatGroup, Table } from "@summonersnet/ui";
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
    <Panel title="Draft Win Probability">
      {!v.model || blue === null ? (
        <p role="status">{v.reason}</p>
      ) : (
        <div className="flex flex-col gap-4">
          <StatGroup label="Draft Win Probability by Side">
            <Stat
              label={`${side === "blue" ? "Blue" : "Red"} Side`}
              value={
                <span className={side === "blue" ? "text-side-blue" : "text-side-red"}>
                  {percent(ours)}
                </span>
              }
            />
            <Stat
              label={`${side === "blue" ? "Red" : "Blue"} Side`}
              value={
                <span className={side === "blue" ? "text-side-red" : "text-side-blue"}>
                  {percent(ours === null ? null : 1 - ours)}
                </span>
              }
            />
            {(["strength", "lane", "synergy"] as const).map((k) => (
              <Stat
                key={k}
                size="sm"
                label={`${kinds[k]} Coverage`}
                value={`${v.coverage[k].known} of ${v.coverage[k].total}`}
              />
            ))}
          </StatGroup>
          <p className="text-sm text-fg-muted">
            Draft model v{v.model.modelVersion} (#{v.model.id}), trained on patches{" "}
            {v.model.patches.join(", ")}. Brier score on {v.model.evalGames} held-out games:{" "}
            {v.model.brier === null ? "unknown" : v.model.brier.toFixed(3)} (lower is better; 0.25
            is a coin flip).
          </p>
          <details className="flex flex-col gap-3">
            <summary className="cursor-pointer text-sm text-fg-secondary">
              Inputs and Samples
            </summary>
            <p className="my-3 max-w-reading text-sm text-fg-secondary">
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
                { id: "role", header: "Role", render: (r) => <RoleIcon role={r.role} /> },
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
        </div>
      )}
    </Panel>
  );
}
