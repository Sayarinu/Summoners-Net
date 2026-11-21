#!/usr/bin/env node
// Runs the whole app locally in production mode: PostgreSQL, a fresh build, migrations,
// then the Next.js server and the sync worker side by side. Ctrl+C stops both.
//
//   pnpm prod                # build, migrate, start web + worker
//   pnpm prod --skip-build   # reuse the existing build
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const skipBuild = process.argv.includes("--skip-build");

function step(label, command, args) {
  console.log(`\n▶ ${label}`);
  const result = spawnSync(command, args, { cwd: root, stdio: "inherit" });
  if (result.status !== 0) {
    console.error(`✖ ${label} failed`);
    process.exit(result.status ?? 1);
  }
}

step("Starting PostgreSQL", "docker", ["compose", "up", "-d", "--wait", "postgres"]);
if (!skipBuild) step("Building", "pnpm", ["build"]);
step("Migrating", "pnpm", ["db:migrate"]);

const children = new Map();
let stopping = false;

function stopAll(code) {
  if (stopping) return;
  stopping = true;
  process.exitCode = code;
  // Signal each child's whole group so pnpm's node grandchildren stop too.
  for (const child of children.values()) process.kill(-child.pid, "SIGTERM");
}

function run(name, args) {
  // Own process group, so the terminal's Ctrl+C reaches us once and we stop children in order.
  const child = spawn("pnpm", args, {
    cwd: root,
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
  });
  children.set(name, child);
  for (const [source, sink] of [
    [child.stdout, process.stdout],
    [child.stderr, process.stderr],
  ]) {
    let buffer = "";
    source.setEncoding("utf8");
    source.on("data", (chunk) => {
      buffer += chunk;
      const lines = buffer.split("\n");
      buffer = lines.pop();
      for (const line of lines) sink.write(`[${name}] ${line}\n`);
    });
    source.on("end", () => buffer && sink.write(`[${name}] ${buffer}\n`));
  }
  child.on("exit", (code, signal) => {
    children.delete(name);
    if (!stopping) {
      console.error(`\n✖ ${name} exited (${signal ?? code}); stopping everything`);
      stopAll(code || 1);
    }
  });
}

console.log("\n▶ Starting web (http://127.0.0.1:3000) and sync worker — Ctrl+C to stop");
run("web", ["start"]);
run("sync", ["sync"]);

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    if (!stopping) console.log("\n▶ Stopping…");
    stopAll(0);
  });
}
