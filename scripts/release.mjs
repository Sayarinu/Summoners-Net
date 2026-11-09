#!/usr/bin/env node
// Chooses release versions and writes release notes for the experimental and main channels.
//
//   node scripts/release.mjs version         -> writes version/level/previous/prerelease/publish to GITHUB_OUTPUT
//   node scripts/release.mjs notes VER PREV OUT
//
// Every push to main is a stable release vX.Y.Z: the newest stable tag merged into main, bumped by the
// largest PR label merged since (Major Release > Feature > patch). A higher package.json version wins.
// Every push to experimental is a prerelease vX.Y.Z-beta.N, where X.Y.Z is the stable version its
// unreleased changes are heading for. SemVer sorts 0.7.0 < 0.7.1-beta.1 < 0.7.1-beta.2 < 0.7.1.
import { execFileSync } from "node:child_process";
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const STABLE = /^v(\d+)\.(\d+)\.(\d+)$/;
const BETA = /^v(\d+)\.(\d+)\.(\d+)-beta\.(\d+)$/;
const MAIN = "refs/heads/main";
const EXPERIMENTAL = "refs/heads/experimental";
export const PATCH = 1;
export const MINOR = 2;
export const MAJOR = 3;
const LEVELS = new Map([
  ["major release", MAJOR],
  ["feature", MINOR],
]);
const NAMES = { [PATCH]: "patch", [MINOR]: "feature", [MAJOR]: "major" };

