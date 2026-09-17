import { z } from "zod";
export function parseVersions(input: unknown) {
  const versions = z
    .array(z.string())
    .parse(input)
    .filter((v) => /^\d+\.\d+\.\d+$/.test(v));
  return z.array(z.string()).min(1).parse(versions);
}
export function parseMetadata(input: unknown, version: string, kind: "champion" | "item") {
  const schema = z.object({
    version: z.string().optional(),
    data: z.record(
      z.string(),
      z.object({
        name: z.string(),
        image: z.object({ full: z.string().regex(/^[\w.-]+\.png$/) }),
      }),
    ),
  });
  const parsed = schema.parse(input);
  if (parsed.version && parsed.version !== version) throw new Error("Metadata version mismatch");
  return Object.fromEntries(
    Object.entries(parsed.data).map(([key, v]) => [
      key,
      {
        name: v.name,
        image: `https://ddragon.leagueoflegends.com/cdn/${version}/img/${kind}/${v.image.full}`,
      },
    ]),
  );
}
