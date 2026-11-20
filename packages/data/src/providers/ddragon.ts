import { z } from "zod";
export function parseVersions(input: unknown) {
  const versions = z
    .array(z.string())
    .parse(input)
    .filter((v) => /^\d+\.\d+\.\d+$/.test(v));
  return z.array(z.string()).min(1).parse(versions);
}
/** Every version string as received, newest first, including legacy entries such as "lolpatch_7.20". */
export function parseVersionCatalog(input: unknown) {
  return z.array(z.string().max(64)).min(1).max(5000).parse(input);
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

// Catalog parsers keep Data Dragon's own identifiers: champion id ("MonkeyKing") and numeric key
// ("62"), item ids ("1001"), rune and tree ids (8112, 8100) and summoner spell ids and keys.
const image = z.object({ full: z.string().regex(/^[\w.-]+\.png$/) });
const numericKey = z.string().regex(/^\d{1,9}$/);
const versioned = <T extends z.ZodType>(data: T) =>
  z.object({ version: z.string().optional(), data: z.record(z.string(), data) });
function checkVersion(parsed: { version?: string | undefined }, version: string) {
  if (parsed.version && parsed.version !== version) throw new Error("Metadata version mismatch");
}
export interface CatalogEntry {
  id: string;
  /** Data Dragon's key as received: "103" for Ahri, "4" for Flash, "Electrocute" for a rune. */
  key: string | null;
  name: string;
  image: string;
  treeId: number | null;
  slot: number | null;
}
export function parseChampionCatalog(input: unknown, version: string): CatalogEntry[] {
  const parsed = versioned(
    z.object({
      id: z.string().regex(/^\w{1,40}$/),
      key: numericKey,
      name: z.string().min(1),
      image,
    }),
  ).parse(input);
  checkVersion(parsed, version);
  return Object.entries(parsed.data).map(([record, c]) => {
    if (record !== c.id) throw new Error("Champion record key does not match its id");
    return { id: c.id, key: c.key, name: c.name, image: c.image.full, treeId: null, slot: null };
  });
}
/** Data Dragon's item attributes, as received: tags, components, upgrades and total cost. */
export interface ItemAttributes {
  tags: string[];
  from: number[];
  into: number[];
  totalGold: number | null;
}
export function parseItemCatalog(
  input: unknown,
  version: string,
): (CatalogEntry & { item: ItemAttributes })[] {
  const ids = z.array(numericKey.transform(Number)).max(100).optional();
  const parsed = versioned(
    z.object({
      name: z.string(),
      image,
      tags: z.array(z.string().max(40)).max(40).optional(),
      from: ids,
      into: ids,
      gold: z.object({ total: z.number().int().min(0) }).optional(),
    }),
  ).parse(input);
  checkVersion(parsed, version);
  return Object.entries(parsed.data).map(([id, item]) => ({
    id: numericKey.parse(id),
    key: null,
    name: item.name,
    image: item.image.full,
    treeId: null,
    slot: null,
    item: {
      tags: item.tags ?? [],
      from: item.from ?? [],
      into: item.into ?? [],
      totalGold: item.gold?.total ?? null,
    },
  }));
}
export function parseSpellCatalog(input: unknown, version: string): CatalogEntry[] {
  const parsed = versioned(
    z.object({
      id: z.string().regex(/^\w{1,40}$/),
      key: numericKey,
      name: z.string().min(1),
      image,
    }),
  ).parse(input);
  checkVersion(parsed, version);
  return Object.values(parsed.data).map((s) => ({
    id: s.id,
    key: s.key,
    name: s.name,
    image: s.image.full,
    treeId: null,
    slot: null,
  }));
}
/** Trees and their runes; a tree has no tree id or slot of its own. */
export function parseRuneCatalog(input: unknown): CatalogEntry[] {
  const icon = z.string().regex(/^[\w./-]+\.png$/);
  const rune = z.object({
    id: z.number().int().positive(),
    key: z.string().min(1),
    name: z.string(),
    icon,
  });
  const trees = z
    .array(rune.extend({ slots: z.array(z.object({ runes: z.array(rune) })).min(1) }))
    .min(1)
    .parse(input);
  return trees.flatMap((tree) => [
    {
      id: String(tree.id),
      key: tree.key,
      name: tree.name,
      image: tree.icon,
      treeId: null,
      slot: null,
    },
    ...tree.slots.flatMap((s, slot) =>
      s.runes.map((r) => ({
        id: String(r.id),
        key: r.key,
        name: r.name,
        image: r.icon,
        treeId: tree.id,
        slot,
      })),
    ),
  ]);
}
