import { z } from "zod";

export const catalogIconQuerySchema = z.object({
  patch: z.string().regex(/^\d{1,3}\.\d{1,3}$/),
  kind: z.enum(["champion", "item", "rune", "spell"]),
  ids: z
    .array(
      z
        .string()
        .regex(/^[A-Za-z0-9]+$/)
        .max(100),
    )
    .min(1)
    .max(100),
});
export type CatalogIconQuery = z.infer<typeof catalogIconQuerySchema>;
export interface CatalogIcon {
  id: string;
  kind: CatalogIconQuery["kind"];
  name: string;
  imageUrl: string | null;
  fetchedAt: string | null;
}
