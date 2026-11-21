import { z } from "zod";

export const patchKeySchema = z
  .string()
  .trim()
  .regex(/^\d{1,2}\.\d{1,2}$/);
/** The most patches one view combines. */
export const maxCombinedPatches = 12;
/**
 * One patch or several combined, from a single value, repeated query values or a comma-separated
 * list. Duplicates are dropped; queries order the patches by release.
 */
export const patchSelectionSchema = z
  .union([z.string(), z.array(z.string())])
  .transform((v) => (typeof v === "string" ? v.split(",") : v))
  .pipe(z.array(patchKeySchema).min(1).max(maxCombinedPatches))
  .transform((patches) => [...new Set(patches)]);
