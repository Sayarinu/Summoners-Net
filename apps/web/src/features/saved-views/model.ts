import { z } from "zod";

/** Saved views live only in this browser's local storage under this key. */
export const savedViewsKey = "summonersnet-saved-views";
export const savedViewLimit = 50;
/** Only the app's filterable pages can be saved; anything else read back is dropped. */
const savablePath =
  /^\/(?:tier-list|heatmaps|compare\/(?:champions|patches)|champions\/[A-Za-z0-9]{1,40}|matchups\/[A-Z]{3,7})$/;
export const savedViewSchema = z.strictObject({
  id: z.string().regex(/^[a-z0-9-]{1,40}$/),
  name: z.string().trim().min(1).max(60),
  path: z.string().regex(savablePath),
  /** The query string without its leading "?". */
  query: z
    .string()
    .max(1000)
    .regex(/^[^?#]*$/),
  savedAt: z.iso.datetime(),
});
export type SavedView = z.infer<typeof savedViewSchema>;

export const isSavablePath = (path: string) => savablePath.test(path);
export const viewHref = (view: Pick<SavedView, "path" | "query">) =>
  view.query ? `${view.path}?${view.query}` : view.path;

/**
 * Reads saved views, validating each entry: malformed JSON reads as none, and invalid entries
 * are dropped one by one so the rest still show.
 */
export function readSavedViews(storage: Pick<Storage, "getItem">): SavedView[] {
  let raw: unknown;
  try {
    raw = JSON.parse(storage.getItem(savedViewsKey) ?? "[]");
  } catch {
    return [];
  }
  if (!Array.isArray(raw)) return [];
  return raw
    .flatMap((entry) => {
      const parsed = savedViewSchema.safeParse(entry);
      return parsed.success ? [parsed.data] : [];
    })
    .slice(0, savedViewLimit);
}

export function writeSavedViews(storage: Pick<Storage, "setItem">, views: readonly SavedView[]) {
  storage.setItem(savedViewsKey, JSON.stringify(views.slice(0, savedViewLimit)));
}
