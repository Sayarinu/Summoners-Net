import { Pool, type PoolClient } from "pg";
import { readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve, join } from "node:path";
export type Executor = Pick<Pool, "query">;
export function database(connectionString: string) {
  const pool = new Pool({
    connectionString,
    max: 8,
    connectionTimeoutMillis: 5000,
    statement_timeout: 60000,
    application_name: "esportsviewer",
    // Browse queries are short; inflated view estimates otherwise trigger JIT compilation that
    // costs far more than the query itself.
    options: "-c jit=off",
  });
  // pg removes failed idle clients itself. Consume the event so a database restart
  // does not become an unhandled exception; active queries still reject normally.
  pool.on("error", () => {});
  return pool;
}
export async function transaction<T>(
  pool: Pool,
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
export async function migrate(pool: Pool) {
  await transaction(pool, async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(9183271)");
    await client.query(
      "CREATE TABLE IF NOT EXISTS schema_migrations(name text PRIMARY KEY,hash text NOT NULL,applied_at timestamptz NOT NULL DEFAULT now())",
    );
    const dir = resolve(import.meta.dirname, "../../migrations");
    for (const name of (await readdir(dir)).filter((n) => n.endsWith(".sql")).sort()) {
      const sql = await readFile(join(dir, name), "utf8");
      const hash = createHash("sha256").update(sql).digest("hex");
      const existing = await client.query<{ hash: string }>(
        "SELECT hash FROM schema_migrations WHERE name=$1",
        [name],
      );
      if (existing.rows[0]) {
        if (existing.rows[0].hash !== hash) throw new Error("Applied migration changed");
        continue;
      }
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations(name,hash) VALUES($1,$2)", [name, hash]);
    }
  });
}
