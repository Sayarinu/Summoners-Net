import { catalogIconQuerySchema } from "@summonersnet/data/contracts";
import { data } from "./data";

export async function serveImage(hash: string) {
  if (!/^[a-f0-9]{64}$/.test(hash)) return new Response(null, { status: 404 });
  const asset = await data().image(hash);
  if (!asset) return new Response(null, { status: 404 });
  return new Response(asset.bytes, {
    headers: {
      "Content-Type": asset.contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'",
      "Cross-Origin-Resource-Policy": "same-origin",
    },
  });
}

export async function serveMinimapImage() {
  const map = await data().mapImage();
  if (!map) return new Response(null, { status: 404, headers: { "Cache-Control": "no-store" } });
  return new Response(null, {
    status: 307,
    headers: { Location: map.imageUrl, "Cache-Control": "no-store" },
  });
}

export async function serveCatalogImage(input: { patch: string; kind: string; id: string }) {
  const parsed = catalogIconQuerySchema.safeParse({ ...input, ids: [input.id] });
  if (!parsed.success) return new Response(null, { status: 400 });
  const [icon] = await data().catalogIcons(parsed.data);
  if (!icon?.imageUrl)
    return new Response(null, { status: 404, headers: { "Cache-Control": "no-store" } });
  return new Response(null, {
    status: 307,
    headers: { Location: icon.imageUrl, "Cache-Control": "no-store" },
  });
}
