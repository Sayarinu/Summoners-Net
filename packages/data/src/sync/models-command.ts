import type { ModelDiagnostics, ModelSummary } from "../domain/model-diagnostics.js";

const kinds: Record<ModelSummary["kind"], string> = {
  timeline: "Solo Queue (Timelines)",
  "pro-checkpoints": "Pro (Game Checkpoints)",
  draft: "Solo Queue (Pre-Game Draft)",
};
const fixed = (value: number | null, digits = 3) =>
  value === null ? "unknown" : value.toFixed(digits);
const percent = (value: number | null) =>
  value === null ? "unknown" : `${(value * 100).toFixed(1)}%`;
const clock = (minute: number) => `${minute}:00`;

/**
 * Model diagnostics as plain text for the terminal: every stored version, then the selected
 * model's held-out evaluation, per-phase results, calibration bins and feature weights.
 */
export function formatModelDiagnostics(d: ModelDiagnostics): string {
  if (!d.models.length)
    return "No models trained yet. Run `pnpm wp:train` once games are stored.\n";
  const lines = ["Model versions (newest first):"];
  for (const m of d.models)
    lines.push(
      `  #${m.id} v${m.modelVersion} ${kinds[m.kind]} · ${m.status} · ` +
        `${m.kind === "pro-checkpoints" ? "years" : "patches"} ${m.window.join(", ")} · ` +
        `${m.trainMatches} games / ${m.trainRows} states · Brier ${fixed(m.brier)}`,
    );
  const s = d.selected;
  if (!s) {
    lines.push("", "No active model. Pass a model id to show one: pnpm models <id>");
    return `${lines.join("\n")}\n`;
  }
  lines.push("", `Model #${s.id} · ${kinds[s.kind]} · ${s.status}`);
  if (s.reason) lines.push(`  Not published: ${s.reason}`);
  lines.push(
    `  Held out: ${s.evalMatches} games, ${s.evalRows} states (never used for training)`,
    `  Brier score: ${fixed(s.brier)} (lower is better; 0.25 is a coin flip)`,
    `  Log loss: ${fixed(s.logLoss)} (lower is better; 0.693 is a coin flip)`,
  );
  if (s.minutes) lines.push(`  Minutes scored: ${clock(s.minutes.first)}–${clock(s.minutes.last)}`);
  if (s.phases.length) {
    lines.push("", "By game phase:");
    for (const p of s.phases)
      lines.push(
        `  ${p.label}: ${p.games} games, ${p.states} states, Brier ${fixed(p.brier)}, ` +
          `log loss ${fixed(p.logLoss)}`,
      );
  }
  lines.push("", "Calibration (predicted vs observed blue win rate):");
  for (const b of s.bins)
    if (b.count)
      lines.push(
        `  ${Math.round(b.lower * 100)}–${Math.round(b.upper * 100)}%: ${b.count} states, ` +
          `predicted ${percent(b.predicted)}, observed ${percent(b.observed)}`,
      );
  lines.push("", "Feature weights (log-odds per unit; positive favours blue side):");
  for (const w of s.weights) lines.push(`  ${w.label}: ${w.weight.toFixed(3)}`);
  lines.push(`  Intercept: ${s.intercept.toFixed(3)}`);
  return `${lines.join("\n")}\n`;
}
