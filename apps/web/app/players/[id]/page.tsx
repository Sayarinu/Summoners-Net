import { notFound, redirect } from "next/navigation";
import { ProfilePage } from "../../../src/features/details/pages";
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
  const profile = await data().profile(routeId, query, "player");
  if (!profile || profile.identity.kind !== "player") notFound();
  if (profile.identity.publicSlug && routeId !== profile.identity.publicSlug) {
    const raw = await searchParams;
    const suffix = new URLSearchParams(
      Object.entries(raw).filter(
        (entry): entry is [string, string] => typeof entry[1] === "string",
      ),
    ).toString();
    redirect(`/players/${profile.identity.publicSlug}${suffix ? `?${suffix}` : ""}`);
  }
  return (
    <ProfilePage
      profile={profile}
      query={query}
      hideSpoilers={(await preferences()).hideSpoilers}
    />
  );
}
