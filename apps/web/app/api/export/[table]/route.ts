import { NextResponse } from "next/server";
import { csvResponse } from "../../../../src/server/http";
import { loadExport } from "../../../../src/server/exports";

/** A CSV of one aggregate table with the filters in the query string; reads stored data only. */
export async function GET(request: Request, { params }: { params: Promise<{ table: string }> }) {
  const result = await loadExport((await params).table, new URL(request.url).searchParams);
  if (result === "not-found")
    return NextResponse.json({ error: "No such table or selection." }, { status: 404 });
  if (result === "invalid")
    return NextResponse.json(
      { error: "Choose filters from the page's lists; each filter at most once." },
      { status: 400 },
    );
  return csvResponse(result.filename, result.header, result.rows);
}
