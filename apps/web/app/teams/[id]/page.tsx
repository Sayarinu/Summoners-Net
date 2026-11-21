import { notFound, redirect } from "next/navigation";
import { TeamProfile } from "../../../src/features/teams/pages";
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
  const context = await data().teamContext(routeId);
  if (!context) notFound();
  if (context.identity.publicSlug && routeId !== context.identity.publicSlug) {
    const suffix = new URLSearchParams(
      Object.entries(raw).filter(
        (entry): entry is [string, string] => typeof entry[1] === "string",
      ),
    ).toString();
    redirect(`/teams/${context.identity.publicSlug}${suffix ? `?${suffix}` : ""}`);
  }
  const year = raw.year === "all" ? undefined : (query.year ?? context.seasons[0]?.year);
  const scoped = { ...query, year, pageSize: 5 };
  const view = raw.view === "games" ? "games" : "series";
  const [profile, series, statistics, splits, prefs] = await Promise.all([
    data().profile(context.identity.id, scoped, "team"),
    view === "series" ? data().matches({ ...scoped, state: "final" }, context.identity.id) : null,
    data().teamStatistics(context.identity.id, scoped),
    data().entitySplits(context.identity.id, typeof year === "number" ? year : undefined),
    preferences(),
  ]);
  if (!profile) notFound();
  return (
    <TeamProfile
      key={profile.identity.id}
      profile={profile}
      portraits={await data().championIconsByName(
        profile.summary.champions.map((champion) => champion.name),
      )}
      seasons={context.seasons}
      series={series}
      statistics={statistics}
      splits={splits}
      query={scoped}
      hideSpoilers={prefs.hideSpoilers}
      now={new Date().toISOString()}
    />
  );
}
