import { it, expect } from "vitest";
import { act, render, screen, fireEvent } from "@testing-library/react";
import { WatchPlayer, embedUrl, watchableBroadcasts, youtubePlayerError } from "./player";
import { match } from "../../../tests/fixtures";
it("loads one paused player without a consent step, switches safely and offers a fallback", () => {
  const view = render(<WatchPlayer broadcasts={match.broadcasts} />);
  expect(screen.queryByRole("button", { name: "Load Stream" })).not.toBeInTheDocument();
  expect(document.querySelectorAll("iframe")).toHaveLength(1);
  expect(screen.getByTitle("Match Broadcast")).toHaveAttribute(
    "src",
    expect.stringContaining("youtube-nocookie.com"),
  );
  expect(screen.getByTitle("Match Broadcast")).toHaveAttribute(
    "src",
    expect.stringContaining("autoplay=0"),
  );
  fireEvent.click(screen.getByRole("button", { name: "Player Not Working" }));
  expect(screen.getByRole("heading", { name: "Stream unavailable" })).toBeVisible();
  expect(screen.getAllByRole("link", { name: /Open on YouTube/ }).length).toBeGreaterThan(0);
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  expect(document.querySelectorAll("iframe")).toHaveLength(1);
  fireEvent.click(screen.getByRole("button", { name: /Broadcast/ }));
  fireEvent.click(screen.getByRole("option", { name: /Twitch/ }));
  expect(document.querySelectorAll("iframe")).toHaveLength(1);
  expect(screen.getByTitle("Match Broadcast")).toHaveAttribute(
    "src",
    expect.stringMatching(/parent=localhost.*autoplay=false/),
  );
  view.rerender(<WatchPlayer broadcasts={[]} />);
  expect(screen.getByText("No Broadcast Supplied")).toBeVisible();
  view.rerender(<WatchPlayer broadcasts={[]} mode="replay" />);
  expect(screen.getByText("No Replay Available")).toBeVisible();
});
it("keeps only recordings for finished matches, since a Twitch channel shows what is live now", () => {
  const [youtube, twitch] = match.broadcasts;
  const vod = { ...twitch!, externalId: "v123" };
  const broadcasts = [youtube!, twitch!, vod];
  expect(watchableBroadcasts({ state: "live", broadcasts })).toEqual(broadcasts);
  expect(watchableBroadcasts({ state: "final", broadcasts })).toEqual([youtube, vod]);
  expect(watchableBroadcasts({ state: "final", broadcasts: [twitch!] })).toEqual([]);
});
it("validates embed IDs and keeps unsupported provider links accessible", () => {
  expect(embedUrl(match.broadcasts[0]!, "127.0.0.1")).toContain("origin=http%3A%2F%2F127.0.0.1");
  expect(embedUrl({ ...match.broadcasts[1]!, externalId: "v123" }, "127.0.0.1")).toContain(
    "video=v123",
  );
  expect(embedUrl({ ...match.broadcasts[0]!, externalId: "invalid" }, "localhost")).toBeNull();
  expect(embedUrl({ ...match.broadcasts[1]!, externalId: "../bad" }, "localhost")).toBeNull();
  render(<WatchPlayer broadcasts={[{ ...match.broadcasts[0]!, externalId: "" }]} />);
  expect(screen.getByText("Stream unavailable")).toBeVisible();
  expect(screen.getAllByRole("link", { name: /Open on YouTube/ }).length).toBeGreaterThan(0);
});
it("replaces a replay its channel will not embed with a link to watch it on YouTube", () => {
  expect(youtubePlayerError('{"event":"onError","info":150,"channel":"widget"}')).toBe(150);
  expect(youtubePlayerError('{"event":"onReady","info":null}')).toBeNull();
  expect(youtubePlayerError("not json")).toBeNull();
  render(<WatchPlayer broadcasts={match.broadcasts.slice(0, 1)} mode="replay" />);
  const frame = screen.getByTitle<HTMLIFrameElement>("Match Broadcast");
  const post = (origin: string, data: string) =>
    act(() => {
      window.dispatchEvent(
        new MessageEvent("message", { data, origin, source: frame.contentWindow }),
      );
    });
  post("https://evil.example", '{"event":"onError","info":150}');
  post("https://www.youtube-nocookie.com", '{"event":"onError","info":5}');
  expect(screen.getByTitle("Match Broadcast")).toBeInTheDocument();
  post("https://www.youtube-nocookie.com", '{"event":"onError","info":150}');
  expect(screen.queryByTitle("Match Broadcast")).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: /Watch on YouTube/ })).toHaveAttribute(
    "href",
    match.broadcasts[0]!.url,
  );
});
