import { database, migrate } from "../persistence/database.js";
import { enqueue } from "./queue.js";
import { worker, type WorkerOptions } from "./worker.js";
export { syncRequestSchema } from "../domain/models.js";
export type { SyncRequest } from "../domain/models.js";
export type { WorkerOptions } from "./worker.js";
export function createSync(connectionString: string, options: WorkerOptions = {}) {
  const pool = database(connectionString);
  const clock = options.clock ?? (() => new Date());
  return {
    migrate: () => migrate(pool),
    request: (input: unknown) => enqueue(pool, input, clock()),
    runNext: worker(pool, options),
    close: () => pool.end(),
  };
}
