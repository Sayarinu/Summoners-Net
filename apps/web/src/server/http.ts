import { NextResponse } from "next/server";
import {
  legacyPreferencesCookie,
  preferencesCookie,
  preferencesSchema,
} from "../features/preferences/model";
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
export async function savePreferences(request: Request) {
  if (!localRequest(request))
    return NextResponse.json({ error: "Local same-origin requests only." }, { status: 403 });
  try {
    if (Number(request.headers.get("content-length")) > 4096)
      return NextResponse.json({ error: "Request too large." }, { status: 413 });
    const text = await request.text();
    if (text.length > 4096)
      return NextResponse.json({ error: "Request too large." }, { status: 413 });
    const raw: unknown = JSON.parse(text);
    const prefs = preferencesSchema.parse(raw);
    const response = NextResponse.json({ saved: true });
    response.cookies.delete(legacyPreferencesCookie);
    response.cookies.set(preferencesCookie, JSON.stringify(prefs), {
      httpOnly: true,
      sameSite: "strict",
      path: "/",
      maxAge: 31536000,
    });
    return response;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
}

type CsvCell = string | number | boolean | null | undefined;
/**
 * One CSV field. Unknown values are empty, never zero. Text that a spreadsheet would run as a
 * formula is prefixed with an apostrophe; fields with separators or quotes are quoted.
 */
export function csvField(value: CsvCell) {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
  const text = typeof value === "boolean" ? String(value) : value;
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return /[",\r\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}
/** Streams a CSV download row by row, so a large export never sits in memory. */
export function csvResponse(
  filename: string,
  header: readonly string[],
  rows: AsyncIterable<CsvCell[]>,
) {
  const encoder = new TextEncoder();
  const iterator = rows[Symbol.asyncIterator]();
  const line = (cells: readonly CsvCell[]) =>
    encoder.encode(`${cells.map(csvField).join(",")}\r\n`);
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(line(header));
    },
    async pull(controller) {
      try {
        const next = await iterator.next();
        if (next.done) controller.close();
        else controller.enqueue(line(next.value));
      } catch (error) {
        controller.error(error);
      }
    },
    async cancel() {
      await iterator.return?.();
    },
  });
  return new Response(stream, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename.replace(/[^A-Za-z0-9._-]/g, "_")}"`,
      "cache-control": "no-store",
    },
  });
}
