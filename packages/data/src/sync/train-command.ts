import type { ModelDiagnostics, ModelSummary } from "../domain/model-diagnostics.js";
import type { createSync } from "./index.js";

const kinds = {
  timeline: "Solo queue model",
  "pro-checkpoints": "Pro checkpoint model",
  draft: "Draft model",
} as const;
const outcome = (m: ModelSummary, active: ModelSummary | undefined) =>
  m.status === "active"
    ? `${kinds[m.kind]} #${m.id} published: ${m.trainMatches} training games (${m.trainRows} states), Brier score ${m.brier === null ? "unknown" : m.brier.toFixed(3)}.`
    : `${kinds[m.kind]} #${m.id} rejected: ${m.reason ?? "no reason recorded."} ${active ? `The active model stays #${active.id}.` : "There is no active model yet."}`;

/**
 * Queues a wp-train job and runs the queue until it finishes, then prints each model it stored:
 * published, or rejected with the reason. Returns whether the job completed.
 */
export async function trainOnDemand(
  sync: Pick<ReturnType<typeof createSync>, "request" | "runNext">,
  queries: { modelDiagnostics: () => Promise<ModelDiagnostics> },
  write: (line: string) => void,
  stopped: () => boolean = () => false,
) {
  const before = (await queries.modelDiagnostics()).models[0]?.id ?? 0;
  const id = await sync.request({ kind: "wp-train" });
  write(`Queued wp-train job ${id}.`);
  for (;;) {
    if (stopped()) return false;
    const result = await sync.runNext();
    if (result.state === "busy") {
      write("Another worker is running; it will train the model when it reaches the job.");
      return false;
    }
    if (result.state === "idle") {
      write("The job is waiting for its turn; a running worker will train the model.");
      return false;
    }
    if (result.id !== id) continue;
    if (result.state !== "done") {
      write(`Training failed: ${result.error}`);
      return false;
    }
    break;
  }
  const { models } = await queries.modelDiagnostics();
  for (const m of models.filter((m) => m.id > before).reverse())
    write(
      outcome(
        m,
        models.find((a) => a.kind === m.kind && a.status === "active"),
      ),
    );
  return true;
}
