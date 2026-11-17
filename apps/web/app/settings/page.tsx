import { SettingsPage } from "../../src/features/preferences/controls";
import { preferences } from "../../src/server/data";

export default async function Page() {
  return <SettingsPage initial={await preferences()} />;
}
