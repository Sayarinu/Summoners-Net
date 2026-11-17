import "server-only";
import { draftAssistantQuerySchema, draftQuerySchema } from "@summonersnet/data/contracts";
import { data } from "./data";

export async function loadDrafts(params: Record<string, string | string[] | undefined>) {
  const raw = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== ""));
  const parsed = draftQuerySchema.partial({ patch: true }).safeParse(raw);
  if (!parsed.success)
    return {
      query: null,
      analytics: null,
      error:
        "Enter a patch such as 16.22, a league of at most 100 characters, and valid page numbers.",
    };
  const patch = parsed.data.patch ?? (await data().latestDraftPatch());
  if (!patch) return { query: null, analytics: null, error: null };
  const query = draftQuerySchema.parse({ ...parsed.data, patch });
  return { query, analytics: await data().draftAnalytics(query), error: null };
}

const assistantError =
  "Enter picks as champion IDs with an optional role (Ahri:MIDDLE), at most five per side and ten bans, each champion once, and a role to fill that your side has not picked.";
/** Validates the draft in the URL before reading stored aggregates; nothing is saved. */
export async function loadDraftAssistant(params: Record<string, string | string[] | undefined>) {
  const raw = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== "" && v !== "all"));
  const input = Object.fromEntries(
    ["blue", "red", "bans"].map((k) => [k, typeof params[k] === "string" ? params[k] : ""]),
  ) as { blue: string; red: string; bans: string };
  const parsed = draftAssistantQuerySchema.safeParse(raw);
  if (!parsed.success || Object.values(params).some(Array.isArray))
    return { assistant: null, input, error: assistantError };
  // The query takes the URL form, which the schema has just accepted, and validates it again.
  return { assistant: await data().draftAssistant(raw), input, error: null };
}
