import { expect, it } from "vitest";
import {
  parseProAccountLinksFile,
  proAccountLinksMaxBytes,
  proAccountLinksSchema,
  ProAccountImportError,
} from "./pro-accounts.js";
import { proAccountFixture, proAccountFixtureLink } from "../../tests/pro-account-fixtures.js";
it("accepts versioned source IDs and evidence while preserving source strings", () => {
  const file = proAccountFixture([
    proAccountFixtureLink(),
    {
      ...proAccountFixtureLink("b"),
      player: { source: "pandascore", sourceId: "123" },
      evidence: [{ url: "http://example.invalid/evidence#account" }],
    },
  ]);
  expect(parseProAccountLinksFile(JSON.stringify(file))).toEqual(file);
});
it("rejects name-only links, duplicate accounts, absent evidence and unsafe source URLs with row reports", () => {
  const link = proAccountFixtureLink();
  for (const bad of [
    { ...link, player: { name: "Player Blue mid" } },
    { ...link, player: { source: "oracle", sourceId: "observation:fixture:1" } },
    { ...link, evidence: [] },
    { ...link, puuid: "name#tag" },
    ...["not a url", "javascript:alert(1)", "https://name:secret@example.invalid/pro"].map(
      (url) => ({ ...link, evidence: [{ url }] }),
    ),
  ]) {
    expect(() =>
      parseProAccountLinksFile(JSON.stringify({ formatVersion: 1, links: [bad] })),
    ).toThrow(ProAccountImportError);
    expect(() =>
      parseProAccountLinksFile(JSON.stringify({ formatVersion: 1, links: [bad] })),
    ).toThrow(/links.0/);
  }
  expect(proAccountLinksSchema.safeParse(proAccountFixture([link, link])).success).toBe(false);
});
it("bounds the complete file and rejects unknown versions and malformed JSON", () => {
  expect(() => parseProAccountLinksFile("{")).toThrow(/valid JSON/);
  expect(() =>
    parseProAccountLinksFile(JSON.stringify({ ...proAccountFixture(), formatVersion: 2 })),
  ).toThrow(/expected 1/);
  expect(() => parseProAccountLinksFile(" ".repeat(proAccountLinksMaxBytes + 1))).toThrow(/5 MiB/);
  expect(() => parseProAccountLinksFile(JSON.stringify({ formatVersion: 1, links: [] }))).toThrow(
    /validation failed/,
  );
  expect(() =>
    parseProAccountLinksFile(JSON.stringify({ formatVersion: 1, links: Array(10001).fill(null) })),
  ).toThrow(/10,000 row/);
  const badText = proAccountFixture([
    {
      ...proAccountFixtureLink(),
      evidence: [{ url: "https://example.invalid", note: String.fromCharCode(0) }],
    },
  ]);
  expect(() => parseProAccountLinksFile(JSON.stringify(badText))).toThrow(/Unicode/);
  const lone = proAccountFixture([
    {
      ...proAccountFixtureLink(),
      player: { source: "oracle", sourceId: String.fromCharCode(0xd800) },
    },
  ]);
  expect(() => parseProAccountLinksFile(JSON.stringify(lone))).toThrow(/Unicode/);
  const emoji = proAccountFixture([
    {
      ...proAccountFixtureLink(),
      evidence: [{ url: "https://example.invalid", note: "Verified source 🙂" }],
    },
  ]);
  expect(parseProAccountLinksFile(JSON.stringify(emoji))).toEqual(emoji);
  const hugeKey = "x".repeat(2000);
  try {
    parseProAccountLinksFile(JSON.stringify({ ...proAccountFixture(), [hugeKey]: true }));
    throw new Error("Expected rejection");
  } catch (error) {
    expect((error as Error).message.length).toBeLessThan(500);
  }
});
