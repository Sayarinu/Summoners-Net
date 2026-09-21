import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";
import { fileURLToPath, URL } from "node:url";

const rootEnvPath = fileURLToPath(new URL("../../../.env", import.meta.url));

if (existsSync(rootEnvPath)) {
  loadEnvFile(rootEnvPath);
}
