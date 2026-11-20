import { expect, it } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { readSavedViews, savedViewLimit, savedViewsKey, viewHref, writeSavedViews } from "./model";
import { SavedViewsPanel } from "./panel";

function memory(initial?: unknown) {
  const items = new Map<string, string>();
  if (initial !== undefined)
    items.set(savedViewsKey, typeof initial === "string" ? initial : JSON.stringify(initial));
  return {
    items,
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
  };
}
const valid = {
  id: "v-1",
  name: "Mid tier list",
  path: "/tier-list",
  query: "role=MIDDLE",
  savedAt: "2026-11-16T12:00:00.000Z",
};

it("validates every stored entry and drops only the invalid ones", () => {
  const store = memory([
    valid,
    { ...valid, id: "v-2", path: "https://example.com" },
    { ...valid, id: "v-3", path: "/settings" },
    { ...valid, id: "v-4", query: "?a=1" },
    { ...valid, id: "v-5", name: "" },
    { ...valid, id: "v-6", extra: true },
    "not a view",
    { ...valid, id: "v-7", path: "/champions/Ahri", query: "" },
  ]);
  expect(readSavedViews(store).map((v) => v.id)).toEqual(["v-1", "v-7"]);
  expect(readSavedViews(memory("{not json"))).toEqual([]);
  expect(readSavedViews(memory({ views: [] }))).toEqual([]);
  expect(readSavedViews(memory())).toEqual([]);
  const many = Array.from({ length: savedViewLimit + 5 }, (_, i) => ({ ...valid, id: `v-${i}` }));
  expect(readSavedViews(memory(many))).toHaveLength(savedViewLimit);
  writeSavedViews(store, many);
  expect(JSON.parse(store.items.get(savedViewsKey)!)).toHaveLength(savedViewLimit);
  expect(viewHref(valid)).toBe("/tier-list?role=MIDDLE");
  expect(viewHref({ path: "/heatmaps", query: "" })).toBe("/heatmaps");
});

it("saves the page's filters in browser storage and removes them", async () => {
  const store = memory([valid, { ...valid, id: "bad", path: "/api/preferences" }]);
  render(
    <SavedViewsPanel
      path="/compare/champions"
      query="?a=Ahri&b=Zed"
      defaultName="Ahri vs Zed"
      storage={() => store}
      now={() => new Date("2026-11-17T01:00:00.000Z")}
    />,
  );
  const list = await screen.findByRole("list", { name: "Saved Views" });
  expect(within(list).getAllByRole("listitem")).toHaveLength(1);
  fireEvent.click(screen.getByRole("button", { name: "Save This View" }));
  expect(screen.getByRole("status")).toHaveTextContent('Saved "Ahri vs Zed" in this browser.');
  expect(screen.getByRole("link", { name: "Ahri vs Zed" })).toHaveAttribute(
    "href",
    "/compare/champions?a=Ahri&b=Zed",
  );
  // The invalid stored entry is not written back.
  const stored = JSON.parse(store.items.get(savedViewsKey)!) as { id: string }[];
  expect(stored.map((v) => v.id)).toEqual([
    `v-${Date.parse("2026-11-17T01:00:00.000Z").toString(36)}`,
    "v-1",
  ]);
  fireEvent.click(screen.getByRole("button", { name: "Remove Mid tier list" }));
  expect(screen.queryByRole("link", { name: "Mid tier list" })).toBeNull();
  fireEvent.change(screen.getByLabelText("View Name"), { target: { value: "  " } });
  fireEvent.click(screen.getByRole("button", { name: "Save This View" }));
  expect(screen.getByRole("status")).toHaveTextContent("Name the view first.");
});

it("saves the name entered before the page handles input events", () => {
  const store = memory();
  render(<SavedViewsPanel path="/tier-list" defaultName="Tier List" storage={() => store} />);
  screen.getByLabelText<HTMLInputElement>("View Name").value = "Mid Tier List";
  fireEvent.click(screen.getByRole("button", { name: "Save This View" }));
  expect(readSavedViews(store)[0]?.name).toBe("Mid Tier List");
});

it("lists without saving off filter pages, and reports a full or refusing store", async () => {
  const { unmount } = render(<SavedViewsPanel storage={() => memory()} />);
  expect(screen.queryByRole("button", { name: "Save This View" })).toBeNull();
  expect(screen.getByText("No views are saved in this browser.")).toBeVisible();
  unmount();
  const full = memory(
    Array.from({ length: savedViewLimit }, (_, i) => ({ ...valid, id: `v-${i}` })),
  );
  const { unmount: close } = render(
    <SavedViewsPanel path="/tier-list" defaultName="x" storage={() => full} />,
  );
  await screen.findAllByRole("listitem");
  fireEvent.click(screen.getByRole("button", { name: "Save This View" }));
  expect(screen.getByRole("status")).toHaveTextContent("At most 50 views can be saved");
  close();
  const refusing = {
    getItem: () => null,
    setItem: () => {
      throw new Error("QuotaExceededError");
    },
  };
  render(<SavedViewsPanel path="/heatmaps" query="" defaultName="x" storage={() => refusing} />);
  fireEvent.click(screen.getByRole("button", { name: "Save This View" }));
  expect(screen.getByRole("status")).toHaveTextContent("This browser would not store the view.");
});
