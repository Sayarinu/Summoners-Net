"use client";
import { EmptyState, ScatterChart, StatusIndicator, Table, TextLink } from "@summonersnet/ui";
import type { ModelDiagnostics, ModelSummary } from "@summonersnet/data/contracts";

const kindLabels = {
  timeline: "Solo Queue (Timelines)",
  "pro-checkpoints": "Pro (4 checkpoints)",
  draft: "Solo Queue (Pre-Game Draft)",
};
const statusTones = { active: "success", retired: "neutral", rejected: "warning" } as const;
const brier = (value: number | null) => (value === null ? "Unknown" : value.toFixed(3));
const windowLabel = (m: ModelSummary) =>
  m.kind === "pro-checkpoints" ? `Years ${m.window.join(", ")}` : `Patches ${m.window.join(", ")}`;

export function ModelsPage({
  diagnostics,
  error,
}: {
  diagnostics: ModelDiagnostics;
  error: string | null;
}) {
  const selected = diagnostics.selected;
  return (
    <div className="np-stack">
      <header className="ev-title">
        <div>
          <span className="np-overline">Win probability</span>
          <h1>Model Diagnostics</h1>
          <p>
            Whether the win probability models can be trusted: how they were trained, how well their
            predictions matched held-out games, and what they weigh.
          </p>
        </div>
      </header>
      {error ? <p role="alert">{error}</p> : null}
      {!diagnostics.models.length ? (
        <EmptyState
          title="No Models Trained Yet"
          description="A model is trained once enough games are stored; see Sources & imports."
        />
      ) : (
        <>
          <Table
            caption="Model Versions"
            rows={diagnostics.models}
            getRowKey={(m) => String(m.id)}
            columns={[
              {
                id: "model",
                header: "Model",
                render: (m) => (
                  <TextLink
                    href={`/models?model=${m.id}`}
                    aria-current={m.id === selected?.id ? "page" : undefined}
                  >
                    #{m.id} · v{m.modelVersion}
                  </TextLink>
                ),
              },
              { id: "kind", header: "Kind", render: (m) => kindLabels[m.kind] },
              {
                id: "status",
                header: "Status",
                render: (m) => <StatusIndicator label={m.status} tone={statusTones[m.status]} />,
              },
              { id: "window", header: "Trained On", render: windowLabel },
              {
                id: "sample",
                header: "Training Sample",
                render: (m) => `${m.trainMatches} games · ${m.trainRows} states`,
              },
              { id: "features", header: "Features", render: (m) => `v${m.featureVersion}` },
              { id: "brier", header: "Brier Score", align: "end", render: (m) => brier(m.brier) },
            ]}
          />
          {selected ? (
            <section className="np-stack" aria-labelledby="selected-model">
              <h2 id="selected-model">
                Model #{selected.id} · {kindLabels[selected.kind]}
              </h2>
              <p className="np-body-sm">
                {selected.reason ??
                  `Evaluated on ${selected.evalMatches} held-out games (${selected.evalRows} states) never used for training. Brier score ${brier(selected.brier)}: lower is better, and 0.25 is a coin flip.`}
              </p>
              <ScatterChart
                title="Reliability: Predicted vs Observed Blue Win Rate (%)"
                xLabel="Predicted"
                yLabel="Observed"
                points={selected.bins.map((b) => ({
                  id: String(b.lower),
                  label: `${Math.round(b.lower * 100)}–${Math.round(b.upper * 100)}% bin · ${b.count} states`,
                  x: b.predicted === null ? Number.NaN : Math.round(b.predicted * 1000) / 10,
                  y: b.observed === null ? null : Math.round(b.observed * 1000) / 10,
                  sampleCount: b.count,
                }))}
              />
              <p className="np-meta">
                A well-calibrated model&apos;s points sit on the diagonal: games given a 70% chance
                are won about 70% of the time. Empty bins are left out.
              </p>
              <Table
                caption="Feature Weights"
                rows={selected.weights}
                getRowKey={(w) => w.feature}
                columns={[
                  { id: "feature", header: "Feature", render: (w) => w.label },
                  {
                    id: "weight",
                    header: "Weight (Log-Odds per Unit)",
                    align: "end",
                    render: (w) => w.weight.toFixed(3),
                  },
                ]}
              />
              <p className="np-meta">
                Positive weights favour blue side. Intercept {selected.intercept.toFixed(3)}.
              </p>
            </section>
          ) : (
            <p className="np-meta">No active model; choose a version above.</p>
          )}
        </>
      )}
    </div>
  );
}
