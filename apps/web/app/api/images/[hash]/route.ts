import { serveImage } from "../../../../src/server/images";
export async function GET(_request: Request, context: { params: Promise<{ hash: string }> }) {
  return serveImage((await context.params).hash);
}
