import { it, expect, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { ShellHeader, sectionOf } from "./shell";
import { defaultPreferences } from "../preferences/model";
const path = vi.hoisted(() => ({ value: "/matches/1" }));
const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({
  usePathname: () => path.value,
  useRouter: () => router,
  useSearchParams: () => new URLSearchParams(),
}));
it("keeps route navigation, skip link and local controls available", () => {
  const view = render(<ShellHeader preferences={defaultPreferences} />);
  expect(screen.getByRole("link", { name: "Matches" })).toHaveAttribute("aria-current", "page");
  expect(screen.getByRole("link", { name: "Skip to main content" })).toHaveAttribute(
    "href",
    "#main-content",
  );
  path.value = "/games/1";
  view.rerender(<ShellHeader preferences={defaultPreferences} />);
  expect(screen.getByRole("link", { name: "Past Matches" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  path.value = "/search";
  view.rerender(<ShellHeader preferences={defaultPreferences} />);
  expect(screen.getByRole("searchbox", { name: "Search App" })).toBeVisible();
  fireEvent.click(screen.getByRole("link", { name: "Players" }));
  expect(router.push).toHaveBeenCalledWith("/players");
  // Settings is its own page, marked current like any other section.
  path.value = "/settings";
  view.rerender(<ShellHeader preferences={defaultPreferences} />);
  expect(screen.getByRole("link", { name: "Settings" })).toHaveAttribute("aria-current", "page");
  expect(screen.queryByRole("combobox", { name: "Timezone" })).not.toBeInTheDocument();
});

it("opens and closes the mobile navigation overlay", () => {
  render(<ShellHeader preferences={defaultPreferences} />);
  fireEvent.click(screen.getByRole("button", { name: "Open Navigation" }));
  expect(screen.getAllByRole("button", { name: "Close Navigation" })).toHaveLength(2);
  fireEvent.click(screen.getAllByRole("button", { name: "Close Navigation" })[0]!);
  expect(screen.getByRole("button", { name: "Open Navigation" })).toHaveAttribute(
    "aria-expanded",
    "false",
  );
});

it("links every analytics section and marks the one a page belongs to", () => {
  path.value = "/champions/Ahri/matchups";
  const view = render(<ShellHeader preferences={defaultPreferences} />);
  for (const [name, href] of [
    ["Champions", "/champions"],
    ["Tier List", "/tier-list"],
    ["Leaderboards", "/leaderboards"],
    ["Patches", "/patches"],
    ["Drafts", "/drafts"],
  ] as const)
    expect(screen.getByRole("link", { name })).toHaveAttribute("href", href);
  expect(screen.getByRole("link", { name: "Champions" })).toHaveAttribute("aria-current", "page");
  path.value = "/leaderboards/wpa";
  view.rerender(<ShellHeader preferences={defaultPreferences} />);
  expect(screen.getByRole("link", { name: "Leaderboards" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  expect(
    [
      "/matchups/TOP/counter-picks",
      "/trending",
      "/summoners/x",
      "/solo-games/EUW1_1/map",
      "/drafts/assistant",
      "/patches/16.22",
      "/",
    ].map(sectionOf),
  ).toEqual([
    "/champions",
    "/champions",
    "/leaderboards",
    "/leaderboards",
    "/drafts",
    "/patches",
    "/",
  ]);
});

it("groups the navigation by task and focuses search with the slash key", () => {
  path.value = "/";
  render(<ShellHeader preferences={defaultPreferences} />);
  const nav = screen.getByRole("navigation", { name: "Primary" });
  for (const [group, names] of [
    ["Esports", ["Matches", "Past Matches", "Teams", "Players"]],
    ["Champions", ["Champions", "Tier List", "Patches", "Drafts", "Leaderboards"]],
  ] as const) {
    const list = within(nav).getByRole("list", { name: group });
    expect(
      within(list)
        .getAllByRole("link")
        .map((l) => l.textContent),
    ).toEqual(names);
    // Entries are text only; Settings keeps its icon.
    expect(list.querySelector("svg")).toBeNull();
  }
  expect(screen.queryByRole("link", { name: "Models" })).toBeNull();
  expect(screen.getByRole("link", { name: "Settings" }).querySelector("svg")).not.toBeNull();
  expect(screen.getAllByRole("link", { name: /Summoners Net/ }).length).toBeGreaterThan(0);
  const search = screen.getByRole("searchbox", { name: "Search App" });
  expect(search).toHaveAttribute("placeholder", "Search teams, players, champions and matches");
  fireEvent.keyDown(document.body, { key: "/" });
  expect(search).toHaveFocus();
  // Typing "/" in another field is left alone.
  search.blur();
  const other = document.createElement("input");
  document.body.append(other);
  other.focus();
  fireEvent.keyDown(other, { key: "/" });
  expect(other).toHaveFocus();
  other.remove();
});
