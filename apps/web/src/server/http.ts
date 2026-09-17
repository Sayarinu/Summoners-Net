import { NextResponse } from "next/server";
import { z } from "zod";
import { synchronization } from "./data";
import { preferencesSchema } from "../features/preferences/model";
const refreshSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.enum(["matches", "running", "rosters", "metadata"]) }).strict(),
  z
    .object({
      kind: z.literal("history"),
      year: z.number().int().min(2014).max(2100),
    })
    .strict(),
]);
export function localRequest(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host) return false;
  try {
    const url = new URL(origin);
    return (
      url.host === host &&
      ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) &&
      url.protocol === "http:"
    );
  } catch {
    return false;
  }
}
export async function mutate(request: Request, kind: "refresh" | "preferences") {
  if (!localRequest(request))
    return NextResponse.json({ error: "Local same-origin requests only." }, { status: 403 });
  try {
    if (Number(request.headers.get("content-length")) > 4096)
      return NextResponse.json({ error: "Request too large." }, { status: 413 });
    const text = await request.text();
    if (text.length > 4096)
      return NextResponse.json({ error: "Request too large." }, { status: 413 });
    const raw: unknown = JSON.parse(text);
    if (kind === "refresh") {
      const input = refreshSchema.parse(raw);
      const current =
        input.kind === "history" && input.year === new Date().getUTCFullYear()
          ? process.env.ORACLE_CURRENT_FILE
          : undefined;
      const id = await synchronization().request({
        ...input,
        ...(current ? { file: current } : {}),
      });
      return NextResponse.json({ id, state: "queued" }, { status: 202 });
    }
    const prefs = preferencesSchema.parse(raw);
    const response = NextResponse.json({ saved: true });
    response.cookies.set("viewer-preferences", JSON.stringify(prefs), {
      httpOnly: true,
      sameSite: "strict",
      path: "/",
      maxAge: 31536000,
    });
    return response;
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof z.ZodError || error instanceof SyntaxError
            ? "Invalid request."
            : "Local database unavailable.",
      },
      {
        status: error instanceof z.ZodError || error instanceof SyntaxError ? 400 : 503,
      },
    );
  }
}
