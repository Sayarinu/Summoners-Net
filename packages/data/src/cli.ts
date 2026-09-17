import { createSync } from "./sync/index.js";
import { createQueries } from "./index.js";
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
  else if (command === "import" || command === "backfill") {
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
  } else throw new Error("Commands: migrate, work, once, import YEAR FILE, backfill YEAR, status");
} finally {
  await sync.close();
}
