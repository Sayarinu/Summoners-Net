import assert from "node:assert/strict";
import { test } from "node:test";

import { changes, chooseRelease, cleanTitle, githubPulls, renderNotes } from "./release.mjs";

const MAIN = "refs/heads/main";
const EXPERIMENTAL = "refs/heads/experimental";

function repo({ tags = [], merged = tags, commits = {}, declared = [0, 0, 0] }) {
  return {
    declared: () => declared,
    tags: (ref) => (ref ? merged : tags),
    commits: (range) => commits[range] ?? [],
  };
}

const pulls = (labelsBySha) => async (sha) =>
  labelsBySha[sha] ? [{ number: sha, title: sha, labels: labelsBySha[sha] }] : [];

test("pull requests and branch pushes outside the channels never publish", async () => {
  for (const [ref, event] of [
    [MAIN, "pull_request"],
    ["refs/heads/LUNE-286", "push"],
  ]) {
    const release = await chooseRelease({
      ref,
      event,
      repo: repo({ declared: [0, 3, 0] }),
      pullsFor: pulls({}),
    });
    assert.deepEqual(release, {
      version: "0.3.0",
      level: "none",
      previous: "",
      prerelease: false,
      publish: false,
    });
  }
});

test("main bumps the newest merged stable tag by the largest label merged since", async () => {
  const commits = { "v0.1.7..HEAD": ["a", "b"] };
  const cases = [
    [{}, "0.1.8", "patch"],
    [{ a: ["Feature"] }, "0.2.0", "feature"],
    [{ a: ["feature"], b: ["Major Release"] }, "1.0.0", "major"],
  ];
  for (const [labels, version, level] of cases) {
    const release = await chooseRelease({
      ref: MAIN,
      event: "push",
      repo: repo({ tags: ["v0.1.7", "v0.1.6", "v0.1.8-beta.1"], commits }),
      pullsFor: pulls(labels),
    });
    assert.deepEqual(release, {
      version,
      level,
      previous: "v0.1.7",
      prerelease: false,
      publish: true,
    });
  }
});

test("the first main release and a higher declared version both win over tags", async () => {
  const first = await chooseRelease({
    ref: MAIN,
    event: "push",
    repo: repo({ commits: { "-1 HEAD": ["a"] } }),
    pullsFor: pulls({}),
  });
  assert.equal(first.version, "0.0.1");
  assert.equal(first.previous, "");

  const declared = await chooseRelease({
    ref: MAIN,
    event: "push",
    repo: repo({ tags: ["v0.1.7"], declared: [2, 0, 0] }),
    pullsFor: pulls({}),
  });
  assert.equal(declared.version, "2.0.0");
});

test("experimental numbers prereleases of the stable version its changes head for", async () => {
  const release = await chooseRelease({
    ref: EXPERIMENTAL,
    event: "push",
    repo: repo({
      tags: ["v0.7.0", "v0.8.0-beta.1", "v0.8.0-beta.2", "v0.7.1-beta.4"],
      merged: ["v0.7.0", "v0.8.0-beta.1", "v0.8.0-beta.2"],
      commits: { "origin/main..HEAD": ["a"] },
    }),
    pullsFor: pulls({ a: ["Feature"] }),
  });
  assert.deepEqual(release, {
    version: "0.8.0-beta.3",
    level: "feature",
    previous: "v0.8.0-beta.2",
    prerelease: true,
    publish: true,
  });

  const first = await chooseRelease({
    ref: EXPERIMENTAL,
    event: "push",
    repo: repo({ tags: ["v0.7.0"] }),
    pullsFor: pulls({}),
  });
  assert.equal(first.version, "0.7.1-beta.1");
  assert.equal(first.previous, "origin/main");
});

test("notes list unique cleaned PR titles under New or Improvements in merge order", async () => {
  assert.equal(cleanTitle("LUNE-433 - rank teams properly (#84)"), "Rank teams properly");
  const pullsFor = async (sha) =>
    ({
      a: [{ number: 1, title: "LUNE-1 - Add player search (#1)", labels: ["Feature"] }],
      b: [{ number: 2, title: "LUNE-2 - Fix spoiler toggle (#2)", labels: [] }],
      c: [{ number: 1, title: "LUNE-1 - Add player search (#1)", labels: ["Feature"] }],
    })[sha] ?? [];
  const grouped = await changes(
    [
      { sha: "a", subject: "x" },
      { sha: "b", subject: "y" },
      { sha: "c", subject: "z" },
      { sha: "d", subject: "LUNE-3 - Direct push" },
    ],
    pullsFor,
  );
  assert.equal(
    renderNotes(grouped),
    "### New\n- Add player search\n\n### Improvements and fixes\n- Fix spoiler toggle\n- Direct push\n",
  );
  assert.equal(renderNotes({ added: [], improved: [] }), "Maintenance release.\n");
});

test("GitHub lookups keep only merged pull requests and report failures", async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push([url, init.headers.Authorization]);
    if (url.endsWith("/bad/pulls")) return { ok: false, status: 502 };
    return {
      ok: true,
      json: async () => [
        { number: 4, title: "Merged", merged_at: "2026-11-03", labels: [{ name: "Feature" }] },
        { number: 5, title: "Open", merged_at: null, labels: [] },
      ],
    };
  };
  const pullsFor = githubPulls("Sayarinu/EsportsViewer", "token", fetchImpl);
  assert.deepEqual(await pullsFor("abc"), [{ number: 4, title: "Merged", labels: ["Feature"] }]);
  assert.deepEqual(calls[0], [
    "https://api.github.com/repos/Sayarinu/EsportsViewer/commits/abc/pulls",
    "Bearer token",
  ]);
  await assert.rejects(pullsFor("bad"), /GitHub returned 502 for bad/);
});
