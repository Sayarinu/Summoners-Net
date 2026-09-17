import { it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { WatchPlayer, embedUrl } from "./player";
import { match } from "../../../tests/fixtures";
it("loads exactly one player after consent, switches safely, unloads and offers a fallback", () => {
  const view = render(<WatchPlayer broadcasts={match.broadcasts} />);
  expect(document.querySelector("iframe")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Load Stream" }));
  expect(document.querySelectorAll("iframe")).toHaveLength(1);
  expect(screen.getByTitle("Match broadcast")).toHaveAttribute(
    "src",
    expect.stringContaining("youtube-nocookie.com"),
  );
  fireEvent.click(screen.getByRole("button", { name: "Player not working" }));
  expect(screen.getByRole("heading", { name: "Stream unavailable" })).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  expect(document.querySelectorAll("iframe")).toHaveLength(1);
  fireEvent.click(screen.getByRole("button", { name: "Player not working" }));
  expect(document.querySelector("iframe")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Unload player" }));
  expect(screen.getByRole("button", { name: "Load Stream" })).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: /Broadcast/ }));
  fireEvent.click(screen.getByRole("option", { name: /twitch/ }));
  expect(document.querySelector("iframe")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Load Stream" }));
  expect(screen.getByTitle("Match broadcast")).toHaveAttribute(
    "src",
    expect.stringContaining("parent=localhost"),
  );
  view.rerender(<WatchPlayer broadcasts={[]} />);
  expect(screen.getByText("No broadcast supplied")).toBeVisible();
});
it("validates embed IDs and keeps unsupported provider links accessible", () => {
  expect(embedUrl({ ...match.broadcasts[1]!, externalId: "v123" }, "127.0.0.1")).toContain(
    "video=v123",
  );
  expect(embedUrl({ ...match.broadcasts[0]!, externalId: "invalid" }, "localhost")).toBeNull();
  expect(embedUrl({ ...match.broadcasts[1]!, externalId: "../bad" }, "localhost")).toBeNull();
  render(<WatchPlayer broadcasts={[{ ...match.broadcasts[0]!, externalId: "" }]} />);
  fireEvent.click(screen.getByRole("button", { name: "Load Stream" }));
  expect(screen.getByText("Stream unavailable")).toBeVisible();
  expect(screen.getAllByRole("link", { name: /Open on youtube/ }).length).toBeGreaterThan(0);
});
