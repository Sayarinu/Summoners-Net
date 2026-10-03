import "server-only";
import { createQueries, querySchema, type BrowseQuery } from "@esportsviewer/data";
import { createSync } from "@esportsviewer/data/sync";
import { cookies } from "next/headers";
import { parsePreferences } from "../features/preferences/model";
const globalData = globalThis as typeof globalThis & {
  viewerQueries?: ReturnType<typeof createQueries>;
  viewerSync?: ReturnType<typeof createSync>;
};
function connection() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Set DATABASE_URL and run the local database setup.");
  return url;
}
export function data() {
  return (globalData.viewerQueries ??= createQueries(connection()));
}
export function synchronization() {
  return (globalData.viewerSync ??= createSync(connection()));
}
export async function preferencesState() {
  const cookie = (await cookies()).get("viewer-preferences");
  return {
    hasSavedPreferences: Boolean(cookie),
    value: parsePreferences(cookie?.value),
  };
}
export async function preferences() {
  return (await preferencesState()).value;
}
export async function browseQuery(
  params: Promise<Record<string, string | string[] | undefined>>,
): Promise<BrowseQuery> {
  const entries = await params;
  const prefs = await preferences();
  const raw = Object.fromEntries(
    Object.entries(entries).filter(([, v]) => v !== "" && v !== "all"),
  );
  return querySchema.parse({ timezone: prefs.timezone, ...raw });
}
// Next 16.2 passes URI-encoded dynamic segments to App Router page handlers.
export async function sourceIdFromRoute(params: Promise<{ id: string }>) {
  return decodeURIComponent((await params).id);
}
