import "server-only";
import { modelDiagnosticsQuerySchema } from "@summonersnet/data/contracts";
import { data } from "./data";

/** Validates ?model= and ?phase=; an invalid value shows the default model with an error. */
export async function loadModelDiagnostics(params: Record<string, string | string[] | undefined>) {
  const raw = Object.fromEntries(
    Object.entries(params).filter(([, v]) => typeof v === "string" && v !== ""),
  );
  const parsed = modelDiagnosticsQuerySchema.safeParse(raw);
  return {
    diagnostics: await data().modelDiagnostics(parsed.success ? parsed.data.model : undefined),
    phase: parsed.success ? (parsed.data.phase ?? null) : null,
    error: parsed.success ? null : "Choose a model from the list.",
  };
}
