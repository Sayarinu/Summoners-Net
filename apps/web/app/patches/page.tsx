import { PatchesPage } from "../../src/features/patches/directory";
import { data } from "../../src/server/data";

export default async function Page() {
  return <PatchesPage directory={await data().patchDirectory()} />;
}
