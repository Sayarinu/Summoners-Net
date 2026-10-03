import { it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ShellHeader, ShellFooter } from "./shell";
import { defaultPreferences } from "../preferences/model";
const path = vi.hoisted(() => ({ value: "/matches/1" }));
const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({
  usePathname: () => path.value,
  useRouter: () => router,
}));
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
  fireEvent.click(screen.getByRole("link", { name: "Players" }));
  expect(router.push).toHaveBeenCalledWith("/players");
});

it("opens and closes the mobile navigation overlay", () => {
  render(<ShellHeader preferences={defaultPreferences} />);
  fireEvent.click(screen.getByRole("button", { name: "Open navigation" }));
  expect(screen.getAllByRole("button", { name: "Close navigation" })).toHaveLength(2);
  fireEvent.click(screen.getAllByRole("button", { name: "Close navigation" })[0]!);
  expect(screen.getByRole("button", { name: "Open navigation" })).toHaveAttribute(
    "aria-expanded",
    "false",
  );
});
