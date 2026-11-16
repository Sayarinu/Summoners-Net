import "server-only";
import { summonerQuerySchema } from "@summonersnet/data/contracts";
import { data } from "./data";
export async function loadSummoner(
  puuid: string,
  params: Record<string, string | string[] | undefined>,
) {
  if (!summonerQuerySchema.shape.puuid.safeParse(puuid).success) return null;
  const parsed = summonerQuerySchema.safeParse({ ...params, puuid });
  if (!parsed.success)
    return { profile: null, error: "Choose a supported region and positive page numbers." };
  const profile = await data().summoner(parsed.data);
  return profile ? { profile, error: null } : null;
}
