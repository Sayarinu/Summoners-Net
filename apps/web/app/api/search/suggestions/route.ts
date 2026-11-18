import { querySchema } from "@summonersnet/data";
import { searchHitHref, type SearchSuggestion } from "../../../../src/features/browse/presentation";
import { data } from "../../../../src/server/data";

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q") ?? "";
  const query = querySchema.safeParse({ q, pageSize: 5 });
  if (!query.success) return Response.json([], { status: 400 });
  if (query.data.q.length < 2) return Response.json([]);

  const { items } = await data().search(query.data);
  const suggestions: SearchSuggestion[] = items.map((hit) => ({
    name: hit.name,
    href: searchHitHref(hit),
    kind: hit.kind,
  }));
  return Response.json(suggestions);
}
