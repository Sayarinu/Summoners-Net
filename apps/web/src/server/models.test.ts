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

it("passes a valid game phase through and drops an unknown one", async () => {
  expect(await loadModelDiagnostics({ model: "3", phase: "late" })).toMatchObject({
    phase: "late",
    error: null,
  });
  expect(await loadModelDiagnostics({ model: "3", phase: "overtime" })).toMatchObject({
    phase: null,
    error: expect.stringMatching(/Choose a model/) as string,
  });
});
