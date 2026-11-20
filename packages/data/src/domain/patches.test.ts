import { describe, expect, it } from "vitest";
import { comparePatches, normalizePatch } from "./patches.js";
import versions from "../../tests/ddragon-versions.json" with { type: "json" };

const key = (value: string | null | undefined) => normalizePatch(value)?.key ?? null;
describe("patch normalization", () => {
  it("maps each source's spelling of one patch to the same key", () => {
    // Data Dragon version, Riot match gameVersion, Oracle's Elixir patch, Riot's year-based label.
    for (const value of ["15.21.1", "15.21.715.4285", "15.21", "25.21"])
      expect(key(value)).toBe("15.21");
    // Oracle's Elixir zero-pads the minor ("16.01" in the 2026 file); Data Dragon does not.
    for (const value of ["16.01", "16.1.1", "26.01", " 16.1 "]) expect(key(value)).toBe("16.1");
    expect(key("16.10")).toBe("16.10");
    expect(key("16.1")).not.toBe(key("16.10"));
    expect(key("10.10.3216176")).toBe("10.10");
    expect(key("4.1.2")).toBe("4.1");
  });
  it("leaves unparseable strings unknown instead of guessing", () => {
    for (const value of [
      "25.S1.1",
      "lolpatch_7.20",
      "0.151.2",
      "16",
      "16.0",
      "16.x",
      "",
      "1.2.3.4.5",
      null,
      undefined,
    ])
      expect(key(value)).toBeNull();
  });
  it("orders patches by release", () => {
    const parsed = versions.map((v) => normalizePatch(v)).filter((p) => p !== null);
    expect(parsed.sort(comparePatches).map((p) => p.key)).toEqual([
      "3.15",
      "4.1",
      "10.10",
      "10.10",
      "10.10",
      "15.21",
      "15.24",
      "16.1",
      "16.21",
      "16.22",
    ]);
  });
});
