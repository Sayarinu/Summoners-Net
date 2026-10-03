import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createSync } from "@esportsviewer/data/sync";
import { database } from "../../../packages/data/src/persistence/database";
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
      if (endpoint.includes("cdn-api.pandascore.co"))
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
      "TRUNCATE identity_tournament_rosters,identity_match_context,identity_catalog,identity_resolution_runs,image_assets,oracle_archive_participants,oracle_archive_games,participants,broadcasts,roster_observations,roster_snapshots,games,matches,competitions,source_mappings,identities,metadata,imports,sync_jobs,sync_schedule,request_ledger RESTART IDENTITY CASCADE",
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
    await sync.request({ kind: "entities" });
    if ((await sync.runNext()).state !== "done")
      throw new Error("Browser fixture identity linking failed");
  } finally {
    await sync.close();
    await pool.end();
  }
}