const git = (...args) => execFileSync("git", args, { cwd: ROOT, encoding: "utf8" });
const lines = (text) => text.split("\n").filter(Boolean);
const text = (version) => version.join(".");
const compare = (a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
const max = (a, b) => (compare(a, b) >= 0 ? a : b);

export function bump([major, minor, patch], level) {
  if (level >= MAJOR) return [major + 1, 0, 0];
  if (level >= MINOR) return [major, minor + 1, 0];
  return [major, minor, patch + 1];
}

export function levelOf(labels) {
  return Math.max(PATCH, ...labels.map((name) => LEVELS.get(name.toLowerCase()) ?? PATCH));
}

function newestStable(tags) {
  const versions = tags.flatMap((tag) => {
    const match = STABLE.exec(tag);
    return match ? [{ tag, version: match.slice(1, 4).map(Number) }] : [];
  });
  return versions.reduce(
    (best, item) => (!best || compare(item.version, best.version) > 0 ? item : best),
    null,
  );
}

function newestBeta(tags) {
  const versions = tags.flatMap((tag) => {
    const match = BETA.exec(tag);
    return match ? [{ tag, key: match.slice(1, 5).map(Number) }] : [];
  });
  const order = (a, b) => compare(a.key, b.key) || a.key[3] - b.key[3];
  return versions.sort(order).at(-1) ?? null;
}

/** Returns a function giving the merged pull requests (title, number, labels) for a commit. */
export function githubPulls(repository, token, fetchImpl = fetch) {
  return async (sha) => {
    const response = await fetchImpl(
      `https://api.github.com/repos/${repository}/commits/${sha}/pulls`,
      {
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${token}`,
          "X-GitHub-Api-Version": "2022-11-28",
          "User-Agent": "summonersnet-release",
        },
      },
    );
    if (!response.ok) throw new Error(`GitHub returned ${response.status} for ${sha}`);
    const pulls = await response.json();
    return pulls
      .filter((pull) => pull.merged_at)
      .map((pull) => ({
        number: pull.number,
        title: pull.title,
        labels: pull.labels.map((label) => label.name),
      }));
  };
}

async function releaseLevel(commits, pullsFor) {
  let level = PATCH;
  for (const sha of commits) {
    for (const pull of await pullsFor(sha)) level = Math.max(level, levelOf(pull.labels));
  }
  return level;
}

/**
 * Chooses the release for this CI event. `repo` supplies tags, commit ranges and the declared floor;
 * `pullsFor` gives each commit's merged PRs.
 */
export async function chooseRelease({ ref, event, repo, pullsFor }) {
  const floor = repo.declared();
  if (!(event === "push" && (ref === MAIN || ref === EXPERIMENTAL))) {
    return { version: text(floor), level: "none", previous: "", prerelease: false, publish: false };
  }
  if (ref === EXPERIMENTAL) {
    const stable = newestStable(repo.tags());
    // Only changes not yet on main decide where experimental is heading.
    const level = await releaseLevel(repo.commits("origin/main..HEAD"), pullsFor);
    const target = text(max(bump(stable?.version ?? floor, level), floor));
    const builds = repo
      .tags()
      .flatMap((tag) => (tag.startsWith(`v${target}-beta.`) ? [Number(BETA.exec(tag)?.[4])] : []));
    const build = Math.max(0, ...builds.filter(Number.isInteger)) + 1;
    return {
      version: `${target}-beta.${build}`,
      level: NAMES[level],
      previous: newestBeta(repo.tags("HEAD"))?.tag ?? "origin/main",
      prerelease: true,
      publish: true,
    };
  }
  const previous = newestStable(repo.tags("HEAD"));
  const commits = previous ? repo.commits(`${previous.tag}..HEAD`) : repo.commits("-1 HEAD");
  const level = await releaseLevel(commits, pullsFor);
  return {
    version: text(max(bump(previous?.version ?? floor, level), floor)),
    level: NAMES[level],
    previous: previous?.tag ?? "",
    prerelease: false,
    publish: true,
  };
}

/** 'LUNE-433 - Rank teams properly (#84)' -> 'Rank teams properly'. */
export function cleanTitle(title) {
  const clean = title
    .trim()
    .replace(/^[A-Z]+-\d+\s*[-–:]\s*/, "")
    .replace(/\s*\(#\d+\)\s*$/, "");
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

/** Groups unique PR titles, in merge order, into New (Feature/Major Release) and the rest. */
export async function changes(commits, pullsFor) {
  const added = [];
  const improved = [];
  const seen = new Set();
  for (const { sha, subject } of commits) {
    const pulls = await pullsFor(sha);
    for (const pull of pulls.length ? pulls : [{ number: null, title: subject, labels: [] }]) {
      const key = pull.number ?? pull.title;
      const title = cleanTitle(pull.title);
      if (seen.has(key) || !title) continue;
      seen.add(key);
      (levelOf(pull.labels) > PATCH ? added : improved).push(title);
    }
  }
  return { added, improved };
}

export function renderNotes({ added, improved }) {
  const out = [];
  if (added.length) out.push("### New", ...added.map((title) => `- ${title}`), "");
  if (improved.length)
    out.push("### Improvements and fixes", ...improved.map((title) => `- ${title}`), "");
  return (out.length ? out : ["Maintenance release.", ""]).join("\n");
}

const gitRepo = {
  declared: () => {
    const { version } = JSON.parse(
      readFileSync(new URL("../package.json", import.meta.url), "utf8"),
    );
    const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
    if (!match) throw new Error("package.json has no MAJOR.MINOR.PATCH version");
    return match.slice(1).map(Number);
  },
  tags: (merged) => lines(git("tag", "--list", "v*", ...(merged ? ["--merged", merged] : []))),
  commits: (range) => lines(git("rev-list", "--no-merges", "--max-count=200", ...range.split(" "))),
};

async function main([command, ...args]) {
  const { GITHUB_REPOSITORY: repository, GH_TOKEN: token } = process.env;
  const pullsFor = githubPulls(repository, token);
  if (command === "version") {
    const release = await chooseRelease({
      ref: process.env.GITHUB_REF ?? "",
      event: process.env.GITHUB_EVENT_NAME ?? "",
      repo: gitRepo,
      pullsFor,
    });
    const output = Object.entries(release).map(([key, value]) => `${key}=${value}\n`);
    if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, output.join(""));
    process.stdout.write(`${release.version}\n`);
    return;
  }
  if (command === "notes") {
    const [, previous, file] = args;
    const range = previous ? [`${previous}..HEAD`] : ["-n", "20", "HEAD"];
    const log = lines(git("log", "--no-merges", "--format=%H%x09%s", ...range));
    // Oldest first, so the notes read in the order changes landed.
    const commits = log.reverse().map((line) => {
      const [sha, subject] = line.split("\t");
      return { sha, subject };
    });
    writeFileSync(file, renderNotes(await changes(commits, pullsFor)));
    return;
  }
  throw new Error("Usage: release.mjs version | notes VERSION PREVIOUS OUTPUT");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
