import { Readable } from "node:stream";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { historyCsv } from "../../tests/fixtures.js";
import { streamOracleArchive, type ArchiveRow } from "./oracle-archive.js";
import { maximumArchiveBytes, stageOracleArtifact } from "../sync/artifacts.js";

const directories: string[] = [];
afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  );
});
const enriched = (kills = "5") => {
  const lines = historyCsv({ kills }).trimEnd().split("\n");
  lines[0] +=
    ",damagetochampions,visionscore,totalgold,total cs,golddiffat15,xpdiffat15,csdiffat15,dragons";
  return (
    lines
      .map((line, index) => (index ? `${line},1200,30,10000,200,-100,-20,-3,2` : line))
      .join("\n") + "\n"
  );
};
async function parsed(csv: string) {
  const rows: ArchiveRow[] = [];
  const result = await streamOracleArchive(Readable.from(csv), 2026, (batch) => {
    rows.push(...batch);
    return Promise.resolve();
  });
  return { rows, result };
}

describe("lossless Oracle archive parsing", () => {
  it("maps field families, keeps negative differentials, and warns on invalid optional values", async () => {
    const valid = await parsed(enriched());
    expect(valid.rows[0]).toMatchObject({
      damageToChampions: 1200,
      visionScore: 30,
      totalGold: 10000,
      totalCs: 200,
      statistics: { golddiffat15: -100, xpdiffat15: -20, csdiffat15: -3, dragons: 2 },
    });
    const invalid = await parsed(enriched("-1"));
    expect(invalid.rows[0]?.kills).toBeNull();
    expect(invalid.result.warnings).toContainEqual({
      field: "kills",
      count: 12,
      reason: "invalid optional statistic",
    });
  });
  it("deduplicates identical slots and blocks schema drift and conflicting duplicates", async () => {
    const csv = historyCsv();
    expect((await parsed(csv + csv.split("\n")[1] + "\n")).result.duplicates).toBe(1);
    await expect(parsed(csv.replace("datacompleteness", "mysteryfield"))).rejects.toThrow(
      "Unmapped Oracle headers",
    );
    await expect(
      parsed(csv + historyCsv({ kills: "6" }).split("\n").slice(1).join("\n")),
    ).rejects.toThrow("Conflicting duplicate");
  });
  it("keeps contradictory results browsable while excluding that game from summaries", async () => {
    const lines = historyCsv().trimEnd().split("\n");
    const first = lines[1]!.split(",");
    first[9] = "0";
    lines[1] = first.join(",");
    const result = await parsed(`${lines.join("\n")}\n`);
    expect(result.result.games).toBe(1);
    expect(result.result.eligibleGames).toBe(0);
    expect(result.result.warnings).toContainEqual({
      field: "result",
      count: 1,
      reason: "inconsistent game result",
    });
  });
  it("retains a contradictory team row without treating the game as a summary sample", async () => {
    const lines = historyCsv().trimEnd().split("\n");
    const team = lines.findIndex((line) => line.includes(",team,Blue,"));
    expect(team).toBeGreaterThan(0);
    const fields = lines[team]!.split(",");
    fields[5] = "different-team-id";
    lines[team] = fields.join(",");
    const result = await parsed(`${lines.join("\n")}\n`);
    expect(result.result.eligibleGames).toBe(0);
    expect(result.result.warnings).toContainEqual({
      field: "team",
      count: 1,
      reason: "inconsistent team context",
    });
  });
  it("keeps a source row with no team name and flags the game as incomplete", async () => {
    const lines = historyCsv().trimEnd().split("\n");
    const fields = lines[1]!.split(",");
    fields[5] = "";
    fields[6] = "";
    lines[1] = fields.join(",");
    const result = await parsed(`${lines.join("\n")}\n`);
    expect(result.rows[0]?.teamName).toBe("");
    expect(result.result.eligibleGames).toBe(0);
    expect(result.result.warnings).toContainEqual({
      field: "teamname",
      count: 1,
      reason: "missing team name",
    });
  });
});

describe("private archive artifact staging", () => {
  it("hashes exact bytes into mode-0600 files and rejects quota and year mismatch pages", async () => {
    const directory = await mkdtemp(join(tmpdir(), "oracle-artifacts-"));
    directories.push(directory);
    const source = join(directory, "2026-official.csv");
    await writeFile(source, historyCsv());
    const staged = await stageOracleArtifact({ year: 2026, directory, file: source });
    expect(await readFile(staged.path, "utf8")).toBe(historyCsv());
    expect((await stat(staged.path)).mode & 0o777).toBe(0o600);
    await expect(stageOracleArtifact({ year: 2025, directory, file: source })).rejects.toThrow(
      "filename/year mismatch",
    );
    await expect(
      stageOracleArtifact({
        year: 2026,
        directory,
        response: new Response("<!doctype html>download quota exceeded"),
      }),
    ).rejects.toThrow("HTML/quota");
    await expect(
      stageOracleArtifact({
        year: 2026,
        directory,
        response: new Response("x", {
          headers: { "content-length": String(maximumArchiveBytes + 1) },
        }),
      }),
    ).rejects.toThrow("256 MiB");
  });
});
