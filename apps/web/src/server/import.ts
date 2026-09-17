import "server-only";
import { mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { NextResponse } from "next/server";
import { z } from "zod";
import { synchronization } from "./data";
import { localRequest } from "./http";
export async function importUpload(request: Request) {
  if (!localRequest(request))
    return NextResponse.json({ error: "Local same-origin requests only." }, { status: 403 });
  const max = 256 * 1024 * 1024;
  if (Number(request.headers.get("content-length")) > max + 8192)
    return NextResponse.json({ error: "File too large." }, { status: 413 });
  try {
    const form = await request.formData();
    const year = z.coerce.number().int().min(2014).max(2100).parse(form.get("year"));
    const file = form.get("file");
    if (
      !(file instanceof File) ||
      !file.name.toLowerCase().endsWith(".csv") ||
      file.size === 0 ||
      file.size > max
    )
      return NextResponse.json({ error: "Choose an annual CSV up to 256 MiB." }, { status: 400 });
    const content = Buffer.from(await file.arrayBuffer());
    const directory = resolve(process.cwd(), "../../.local/imports");
    await mkdir(directory, { recursive: true, mode: 0o700 });
    const path = resolve(directory, `${createHash("sha256").update(content).digest("hex")}.csv`);
    await writeFile(path, content, { mode: 0o600 });
    const id = await synchronization().request({
      kind: "history",
      year,
      file: path,
    });
    return NextResponse.json({ id, state: "queued" }, { status: 202 });
  } catch {
    return NextResponse.json({ error: "Could not queue the annual CSV." }, { status: 400 });
  }
}
