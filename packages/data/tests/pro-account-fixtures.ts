import type { ProAccountLinksFile } from "../src/domain/pro-accounts.js";
/** Constructed account/evidence fixture; this makes no real-world ownership assertion. */
export const proAccountFixtureLink = (
  letter = "a",
  sourceId = "10-mid",
): ProAccountLinksFile["links"][number] => ({
  puuid: letter.repeat(78),
  player: { source: "oracle", sourceId },
  evidence: [
    { url: "https://example.invalid/account-evidence", note: "Constructed evidence fixture" },
  ],
});
export const proAccountFixture = (links = [proAccountFixtureLink()]): ProAccountLinksFile => ({
  formatVersion: 1,
  links,
});
