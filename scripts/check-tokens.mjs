import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
const root = new URL("../packages/tokens/", import.meta.url);
const files = ["generated/tokens.css", "generated/tokens.json"];
const before = await Promise.all(files.map((file) => readFile(new URL(file, root), "utf8")));
execFileSync(process.execPath, ["scripts/build.mjs"], { cwd: root, stdio: "inherit" });
for (const [index, file] of files.entries())
  if ((await readFile(new URL(file, root), "utf8")) !== before[index])
    throw new Error(`Generated token drift: ${file}`);
