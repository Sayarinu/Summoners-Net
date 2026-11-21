import "server-only";
import {
  createQueries,
  directoryQuerySchema,
  querySchema,
  type BrowseQuery,
  type DirectoryQuery,
} from "@summonersnet/data";
import { cookies } from "next/headers";
import { parsePreferences, preferencesCookie } from "../features/preferences/model";
const globalData = globalThis as typeof globalThis & {
  viewerQueries?: ReturnType<typeof createQueries>;
};
function connection() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Set DATABASE_URL and run the local database setup.");
  return url;
}
export function data() {
  return (globalData.viewerQueries ??= createQueries(connection()));
}
export async function preferencesState() {
  const cookie = (await cookies()).get(preferencesCookie);
  return {
    hasSavedPreferences: Boolean(cookie),
    value: parsePreferences(cookie?.value),
  };
}
export async function preferences() {
  return (await preferencesState()).value;
}
async function rawQuery(params: Promise<Record<string, string | string[] | undefined>>) {
  const entries = await params;
  const prefs = await preferences();
  const raw = Object.fromEntries(
    Object.entries(entries).filter(([, v]) => v !== "" && v !== "all"),
  );
  return { timezone: prefs.timezone, ...raw };
}
export async function browseQuery(
  params: Promise<Record<string, string | string[] | undefined>>,
): Promise<BrowseQuery> {
  return querySchema.parse(await rawQuery(params));
}
/** Directory grids accept larger, clamped page sizes so a page can fill the visible area. */
export async function directoryQuery(
  params: Promise<Record<string, string | string[] | undefined>>,
): Promise<DirectoryQuery> {
  return directoryQuerySchema.parse(await rawQuery(params));
}
// Next 16.2 passes URI-encoded dynamic segments to App Router page handlers.
export async function sourceIdFromRoute(params: Promise<{ id: string }>) {
  return decodeURIComponent((await params).id);
}

export function matchIdFromRouteId(id: string) {
  return /^\d+$/.test(id) ? `pandascore:match:${id}` : id;
}
