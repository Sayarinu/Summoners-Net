import { createSync } from "./sync/index.js";
import { createQueries } from "./index.js";
import { readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { archiveYears } from "./providers/oracle.js";
const [command, ...args] = process.argv.slice(2);
const connection = process.env.DATABASE_URL;
if (!connection) throw new Error("Set DATABASE_URL in the ignored .env file.");
const sync = createSync(connection, {
  ...(process.env.PANDASCORE_TOKEN ? { token: process.env.PANDASCORE_TOKEN } : {}),
  ...(process.env.ORACLE_CURRENT_FILE ? { currentFile: process.env.ORACLE_CURRENT_FILE } : {}),
});
let stop = false;
process.on("SIGINT", () => {
  stop = true;
});
process.on("SIGTERM", () => {
  stop = true;
});
try {
  if (command === "migrate") await sync.migrate();
  else if (
    command === "entities" ||
    command === "resolve" ||
    command === "entity-history" ||
    command === "entity-rosters"
  ) {
    const id = await sync.request({
      kind: command,
      ...(command === "entity-history" || command === "entity-rosters"
        ? { year: Number(args[0]) }
        : {}),
    });
    process.stdout.write(`Queued ${command} job ${id}.\n`);
    // A bounded drain does not schedule other recurring work or leave a worker running.
    while (!stop) {
      const result = await sync.runNext();
      process.stdout.write(`${JSON.stringify(result)}\n`);
      if (result.state === "idle" || result.state === "busy" || result.id === id) break;
    }
  } else if (command === "backfill-all") {
    for (const year of archiveYears) {
      const id = await sync.request({ kind: "history", year });
      process.stdout.write(`Queued history:${year} job ${id}.\n`);
    }
  } else if (command === "import-dir") {
    const directory = resolve(args[0] ?? "");
    if (!args[0]) throw new Error("Usage: pnpm history:import-dir /absolute/path");
    let queued = 0;
    for (const name of (await readdir(directory)).sort()) {
      if (!name.toLowerCase().endsWith(".csv")) continue;
      const match = name.match(/(?:^|\D)(20(?:1[4-9]|2\d))(?:\D|$)/);
      if (!match || !archiveYears.includes(Number(match[1])))
        throw new Error(`Could not identify a manifest year from ${name}.`);
      const id = await sync.request({
        kind: "history",
        year: Number(match[1]),
        file: resolve(directory, name),
        method: "manual",
      });
      process.stdout.write(`Queued history:${match[1]} job ${id}.\n`);
      queued++;
    }
    if (!queued) throw new Error("Directory contains no annual CSV files.");
  } else if (command === "import" || command === "backfill") {
    const year = Number(args[0]);
    const file = args[1];
    if (command === "import" && !file)
      throw new Error("Usage: pnpm history:import YEAR /absolute/path/annual.csv");
    const id = await sync.request({
      kind: "history",
      year,
      ...(file ? { file } : {}),
    });
    process.stdout.write(`Queued history job ${id}. Run pnpm sync:once or pnpm sync.\n`);
  } else if (command === "once" || command === "work") {
    let first = true;
    do {
      const result = await sync.runNext(command === "work" || first);
      first = false;
      if (result.state !== "idle" && result.state !== "busy")
        process.stdout.write(`${JSON.stringify(result)}\n`);
      if (command === "once" && (result.state === "idle" || result.state === "busy")) break;
      if (result.state === "idle" || result.state === "busy")
        await new Promise<void>((resolve) => {
          setTimeout(resolve, 2000);
        });
    } while (!stop);
  } else if (command === "status") {
    const q = createQueries(connection);
    try {
      process.stdout.write(`${JSON.stringify(await q.status(), null, 2)}\n`);
    } finally {
      await q.close();
    }
  } else
    throw new Error(
      "Commands: migrate, work, once, entities, resolve, entity-history YEAR, entity-rosters YEAR, import YEAR FILE, import-dir DIRECTORY, backfill YEAR, backfill-all, status",
    );
} finally {
  await sync.close();
}
