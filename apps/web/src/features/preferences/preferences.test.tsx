import { afterEach, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { SettingsPage, TimezoneDetector } from "./controls";
import { browserTimezone, parsePreferences, defaultPreferences } from "./model";
const router = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  window.sessionStorage.clear();
  delete (window as Window & { __summonersNetDetectedTimezone?: string })
    .__summonersNetDetectedTimezone;
});
it("validates saved preferences and defaults safely on malformed cookies", () => {
  expect(parsePreferences()).toEqual(defaultPreferences);
  expect(parsePreferences("bad")).toEqual(defaultPreferences);
  expect(parsePreferences('{"timezone":"bad","hideSpoilers":false}')).toEqual(defaultPreferences);
  expect(parsePreferences('{"timezone":"America/Phoenix","hideSpoilers":false}')).toEqual({
    timezone: "America/Phoenix",
    hideSpoilers: false,
  });
});
it("saves timezone and spoiler preferences with accessible validation", async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
  vi.stubGlobal("fetch", fetcher);
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  render(<SettingsPage initial={defaultPreferences} />);
  expect(screen.getByRole("heading", { name: "Settings", level: 1 })).toBeVisible();
  expect(screen.getByRole("switch", { name: "Hide Results" })).not.toBeChecked();
  const timezone = screen.getByRole("combobox", { name: "Timezone" });
  act(() => timezone.focus());
  fireEvent.input(timezone, { target: { value: "America/Phoenix" } });
  fireEvent.click(await screen.findByRole("option", { name: "America/Phoenix" }));
  fireEvent.click(screen.getByRole("button", { name: "Save Timezone" }));
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
  expect(router.refresh).toHaveBeenCalledOnce();
  expect(await screen.findByText("Timezone saved.")).toBeVisible();
  fetcher.mockResolvedValue(new Response("{}", { status: 500 }));
  fireEvent.click(screen.getByRole("switch", { name: "Hide Results" }));
  await screen.findByText("Preferences could not be saved. Try again.");
  expect(fetcher).toHaveBeenLastCalledWith(
    "/api/preferences",
    expect.objectContaining({
      body: JSON.stringify({
        timezone: "America/Phoenix",
        hideSpoilers: true,
      }),
    }),
  );
  error.mockRestore();
});
it("stores an automatically detected timezone without refreshing the active route", async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
  vi.stubGlobal("fetch", fetcher);
  const detected = browserTimezone();
  const fallback = detected === "UTC" ? "America/Phoenix" : "UTC";
  render(<TimezoneDetector initial={{ timezone: fallback, hideSpoilers: false }} />);
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
  expect(router.refresh).not.toHaveBeenCalled();
});
