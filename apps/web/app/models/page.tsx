import { ModelsPage } from "../../src/features/models/page";
import { loadModelDiagnostics } from "../../src/server/models";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <ModelsPage {...await loadModelDiagnostics(await searchParams)} />;
}
