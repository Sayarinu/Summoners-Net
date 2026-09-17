import { notFound } from "next/navigation";
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
  const profile = await data().profile(await sourceIdFromRoute(params), query);
  if (!profile || profile.identity.kind !== "team") notFound();
  return (
    <ProfilePage
      profile={profile}
      query={query}
      hideSpoilers={(await preferences()).hideSpoilers}
    />
  );
}
