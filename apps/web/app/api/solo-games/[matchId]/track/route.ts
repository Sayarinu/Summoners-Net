import { trackRange } from "../../../../../src/server/tracks";

export const dynamic = "force-dynamic";
export async function GET(request: Request, { params }: { params: Promise<{ matchId: string }> }) {
  return trackRange(request, decodeURIComponent((await params).matchId));
}
