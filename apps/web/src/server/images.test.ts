// @vitest-environment node
import { it, expect, vi } from "vitest";
import { serveImage, serveMinimapImage, serveCatalogImage } from "./images";
const image = vi.hoisted(() => vi.fn());
const mapImage = vi.hoisted(() => vi.fn());
const catalogIcons = vi.hoisted(() => vi.fn());
vi.mock("./data", () => ({ data: () => ({ image, mapImage, catalogIcons }) }));
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

it("redirects the minimap to its cached hash without fetching a provider", async () => {
  mapImage.mockResolvedValueOnce(null);
  expect((await serveMinimapImage()).status).toBe(404);
  mapImage.mockResolvedValueOnce({ imageUrl: `/api/images/${"a".repeat(64)}` });
  const response = await serveMinimapImage();
  expect(response.status).toBe(307);
  expect(response.headers.get("location")).toBe(`/api/images/${"a".repeat(64)}`);
  expect(response.headers.get("cache-control")).toBe("no-store");
});

it("validates catalog ids and redirects only cached icons", async () => {
  expect(
    (await serveCatalogImage({ patch: "bad", kind: "champion", id: "MonkeyKing" })).status,
  ).toBe(400);
  expect(catalogIcons).not.toHaveBeenCalled();
  const input = { patch: "16.22", kind: "champion", id: "MonkeyKing" };
  catalogIcons.mockResolvedValueOnce([]);
  expect((await serveCatalogImage(input)).status).toBe(404);
  catalogIcons.mockResolvedValueOnce([{ imageUrl: null }]);
  expect((await serveCatalogImage(input)).status).toBe(404);
  catalogIcons.mockResolvedValueOnce([{ imageUrl: `/api/images/${"b".repeat(64)}` }]);
  const response = await serveCatalogImage(input);
  expect(response.status).toBe(307);
  expect(response.headers.get("location")).toBe(`/api/images/${"b".repeat(64)}`);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(catalogIcons).toHaveBeenLastCalledWith({
    patch: "16.22",
    kind: "champion",
    ids: ["MonkeyKing"],
  });
});
