import { notFound, redirect } from "next/navigation";
import { PlayerProfile } from "../../../src/features/players/profile";
import { browseQuery, data, preferences, sourceIdFromRoute } from "../../../src/server/data";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await browseQuery(searchParams);
  const routeId = await sourceIdFromRoute(params);
  const raw = await searchParams;
  const context = await data().playerContext(routeId);
  if (!context) notFound();
  if (context.identity.publicSlug && routeId !== context.identity.publicSlug) {
    const suffix = new URLSearchParams(
      Object.entries(raw).filter(
        (entry): entry is [string, string] => typeof entry[1] === "string",
      ),
    ).toString();
    redirect(`/players/${context.identity.publicSlug}${suffix ? `?${suffix}` : ""}`);
  }
  const year = raw.year === "all" ? undefined : (query.year ?? context.seasons[0]?.year);
  const scoped = { ...query, year, pageSize: 5 };
  const [profile, performance, prefs] = await Promise.all([
    data().profile(context.identity.id, scoped, "player"),
    data().playerPerformance(context.identity.id, scoped),
    preferences(),
  ]);
  if (!profile) notFound();
  return (
    <PlayerProfile
      key={profile.identity.id}
      profile={profile}
      performance={performance}
      portraits={await data().championIconsByName(
        profile.summary.champions.map((champion) => champion.name),
      )}
      seasons={context.seasons}
      query={scoped}
      hideSpoilers={prefs.hideSpoilers}
    />
  );
}
