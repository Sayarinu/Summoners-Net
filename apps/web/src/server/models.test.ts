import { expect, it, vi } from "vitest";

const modelDiagnostics = vi.fn().mockResolvedValue({ models: [], selected: null });
vi.mock("server-only", () => ({}));
vi.mock("./data", () => ({ data: () => ({ modelDiagnostics }) }));
const { loadModelDiagnostics } = await import("./models");

it("validates the selected model id", async () => {
  expect((await loadModelDiagnostics({ model: "3" })).error).toBeNull();
  expect(modelDiagnostics).toHaveBeenLastCalledWith(3);
  expect((await loadModelDiagnostics({ model: "drop table" })).error).toMatch(/Choose a model/);
  expect(modelDiagnostics).toHaveBeenLastCalledWith(undefined);
});
