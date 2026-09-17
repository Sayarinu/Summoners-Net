import { SourcesPage } from "../../src/features/sources/page";
import { data, preferences } from "../../src/server/data";
export default async function Page() {
  return (
    <SourcesPage
      status={await data().status()}
      timezone={(await preferences()).timezone}
      year={new Date().getUTCFullYear()}
    />
  );
}
