import { timezoneSchema } from "@esportsviewer/data/contracts";
import { z } from "zod";
export const preferencesSchema = z
  .object({
    timezone: timezoneSchema,
    hideSpoilers: z.boolean(),
  })
  .strict();
export type Preferences = z.infer<typeof preferencesSchema>;
export const defaultPreferences: Preferences = {
  timezone: "UTC",
  hideSpoilers: true,
};
export function parsePreferences(raw?: string): Preferences {
  try {
    return preferencesSchema.parse(JSON.parse(raw ?? ""));
  } catch {
    return defaultPreferences;
  }
}
