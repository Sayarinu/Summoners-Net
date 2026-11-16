import { replayTrackMaxBytes } from "@summonersnet/data/contracts";
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
  try {
    const kind = z
      .enum(["history", "replay-track"])
      .parse(new URL(request.url).searchParams.get("kind") ?? "history");
    const limit = kind === "replay-track" ? replayTrackMaxBytes : 256 * 1024 * 1024;
    if (Number(request.headers.get("content-length")) > limit + 8192)
      return NextResponse.json({ error: "File too large." }, { status: 413 });
    const reader = request.body?.getReader();
    if (!reader) return NextResponse.json({ error: "Choose a file." }, { status: 400 });
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    try {
      while (true) {
        const part = await reader.read();
        if (part.done) break;
        bytes += part.value.byteLength;
        if (bytes > limit + 8192) {
          await reader.cancel();
          return NextResponse.json({ error: "File too large." }, { status: 413 });
        }
        chunks.push(part.value);
      }
    } finally {
      reader.releaseLock();
    }
    const form = await new Response(Buffer.concat(chunks), {
      headers: { "content-type": request.headers.get("content-type") ?? "" },
    }).formData();
    if (form.get("kind") !== null && form.get("kind") !== kind)
      return NextResponse.json(
        { error: "Import kind does not match the upload endpoint." },
        { status: 400 },
      );
    const extension = kind === "replay-track" ? ".json" : ".csv";
    const year =
      kind === "history"
        ? z.coerce.number().int().min(2014).max(2100).parse(form.get("year"))
        : null;
    const file = form.get("file");
    if (
      !(file instanceof File) ||
      !file.name.toLowerCase().endsWith(extension) ||
      file.size === 0 ||
      file.size > limit
    )
      return NextResponse.json(
        {
          error:
            kind === "replay-track"
              ? "Choose a replay track JSON up to 64 MiB."
              : "Choose an annual CSV up to 256 MiB.",
        },
        { status: 400 },
      );
    const content = Buffer.from(await file.arrayBuffer());
    const directory = resolve(process.cwd(), "../../.local/imports");
    await mkdir(directory, { recursive: true, mode: 0o700 });
    const path = resolve(
      directory,
      `${createHash("sha256").update(content).digest("hex")}${extension}`,
    );
    await writeFile(path, content, { mode: 0o600 });
    const id = await synchronization().request(
      kind === "replay-track"
        ? {
            kind,
            file: path,
          }
        : {
            kind,
            year,
            file: path,
            method: "upload",
          },
    );
    return NextResponse.json({ id, state: "queued" }, { status: 202 });
  } catch {
    return NextResponse.json({ error: "Could not queue the import." }, { status: 400 });
  }
}
