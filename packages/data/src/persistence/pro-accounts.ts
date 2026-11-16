import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import type { Pool } from "pg";
import {
  parseProAccountLinksFile,
  proAccountLinksMaxBytes,
  ProAccountImportError,
  proAccountPuuidSchema,
  type ProAccountLink,
} from "../domain/pro-accounts.js";
import type { Identity } from "../domain/models.js";
import { transaction } from "./database.js";
import { enrichIdentities } from "./entities.js";
export async function importProAccountLinks(pool: Pool, file: string, now: Date) {
  if (!(await stat(file)).isFile())
    throw new ProAccountImportError("Choose a regular pro account link JSON file.");
  const chunks: Buffer[] = [];
  let length = 0;
  for await (const chunk of createReadStream(file)) {
    const bytes = chunk as Buffer;
    length += bytes.length;
    if (length > proAccountLinksMaxBytes)
      throw new ProAccountImportError(
        "Pro account links exceed the 5 MiB limit. Saved links are unchanged.",
      );
    chunks.push(bytes);
  }
  const bytes = Buffer.concat(chunks);
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new ProAccountImportError(
      "Pro account links must be UTF-8 JSON. Saved links are unchanged.",
    );
  }
  const parsed = parseProAccountLinksFile(text),
    hash = createHash("sha256").update(bytes).digest("hex");
  const incoming = parsed.links.map((r, index) => ({
    puuid: r.puuid,
    source: r.player.source,
    source_id: r.player.sourceId,
    evidence: r.evidence,
    line_number: index + 1,
  }));
  return transaction(pool, async (db) => {
    const rows = (
      await db.query<{
        puuid: string;
        line_number: number;
        target: string | null;
        existing: string | null;
      }>(
        `
      SELECT input.puuid,input.line_number,p.id AS target,l.identity_id AS existing
      FROM jsonb_to_recordset($1::jsonb) AS input(puuid text,source text,source_id text,line_number integer)
      LEFT JOIN identities p ON p.source=input.source AND p.source_id=input.source_id AND p.kind='player'
      LEFT JOIN pro_account_links l ON l.puuid=input.puuid ORDER BY input.line_number`,
        [JSON.stringify(incoming)],
      )
    ).rows;
    for (const row of rows) {
      if (!row.target)
        throw new ProAccountImportError(
          `Link ${row.line_number}: no stored player matches this source ID. Import the pro data first. Saved links are unchanged.`,
        );
      if (row.existing && row.existing !== row.target)
        throw new ProAccountImportError(
          `Link ${row.line_number}: this account is already linked to a different source player. Review the conflicting evidence; saved links are unchanged.`,
        );
    }
    const result = await db.query(
      `INSERT INTO pro_account_links(puuid,identity_id,evidence,format_version,source_sha256,imported_at)
      SELECT input.puuid,p.id,input.evidence,1,$2,$3
      FROM jsonb_to_recordset($1::jsonb) AS input(puuid text,source text,source_id text,evidence jsonb)
      JOIN identities p ON p.source=input.source AND p.source_id=input.source_id AND p.kind='player'
      ON CONFLICT(puuid) DO UPDATE SET evidence=EXCLUDED.evidence,source_sha256=EXCLUDED.source_sha256,imported_at=EXCLUDED.imported_at
      WHERE pro_account_links.identity_id=EXCLUDED.identity_id RETURNING puuid`,
      [JSON.stringify(incoming), hash, now],
    );
    if (result.rowCount !== parsed.links.length)
      throw new ProAccountImportError(
        "Pro account links changed during import. Saved links are unchanged; review and retry.",
      );
    return result.rowCount;
  });
}
export async function proAccountLink(pool: Pool, input: string): Promise<ProAccountLink | null> {
  const puuid = proAccountPuuidSchema.parse(input);
  const row = (
    await pool.query<{
      identity: Identity;
      evidence: ProAccountLink["evidence"];
      source_sha256: string;
      imported_at: Date;
    }>(
      `
    SELECT i.document AS identity,l.evidence,l.source_sha256,l.imported_at
    FROM pro_account_links l JOIN identities i ON i.id=l.identity_id WHERE l.puuid=$1`,
      [puuid],
    )
  ).rows[0];
  if (!row) return null;
  const decoration = (await enrichIdentities(pool, [row.identity])).get(row.identity.id)!;
  return {
    puuid,
    player: { ...row.identity, ...decoration },
    evidence: row.evidence,
    formatVersion: 1,
    sourceSha256: row.source_sha256,
    importedAt: row.imported_at.toISOString(),
  };
}
