import { createHash, randomUUID } from "node:crypto";
import { basename, join, resolve } from "node:path";
import { chmod, link, mkdir, stat, unlink } from "node:fs/promises";
import { createReadStream, createWriteStream } from "node:fs";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";

export const maximumArchiveBytes = 256 * 1024 * 1024;
export interface StagedArtifact {
  path: string;
  hash: string;
  bytes: number;
  originalFilename: string;
  acquisitionMethod: "download" | "manual" | "upload";
}

function filenameFrom(response: Response, year: number) {
  const disposition = response.headers.get("content-disposition") ?? "";
  const encoded = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  const plain = disposition.match(/filename="?([^";]+)"?/i)?.[1];
  const candidate = encoded ? decodeURIComponent(encoded) : plain;
  return basename(candidate || `${year}_LoL_esports_match_data_from_OraclesElixir.csv`);
}

export async function stageOracleArtifact(options: {
  year: number;
  directory?: string;
  file?: string;
  response?: Response;
  acquisitionMethod?: "manual" | "upload";
}): Promise<StagedArtifact> {
  const directory = resolve(options.directory ?? join(process.cwd(), ".local/imports"));
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const temp = join(directory, `.oracle-${randomUUID()}.part`);
  let source: Readable;
  let originalFilename: string;
  let acquisitionMethod: StagedArtifact["acquisitionMethod"];
  if (options.file) {
    if ((await stat(options.file)).size > maximumArchiveBytes)
      throw new Error("CSV exceeds 256 MiB");
    source = createReadStream(options.file);
    originalFilename = basename(options.file);
    acquisitionMethod = options.acquisitionMethod ?? "manual";
  } else if (options.response?.body) {
    if (Number(options.response.headers.get("content-length")) > maximumArchiveBytes)
      throw new Error("CSV exceeds 256 MiB");
    source = Readable.fromWeb(options.response.body as never);
    originalFilename = filenameFrom(options.response, options.year);
    acquisitionMethod = "download";
  } else throw new Error("Archive response had no body.");
  const namedYear = originalFilename.match(/(?:^|\D)(20\d{2})(?:\D|$)/)?.[1];
  if (namedYear && Number(namedYear) !== options.year)
    throw new Error("Archive filename/year mismatch");
  const hash = createHash("sha256");
  let bytes = 0;
  let prefix = Buffer.alloc(0);
  const inspect = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      bytes += chunk.length;
      if (bytes > maximumArchiveBytes) return callback(new Error("CSV exceeds 256 MiB"));
      hash.update(chunk);
      if (prefix.length < 4096)
        prefix = Buffer.concat([prefix, chunk.subarray(0, 4096 - prefix.length)]);
      callback(null, chunk);
    },
  });
  try {
    await pipeline(source, inspect, createWriteStream(temp, { mode: 0o600, flags: "wx" }));
    if (/<\s*(?:!doctype|html)|quota exceeded|download quota/i.test(prefix.toString("utf8")))
      throw new Error("Archive returned an HTML/quota page. Import a local annual CSV.");
    const digest = hash.digest("hex");
    const destination = join(directory, `${digest}.csv`);
    try {
      await link(temp, destination);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    }
    await unlink(temp);
    await chmod(destination, 0o600);
    return { path: destination, hash: digest, bytes, originalFilename, acquisitionMethod };
  } catch (error) {
    await unlink(temp).catch(() => undefined);
    throw error;
  }
}
