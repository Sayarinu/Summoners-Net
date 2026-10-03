import { data } from "./data";

export async function readiness() {
  const headers = { "Cache-Control": "no-store" };
  try {
    await data().ready();
    return Response.json({ status: "ready" }, { headers });
  } catch {
    return Response.json({ status: "unavailable" }, { status: 503, headers });
  }
}
