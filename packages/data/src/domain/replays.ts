import { z } from "zod";
import { riotPlatforms } from "./riot-platforms.js";
export const replayFileMaxBytes = 256 * 1024 * 1024;
export const replayMetadataMaxBytes = 4 * 1024 * 1024;
export const replayPlatformSchema = z.enum(riotPlatforms);
export const keepReplayFilesSchema = z
  .enum(["true", "false"])
  .default("false")
  .transform((v) => v === "true");
export interface ReplayMetadataSummary {
  sha256: string;
  format: "ROFL" | "ROFL2";
  gameId: string | null;
  platform: z.infer<typeof replayPlatformSchema> | null;
  gameVersion: string;
  durationMs: number;
  importedAt: string;
  fileRetainedAtImport: boolean;
  matchId: string | null;
  participants: {
    champion: string | null;
    teamId: number | null;
    kills: number | null;
    deaths: number | null;
    assists: number | null;
    win: boolean | null;
  }[];
}
