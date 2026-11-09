import { timezoneSchema } from "@summonersnet/data/contracts";
import { z } from "zod";
export const preferencesSchema = z
  .object({
    timezone: timezoneSchema,
    hideSpoilers: z.boolean(),
  })
  .strict();
export type Preferences = z.infer<typeof preferencesSchema>;
export const preferencesChangedEvent = "summonersnet-preferences-changed";
export function browserTimezone() {
  try {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return timezoneSchema.safeParse(timezone).success ? timezone : "UTC";
  } catch {
    return "UTC";
  }
}
export const defaultPreferences: Preferences = {
  timezone: browserTimezone(),
  hideSpoilers: false,
};
export function parsePreferences(raw?: string): Preferences {
  try {
    return preferencesSchema.parse(JSON.parse(raw ?? ""));
  } catch {
    return defaultPreferences;
  }
}
