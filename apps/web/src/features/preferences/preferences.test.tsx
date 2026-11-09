import { afterEach, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { PreferencesControl } from "./controls";
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
  render(<PreferencesControl initial={defaultPreferences} />);
  fireEvent.click(screen.getByRole("button", { name: "Preferences" }));
  const timezone = screen.getByRole("combobox", { name: "Timezone" });
  fireEvent.click(screen.getByRole("button", { name: "Show options Timezone" }));
  fireEvent.input(timezone, { target: { value: "America/Phoenix" } });
  fireEvent.click(await screen.findByRole("option", { name: "America/Phoenix" }));
  fireEvent.click(screen.getByRole("button", { name: "Save timezone" }));
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
  expect(router.refresh).toHaveBeenCalledOnce();
  fetcher.mockResolvedValue(new Response("{}", { status: 500 }));
  fireEvent.click(screen.getByRole("switch", { name: "Hide results" }));
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
  render(
    <PreferencesControl autoDetectTimezone initial={{ timezone: fallback, hideSpoilers: false }} />,
  );
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
  expect(router.refresh).not.toHaveBeenCalled();
});
