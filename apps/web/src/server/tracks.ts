import "server-only";
import { NextResponse } from "next/server";
import { trackRangeQuerySchema } from "@summonersnet/data/contracts";
import { data } from "./data";

/** Serves one bounded range of a linked track's samples; the query is validated here. */
export async function trackRange(request: Request, matchId: string) {
  const url = new URL(request.url);
  const parsed = trackRangeQuerySchema.safeParse({
    matchId,
    fromMs: url.searchParams.get("fromMs") ?? undefined,
    toMs: url.searchParams.get("toMs") ?? undefined,
  });
  if (!parsed.success || url.searchParams.size !== 2)
    return NextResponse.json(
      { error: "Choose a solo game and a forward range of at most two minutes." },
      { status: 400 },
    );
  const samples = await data().matchTrackRange(parsed.data);
  return samples
    ? NextResponse.json(samples)
    : NextResponse.json({ error: "No linked track for this game." }, { status: 404 });
}
