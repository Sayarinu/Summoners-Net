import { ChampionsPage } from "../../src/features/champions/directory";
import { data } from "../../src/server/data";

export default async function Page() {
  return <ChampionsPage directory={await data().championDirectory()} />;
}
