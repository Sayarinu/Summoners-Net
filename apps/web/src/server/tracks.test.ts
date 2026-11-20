import { expect, it, vi } from "vitest";

const matchTrackRange = vi.fn();
vi.mock("server-only", () => ({}));
vi.mock("./data", () => ({ data: () => ({ matchTrackRange }) }));
const { trackRange } = await import("./tracks");
const get = (query: string, matchId = "EUW1_1") =>
  trackRange(new Request(`http://127.0.0.1/api/solo-games/${matchId}/track?${query}`), matchId);

it("validates the range before reading and reports unlinked games as not found", async () => {
  matchTrackRange.mockResolvedValueOnce([{ timeMs: 0, positions: [] }]);
  const ok = await get("fromMs=0&toMs=59999");
  expect(ok.status).toBe(200);
  expect(await ok.json()).toEqual([{ timeMs: 0, positions: [] }]);
  expect(matchTrackRange).toHaveBeenCalledWith({ matchId: "EUW1_1", fromMs: 0, toMs: 59999 });
  matchTrackRange.mockResolvedValueOnce(null);
  expect((await get("fromMs=0&toMs=1")).status).toBe(404);
  for (const query of [
    "fromMs=0&toMs=120001",
    "fromMs=10&toMs=5",
    "fromMs=-1&toMs=5",
    "fromMs=a&toMs=5",
    "fromMs=0",
    "fromMs=0&toMs=1&extra=1",
  ])
    expect((await get(query)).status).toBe(400);
  expect((await get("fromMs=0&toMs=1", "../etc")).status).toBe(400);
  expect(matchTrackRange).toHaveBeenCalledTimes(2);
});
