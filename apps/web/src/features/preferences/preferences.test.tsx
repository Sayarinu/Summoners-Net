import { afterEach, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { PreferencesControl } from "./controls";
import { parsePreferences, defaultPreferences } from "./model";
afterEach(() => vi.unstubAllGlobals());
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
  fireEvent.click(screen.getByText("Preferences · UTC"));
  fireEvent.change(screen.getByLabelText("Timezone"), {
    target: { value: "invalid" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save timezone" }));
  expect(screen.getByText(/Enter a valid IANA/)).toBeVisible();
  expect(fetcher).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("Timezone"), {
    target: { value: "America/Phoenix" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save timezone" }));
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
  fetcher.mockResolvedValue(new Response("{}", { status: 500 }));
  fireEvent.click(screen.getByRole("switch", { name: "Hide results" }));
  await screen.findByText("Preferences could not be saved. Try again.");
  expect(fetcher).toHaveBeenLastCalledWith(
    "/api/preferences",
    expect.objectContaining({
      body: JSON.stringify({
        timezone: "America/Phoenix",
        hideSpoilers: false,
      }),
    }),
  );
  error.mockRestore();
});
