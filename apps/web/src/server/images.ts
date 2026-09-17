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
