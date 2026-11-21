import { redirect } from "next/navigation";

/** Lane matchups are part of the champion page; older links keep their source, role and patches. */
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ championId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const kept = new URLSearchParams();
  for (const name of ["source", "role", "patch"])
    for (const value of [query[name] ?? []].flat()) kept.append(name, value);
  const search = kept.size ? `?${kept}` : "";
  redirect(`/champions/${encodeURIComponent((await params).championId)}${search}#matchups`);
}
