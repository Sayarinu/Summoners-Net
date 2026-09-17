import { it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ShellHeader, ShellFooter } from "./shell";
import { defaultPreferences } from "../preferences/model";
const path = vi.hoisted(() => ({ value: "/matches/1" }));
vi.mock("next/navigation", () => ({ usePathname: () => path.value }));
it("keeps route navigation, skip link and local controls available", () => {
  const view = render(
    <>
      <ShellHeader preferences={defaultPreferences} />
      <ShellFooter />
    </>,
  );
  expect(screen.getByRole("link", { name: "Matches" })).toHaveAttribute("aria-current", "page");
  expect(screen.getByRole("link", { name: "Skip to main content" })).toHaveAttribute(
    "href",
    "#main-content",
  );
  path.value = "/games/1";
  view.rerender(<ShellHeader preferences={defaultPreferences} />);
  expect(screen.getByRole("link", { name: "History" })).toHaveAttribute("aria-current", "page");
  path.value = "/search";
  view.rerender(<ShellHeader preferences={defaultPreferences} />);
  expect(screen.getByRole("link", { name: "Search" })).toHaveAttribute("aria-current", "page");
});
