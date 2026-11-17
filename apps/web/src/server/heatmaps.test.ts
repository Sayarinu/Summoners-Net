import { expect, it, vi } from "vitest";

const heatmap = vi.fn();
vi.mock("server-only", () => ({}));
vi.mock("./data", () => ({ data: () => ({ heatmap }) }));
const { loadHeatmap } = await import("./heatmaps");

it("validates the query before reading and treats an unknown subject as not found", async () => {
  heatmap.mockResolvedValueOnce({ subject: "Ahri" });
  expect(await loadHeatmap({ subjectKind: "champion", subject: "Ahri", patch: "" })).toEqual({
    heatmap: { subject: "Ahri" },
    error: null,
  });
  expect(heatmap).toHaveBeenLastCalledWith({
    subjectKind: "champion",
    subject: "Ahri",
    kind: "position",
  });
  heatmap.mockResolvedValueOnce(null);
  expect(await loadHeatmap({ subjectKind: "role", subject: "SUPPORT" })).toBeNull();
  for (const bad of [
    {},
    { subjectKind: "team", subject: "T1" },
    { subjectKind: "champion", subject: "../etc" },
    { subjectKind: "champion", subject: "Ahri", kind: "assists" },
    { subjectKind: "champion", subject: "Ahri", patch: "latest-ish" },
    { subjectKind: "champion", subject: ["Ahri", "Zed"] },
    { subjectKind: "champion", subject: "Ahri", extra: "1" },
  ])
    expect(await loadHeatmap(bad)).toEqual({ heatmap: null, error: expect.any(String) as string });
  expect(heatmap).toHaveBeenCalledTimes(2);
});
