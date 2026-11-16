import { describe, expect, it } from "vitest";
import champion from "../../tests/ddragon/champion.json" with { type: "json" };
import item from "../../tests/ddragon/item.json" with { type: "json" };
import runes from "../../tests/ddragon/runesReforged.json" with { type: "json" };
import summoner from "../../tests/ddragon/summoner.json" with { type: "json" };
import {
  parseChampionCatalog,
  parseItemCatalog,
  parseRuneCatalog,
  parseSpellCatalog,
} from "./ddragon.js";

describe("Data Dragon catalog parsers", () => {
  it("keep Data Dragon identifiers as received", () => {
    expect(parseChampionCatalog(champion, "16.22.1")).toContainEqual({
      id: "MonkeyKing",
      key: "62",
      name: "Wukong",
      image: "MonkeyKing.png",
      treeId: null,
      slot: null,
    });
    expect(parseItemCatalog(item, "16.22.1").map((i) => [i.id, i.name])).toEqual([
      ["1001", "Boots"],
      ["3006", "Berserker's Greaves"],
    ]);
    expect(parseSpellCatalog(summoner, "16.22.1").map((s) => [s.id, s.key])).toEqual([
      ["SummonerDot", "14"],
      ["SummonerFlash", "4"],
    ]);
    const parsed = parseRuneCatalog(runes);
    expect(parsed[0]).toMatchObject({ id: "8100", key: "Domination", treeId: null, slot: null });
    expect(parsed[1]).toMatchObject({ id: "8112", key: "Electrocute", treeId: 8100, slot: 0 });
    expect(parsed).toHaveLength(5);
  });
  it("reject files that do not match the requested version or schema", () => {
    expect(() => parseChampionCatalog(champion, "16.21.1")).toThrow("version mismatch");
    expect(() => parseItemCatalog(item, "16.21.1")).toThrow("version mismatch");
    expect(() => parseSpellCatalog(summoner, "16.21.1")).toThrow("version mismatch");
    expect(() =>
      parseChampionCatalog(
        { data: { Ahri: { id: "Wukong", key: "103", name: "Ahri", image: { full: "a.png" } } } },
        "16.22.1",
      ),
    ).toThrow("does not match");
    expect(() =>
      parseChampionCatalog(
        { data: { Ahri: { id: "Ahri", key: "x", name: "Ahri", image: { full: "a.png" } } } },
        "16.22.1",
      ),
    ).toThrow();
    expect(() =>
      parseItemCatalog({ data: { boots: { name: "Boots", image: { full: "1.png" } } } }, "16.22.1"),
    ).toThrow();
    expect(() => parseRuneCatalog([])).toThrow();
    expect(() =>
      parseRuneCatalog([{ id: 8100, key: "Domination", name: "D", icon: "a.png", slots: [] }]),
    ).toThrow();
  });
});
