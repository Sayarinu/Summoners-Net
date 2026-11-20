import { serveCatalogImage } from "../../../../../../../src/server/images";

export async function GET(
  _request: Request,
  context: { params: Promise<{ patch: string; kind: string; id: string }> },
) {
  return serveCatalogImage(await context.params);
}
