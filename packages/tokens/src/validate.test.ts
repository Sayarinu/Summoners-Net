import { describe, expect, it } from "vitest";

import tokens from "./tokens.json";
import { validateTokenTree } from "./validate.js";

describe("validateTokenTree", () => {
  it("accepts the Nexus Pulse source tokens", () => {
    const result = validateTokenTree(tokens);

    expect(result.errors).toEqual([]);
    expect(result.tokenCount).toBeGreaterThan(40);
  });

  it("reports malformed leaves and an empty tree", () => {
    expect(validateTokenTree({ bad: 4 }).errors).toContain("bad: expected a token group or token");
    expect(validateTokenTree({}).errors).toContain("No DTCG tokens found");
  });
});
