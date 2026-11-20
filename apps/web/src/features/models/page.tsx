"use client";
import {
  EmptyState,
  PageHeader,
  Panel,
  ScatterChart,
  Stat,
  StatGroup,
  StatusIndicator,
  TabNav,
  Table,
  TextLink,
} from "@summonersnet/ui";
import type { ModelDiagnostics, ModelSummary } from "@summonersnet/data/contracts";

const kindLabels = {
  timeline: "Solo Queue (Timelines)",
  "pro-checkpoints": "Pro (Game Checkpoints)",
  draft: "Solo Queue (Pre-Game Draft)",
};
const statusTones = { active: "success", retired: "neutral", rejected: "warning" } as const;
const brier = (value: number | null) => (value === null ? "Unknown" : value.toFixed(3));
const clock = (minute: number) => `${minute}:00`;
const windowLabel = (m: ModelSummary) =>
  m.kind === "pro-checkpoints" ? `Years ${m.window.join(", ")}` : `Patches ${m.window.join(", ")}`;

export function ModelsPage({
  diagnostics,
  error,
  phase = null,
}: {
  diagnostics: ModelDiagnostics;
  error: string | null;
  /** The game phase whose calibration is shown; null shows every held-out state. */
  phase?: string | null;
}) {
  const selected = diagnostics.selected;
  const shownPhase = selected?.phases.find((p) => p.phase === phase) ?? null;
  const bins = shownPhase?.bins ?? selected?.bins ?? [];
  return (
    <div className="flex min-w-0 flex-col gap-6">
      <PageHeader
        title="Model Diagnostics"
        eyebrow={`${diagnostics.models.length} ${diagnostics.models.length === 1 ? "Model Version" : "Model Versions"}`}
      >
        <p className="text-sm text-fg-secondary">
          Whether the win probability models can be trusted: how they were trained, how well their
          predictions matched held-out games, and what they weigh.
        </p>
      </PageHeader>
      {error ? <p role="alert">{error}</p> : null}
      {!diagnostics.models.length ? (
        <EmptyState
          title="No Models Trained Yet"
          description="A model is trained once enough games are stored."
        />
      ) : (
        <>
          <Panel title="Model Versions" padding="none">
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
          </Panel>
          {selected ? (
            <>
              <Panel title={`Model #${selected.id} · ${kindLabels[selected.kind]}`}>
                {selected.reason ? (
                  <p className="text-sm text-fg-secondary">{selected.reason}</p>
                ) : (
                  <StatGroup label="Held-Out Evaluation">
                    <Stat
                      label="Brier Score"
                      value={brier(selected.brier)}
                      detail="Lower is better; 0.25 is a coin flip"
                      tone="accent"
                    />
                    {selected.logLoss !== null ? (
                      <Stat
                        label="Log Loss"
                        value={selected.logLoss.toFixed(3)}
                        detail="Lower is better; 0.693 is a coin flip"
                      />
                    ) : null}
                    <Stat
                      label="Held-Out Games"
                      value={selected.evalMatches}
                      detail={`${selected.evalRows} states, never used for training`}
                    />
                    {selected.minutes ? (
                      <Stat
                        label="Minutes Scored"
                        value={`${clock(selected.minutes.first)}–${clock(selected.minutes.last)}`}
                        detail="Each minute was reached by enough training games"
                      />
                    ) : null}
                  </StatGroup>
                )}
              </Panel>
              {selected.phases.length ? (
                <Panel title="By Game Phase" padding="none">
                  <Table
                    caption="Held-Out Evaluation by Game Phase"
                    rows={selected.phases}
                    getRowKey={(p) => p.phase}
                    columns={[
                      { id: "phase", header: "Phase", render: (p) => p.label },
                      { id: "games", header: "Games", align: "end", render: (p) => p.games },
                      { id: "states", header: "States", align: "end", render: (p) => p.states },
                      {
                        id: "brier",
                        header: "Brier Score",
                        align: "end",
                        render: (p) => brier(p.brier),
                      },
                      {
                        id: "logLoss",
                        header: "Log Loss",
                        align: "end",
                        render: (p) => brier(p.logLoss),
                      },
                    ]}
                  />
                  <p className="px-4 py-3 text-sm text-fg-muted">
                    Early estimates are naturally less certain than late ones; each phase is checked
                    on its own so a strong late game cannot hide a weak early one.
                  </p>
                </Panel>
              ) : null}
              <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-start gap-4 max-[1150px]:grid-cols-1">
                <Panel
                  title="Calibration"
                  actions={
                    selected.phases.length ? (
                      <TabNav
                        label="Calibration Phase"
                        variant="segmented"
                        items={[
                          {
                            label: "All",
                            href: `/models?model=${selected.id}`,
                            current: !shownPhase,
                          },
                          ...selected.phases.map((p) => ({
                            label: p.label.split(" ")[0]!,
                            href: `/models?model=${selected.id}&phase=${p.phase}`,
                            current: shownPhase?.phase === p.phase,
                          })),
                        ]}
                      />
                    ) : null
                  }
                >
                  <div className="mx-auto flex max-w-[560px] flex-col gap-3">
                    <ScatterChart
                      title={`Reliability: Predicted vs Observed Blue Win Rate (%)${shownPhase ? `, ${shownPhase.label}` : ""}`}
                      xLabel="Predicted"
                      yLabel="Observed"
                      points={bins.map((b) => ({
                        id: String(b.lower),
                        label: `${Math.round(b.lower * 100)}–${Math.round(b.upper * 100)}% bin · ${b.count} states`,
                        x: b.predicted === null ? Number.NaN : Math.round(b.predicted * 1000) / 10,
                        y: b.observed === null ? null : Math.round(b.observed * 1000) / 10,
                        sampleCount: b.count,
                      }))}
                    />
                    <p className="text-sm text-fg-muted">
                      A well-calibrated model&apos;s points sit on the diagonal: games given a 70%
                      chance are won about 70% of the time. Empty bins are left out.
                    </p>
                  </div>
                </Panel>
                <Panel title="Feature Weights" padding="none">
                  <Table
                    caption="Feature Weights"
                    minWidth="0"
                    rows={selected.weights}
                    getRowKey={(w) => w.feature}
                    columns={[
                      { id: "feature", header: "Feature", render: (w) => w.label },
                      {
                        id: "weight",
                        header: "Log-Odds per Unit",
                        align: "end",
                        render: (w) => w.weight.toFixed(3),
                      },
                    ]}
                  />
                  <p className="px-4 py-3 text-sm text-fg-muted">
                    Positive weights favour blue side. Intercept {selected.intercept.toFixed(3)}.
                  </p>
                </Panel>
              </div>
            </>
          ) : (
            <p className="text-sm text-fg-muted">No active model; choose a version above.</p>
          )}
        </>
      )}
    </div>
  );
}
