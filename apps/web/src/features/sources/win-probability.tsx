import { TextLink } from "@summonersnet/ui";
import type { ModelDiagnostics } from "@summonersnet/data/contracts";
import { dateTime } from "../browse/presentation";
import { RefreshButton } from "./refresh";

/** The active solo-queue win probability model, or why there is none, with on-demand training. */
export function WinProbabilitySection({
  models,
  timezone,
}: {
  models: ModelDiagnostics;
  timezone: string;
}) {
  const solo = models.models.filter((m) => m.kind === "timeline");
  const active = solo.find((m) => m.status === "active");
  const latest = solo[0];
  return (
    <section className="np-stack" aria-labelledby="win-probability-heading">
      <h2 id="win-probability-heading">Win Probability Model</h2>
      {active ? (
        <p className="np-body-sm">
          Model v{active.modelVersion} (#{active.id}) is active, trained{" "}
          {dateTime(active.trainedAt, timezone)} on {active.trainMatches} games ({active.trainRows}{" "}
          states) from patches {active.window.join(", ")}. Brier score{" "}
          {active.brier === null ? "unknown" : active.brier.toFixed(3)} on {active.evalMatches}{" "}
          held-out games.
        </p>
      ) : (
        <p className="np-body-sm" role="status">
          No model is active.{" "}
          {latest?.reason
            ? `The last training was rejected: ${latest.reason}`
            : "The first model trains automatically once enough solo-queue games with timelines are stored."}
        </p>
      )}
      {active && latest && latest.id !== active.id && latest.reason ? (
        <p className="np-meta">Last attempt rejected: {latest.reason}</p>
      ) : null}
      <p className="np-meta">
        Training runs daily. Queuing it only adds a job for the worker; a sample that is too small
        is stored as rejected and the active model stays.{" "}
        <TextLink href="/models">Model Diagnostics</TextLink>.
      </p>
      <RefreshButton kind="wp-train" label="Queue Training" />
    </section>
  );
}
