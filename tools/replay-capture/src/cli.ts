import { runCommand } from "./command.js";
const controller = new AbortController();
const stop = () => controller.abort(new Error("Replay capture cancelled."));
process.once("SIGINT", stop);
process.once("SIGTERM", stop);
process.exitCode = await runCommand(process.argv.slice(2), {
  platform: process.platform,
  out: (text) => {
    process.stdout.write(text);
  },
  error: (text) => {
    process.stderr.write(text);
  },
  runtime: { signal: controller.signal },
});
process.removeListener("SIGINT", stop);
process.removeListener("SIGTERM", stop);
