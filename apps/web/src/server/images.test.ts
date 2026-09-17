// @vitest-environment node
import { it, expect, vi } from "vitest";
import { serveImage } from "./images";
const image = vi.hoisted(() => vi.fn());
vi.mock("./data", () => ({ data: () => ({ image }) }));
it("serves only cached raster bytes with immutable same-origin headers", async () => {
  expect((await serveImage("invalid")).status).toBe(404);
  expect(image).not.toHaveBeenCalled();
  image.mockResolvedValueOnce(null);
  expect((await serveImage("a".repeat(64))).status).toBe(404);
  image.mockResolvedValueOnce({ contentType: "image/png", bytes: new Uint8Array([1, 2, 3]) });
  const response = await serveImage("b".repeat(64));
  expect(response.status).toBe(200);
  expect(response.headers.get("content-type")).toBe("image/png");
  expect(response.headers.get("cache-control")).toContain("immutable");
  expect(response.headers.get("cross-origin-resource-policy")).toBe("same-origin");
  expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
});
