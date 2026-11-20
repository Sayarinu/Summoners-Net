import { expect, it, vi } from "vitest";
const patchOverview = vi.fn().mockResolvedValue({ patch: "16.22" });
vi.mock("server-only", () => ({}));
vi.mock("./data", () => ({ data: () => ({ patchOverview }) }));
const { loadPatchOverview } = await import("./patches");
it("accepts only normalized patch keys and preserves unknown patches as not found", async () => {
  for (const patch of ["16.22.1", "016.22", "16.022", "invalid"])
    expect(await loadPatchOverview(patch)).toBeNull();
  expect(patchOverview).not.toHaveBeenCalled();
  expect(await loadPatchOverview("16.22")).toEqual({ patch: "16.22" });
  expect(patchOverview).toHaveBeenCalledWith("16.22");
  patchOverview.mockResolvedValueOnce(null);
  expect(await loadPatchOverview("16.99")).toBeNull();
});
