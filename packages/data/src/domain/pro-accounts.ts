import { z } from "zod";
import type { Identity } from "./models.js";
export const proAccountLinksMaxBytes = 5 * 1024 * 1024;
const puuid = z
  .string()
  .min(20)
  .max(100)
  .regex(/^[A-Za-z0-9_-]+$/);
const storableText = (value: string) =>
  value.isWellFormed() && !value.includes(String.fromCharCode(0));
const evidence = z.strictObject({
  url: z
    .url()
    .max(2048)
    .refine((value) => {
      try {
        const u = new URL(value);
        return (
          storableText(value) &&
          ["https:", "http:"].includes(u.protocol) &&
          !u.username &&
          !u.password
        );
      } catch {
        return false;
      }
    }, "Use an HTTP(S) source URL without credentials."),
  note: z
    .string()
    .trim()
    .min(1)
    .max(1000)
    .refine(storableText, "Text must contain Unicode characters without NUL.")
    .optional(),
});
export const proAccountLinksSchema = z
  .strictObject({
    formatVersion: z.literal(1, {
      error: "Unsupported pro account link format version; expected 1.",
    }),
    links: z
      .array(
        z.strictObject({
          puuid,
          player: z.strictObject({
            source: z.enum(["pandascore", "oracle"]),
            sourceId: z
              .string()
              .trim()
              .min(1)
              .max(300)
              .refine(storableText, "Text must contain Unicode characters without NUL.")
              .refine(
                (v) => !v.startsWith("observation:"),
                "Use a stable source player ID, not a match-scoped observation.",
              ),
          }),
          evidence: z.array(evidence).min(1).max(5),
        }),
      )
      .min(1)
      .max(10000),
  })
  .superRefine((file, ctx) => {
    const seen = new Set<string>();
    file.links.forEach((link, index) => {
      if (seen.has(link.puuid))
        ctx.addIssue({
          code: "custom",
          path: ["links", index, "puuid"],
          message: "Each PUUID must appear once.",
        });
      seen.add(link.puuid);
    });
  });
export type ProAccountLinksFile = z.infer<typeof proAccountLinksSchema>;
export class ProAccountImportError extends Error {}
export function parseProAccountLinksFile(text: string): ProAccountLinksFile {
  if (new TextEncoder().encode(text).byteLength > proAccountLinksMaxBytes)
    throw new ProAccountImportError(
      "Pro account links exceed the 5 MiB limit. Saved links are unchanged.",
    );
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new ProAccountImportError(
      "Pro account links must contain valid JSON. Saved links are unchanged.",
    );
  }
  if (
    typeof raw === "object" &&
    raw !== null &&
    "links" in raw &&
    Array.isArray(raw.links) &&
    raw.links.length > 10000
  )
    throw new ProAccountImportError(
      "Pro account links exceed the 10,000 row limit. Saved links are unchanged.",
    );
  const parsed = proAccountLinksSchema.safeParse(raw);
  if (!parsed.success)
    throw new ProAccountImportError(
      "Pro account link validation failed: " +
        parsed.error.issues
          .slice(0, 5)
          .map((i) => i.path.join(".").slice(0, 200) + ": " + i.message.slice(0, 200))
          .join("; ") +
        ". Saved links are unchanged.",
    );
  return parsed.data;
}
export const proAccountPuuidSchema = puuid;
export interface ProAccountLink {
  puuid: string;
  player: Identity;
  evidence: ProAccountLinksFile["links"][number]["evidence"];
  formatVersion: 1;
  sourceSha256: string;
  importedAt: string;
}
