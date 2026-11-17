import {
  proAccountFixture,
  proAccountFixtureLink,
} from "../../../packages/data/tests/pro-account-fixtures";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createSync } from "@summonersnet/data/sync";
import { database } from "../../../packages/data/src/persistence/database";
import { saveAccount, saveLadder, saveMatchIds } from "../../../packages/data/src/persistence/riot";
import { saveRiotMatch } from "../../../packages/data/src/persistence/riot-matches";
import { parseRiotMatch } from "../../../packages/data/src/providers/riot-match";
import { saveTimeline } from "../../../packages/data/src/persistence/riot-timelines";
import { trainWinProbabilityModel } from "../../../packages/data/src/persistence/wp-models";
import { parseRiotTimeline } from "../../../packages/data/src/providers/riot-timeline";
import { draftCsv } from "../../../packages/data/tests/draft-fixtures";
import { historyCsv, rawMatch, now } from "../../../packages/data/tests/fixtures";
export default async function setup() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url || new URL(url).pathname !== "/esportsviewer_test")
    throw new Error("Refusing to reset a non-test database");
  const sync = createSync(url, {
    clock: () => now,
    token: "browser-test-only",
    pause: () => Promise.resolve(),
    fetch: (input) => {
      const endpoint = input instanceof Request ? input.url : input.toString();
      if (endpoint.endsWith("/api/versions.json"))
        return Promise.resolve(Response.json(["16.4.1"]));
      const catalogFile = endpoint.match(
        /\/data\/en_US\/(champion|item|runesReforged|summoner)\.json$/,
      )?.[1];
      if (catalogFile)
        return readFile(
          new URL(`../../../packages/data/tests/ddragon/${catalogFile}.json`, import.meta.url),
          "utf8",
        ).then((text) =>
          Response.json(JSON.parse(text.replaceAll('"16.22.1"', '"16.4.1"')) as unknown),
        );
      if (endpoint.includes("cdn-api.pandascore.co") || endpoint.includes("/img/"))
        return Promise.resolve(
          new Response(
            Buffer.from(
              "iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAE0lEQVR4nGOYsmjDTHyYYWQoAABhNp/B8kBP7wAAAABJRU5ErkJggg==",
              "base64",
            ),
            { headers: { "content-type": "image/png" } },
          ),
        );
      return Promise.resolve(
        Response.json(
          endpoint.includes("/teams")
            ? [
                {
                  id: 10,
                  name: "Acceptance Blue",
                  image_url: "https://cdn-api.pandascore.co/browser-fixture.png",
                  players: [
                    ...["top", "jng", "mid", "bot", "sup"].map((role, i) => ({
                      id: 30 + i,
                      name: `Player Blue ${role}`,
                      role,
                      image_url: "https://cdn-api.pandascore.co/browser-fixture.png",
                    })),
                    { id: 50, name: "Observed Player", role: "mid" },
                  ],
                },
              ]
            : Array.from({ length: 30 }, (_, i) =>
                rawMatch(i + 1, {
                  status: i === 1 ? "not_started" : "finished",
                  begin_at: i === 1 ? "2026-03-02T01:00:00Z" : "2026-03-01T01:00:00Z",
                  games: [{ id: 100 + i, position: 1, status: "finished", winner: { id: 10 } }],
                }),
              ),
        ),
      );
    },
  });
  const pool = database(url);
  try {
    await sync.migrate();
    await pool.query(
      "TRUNCATE matchup_aggregates,matchup_exclusions,pro_account_links,riot_ladder_snapshots,replay_metadata,replay_tracks,identity_tournament_rosters,identity_match_context,identity_catalog,identity_resolution_runs,image_assets,oracle_archive_participants,oracle_archive_games,participants,broadcasts,roster_observations,roster_snapshots,games,matches,competitions,source_mappings,identities,metadata,oracle_champion_names,catalog_champions,catalog_items,catalog_runes,catalog_summoner_spells,patch_sources,patches,riot_account_names,riot_accounts,imports,sync_jobs,sync_schedule,request_ledger,riot_request_ledger,riot_rate_limits,riot_rate_pauses,riot_ladder_entries,riot_ladder_status,riot_match_ids,riot_match_crawl,riot_job_status,champion_aggregates,champion_builds,champion_buckets,champion_duos,pro_champion_stats,pro_unmapped_drafts,aggregate_dirty,riot_wp_features,wp_models,riot_wpa_participants,riot_wpa_events,wpa_aggregates RESTART IDENTITY CASCADE",
    );
    await pool.query(
      "UPDATE source_status SET last_success=NULL,last_attempt=NULL,error=NULL,records=0",
    );
    await pool.query("UPDATE quota_state SET cooldown_until=NULL");
    for (const kind of ["matches", "rosters"]) {
      await sync.request({ kind });
      const result = await sync.runNext();
      if (result.state !== "done") throw new Error("Browser fixture sync failed");
    }
    const folder = resolve("../../.local/browser-fixtures");
    await mkdir(folder, { recursive: true });
    const file = resolve(folder, "2026.csv");
    await writeFile(file, historyCsv());
    await sync.request({ kind: "history", year: 2026, file });
    if ((await sync.runNext()).state !== "done") throw new Error("Browser fixture import failed");
    await sync.request({ kind: "metadata" });
    if ((await sync.runNext()).state !== "done")
      throw new Error("Browser catalog fixture sync failed");
    const draftFile = resolve(folder, "drafts.csv");
    await writeFile(draftFile, draftCsv({ league: "Draft acceptance" }));
    await sync.request({ kind: "history", year: 2026, file: draftFile });
    if ((await sync.runNext()).state !== "done")
      throw new Error("Browser draft fixture import failed");
    // Solo-queue crawl progress for the Riot crawler section, written through the data package.
    const ladderEntry = (puuid: string) => ({
      puuid,
      summonerId: null,
      tier: "CHALLENGER" as const,
      rank: "I",
      leaguePoints: 1500,
      wins: 100,
      losses: 80,
      leagueId: "browser-fixture",
    });
    await saveLadder(
      pool,
      "euw1",
      ["a", "b", "c"].map((c) => ladderEntry(c.repeat(78))),
      new Date(),
    );
    await saveAccount(
      pool,
      { puuid: "a".repeat(78), gameName: "Ladder fixture", tagLine: "EUW" },
      now,
    );
    await saveMatchIds(
      pool,
      { puuid: "a".repeat(78), platform: "euw1", region: "europe", patchKey: "16.4" },
      ["EUW1_7000000001", "EUW1_7000000002"],
      10,
      now,
    );
    // One ingested solo-queue game on the fixture patch, then its champion aggregates.
    const match = JSON.parse(
      await readFile(
        new URL("../../../packages/data/tests/riot/match-euw1.json", import.meta.url),
        "utf8",
      ),
    ) as { metadata: { matchId: string }; info: { gameVersion: string } };
    match.metadata.matchId = "EUW1_7000000001";
    match.info.gameVersion = "16.4.736.1";
    await saveRiotMatch(pool, parseRiotMatch(match, "EUW1_7000000001"), match, now);
    const timeline = JSON.parse(
      await readFile(
        new URL("../../../packages/data/tests/riot/timeline-euw1.json", import.meta.url),
        "utf8",
      ),
    ) as { metadata: { matchId: string } };
    timeline.metadata.matchId = "EUW1_7000000001";
    await saveTimeline(pool, parseRiotTimeline(timeline, "EUW1_7000000001"), now);
    await sync.request({ kind: "aggregate" });
    if ((await sync.runNext()).state !== "done")
      throw new Error("Browser aggregate fixture failed");
    // A model from the one seeded game, so the solo game page can chart win probability.
    await trainWinProbabilityModel(pool, now, { minimumMatches: 1, seed: 1 });
    // Score the game with the new model and build its win probability added leaderboards.
    await sync.request({ kind: "aggregate" });
    if ((await sync.runNext()).state !== "done") throw new Error("Browser WPA fixture failed");
    await sync.request({ kind: "entities" });
    if ((await sync.runNext()).state !== "done")
      throw new Error("Browser fixture identity linking failed");
    const proFile = resolve(folder, "pro-links.json");
    await writeFile(
      proFile,
      JSON.stringify(
        proAccountFixture([proAccountFixtureLink(), proAccountFixtureLink("b", "11-mid")]),
      ),
    );
    await sync.request({ kind: "pro-account-links", file: proFile });
    if ((await sync.runNext()).state !== "done")
      throw new Error("Browser pro links fixture failed");
  } finally {
    await sync.close();
    await pool.end();
  }
}
