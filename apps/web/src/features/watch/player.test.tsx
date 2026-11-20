import { it, expect, vi } from "vitest";
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
  expect(screen.queryByRole("button", { name: "Player Not Working" })).toBeNull();
  expect(screen.getByRole("link", { name: "Open on YouTube" })).toHaveAttribute(
    "href",
    match.broadcasts[0]!.url,
  );
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
  const vod = { ...twitch!, externalId: "v123", url: "https://www.twitch.tv/videos/123" };
  const duplicate = { ...youtube!, url: `https://youtu.be/${youtube!.externalId}` };
  const broadcasts = [youtube!, duplicate, twitch!, vod];
  expect(watchableBroadcasts({ state: "live", broadcasts })).toEqual([youtube, twitch, vod]);
  expect(watchableBroadcasts({ state: "final", broadcasts })).toEqual([youtube, vod]);
  expect(watchableBroadcasts({ state: "final", broadcasts: [twitch!] })).toEqual([]);
});
it("identifies recordings by language and uses the video ID when languages match", () => {
  const [youtube] = match.broadcasts;
  const other = { ...youtube!, externalId: "ABCDEFGHIJK" };
  render(
    <WatchPlayer
      mode="replay"
      compact
      broadcasts={[youtube!, other, { ...youtube!, language: "ko", externalId: "zyxwvutsrqp" }]}
    />,
  );
  expect(screen.queryByRole("heading", { name: "Watch Replay" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: /\bStream\b/ }));
  expect(screen.getByRole("option", { name: "YouTube · English · abcdefghijk" })).toBeVisible();
  expect(screen.getByRole("option", { name: "YouTube · English · ABCDEFGHIJK" })).toBeVisible();
  fireEvent.click(screen.getByRole("option", { name: "YouTube · Korean" }));
  expect(screen.getByTitle("Match Broadcast")).toHaveAttribute(
    "src",
    expect.stringContaining("/zyxwvutsrqp?"),
  );
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
it("shows what the player reports, and links to Twitch when its player never loads", () => {
  vi.useFakeTimers();
  try {
    const twitch = match.broadcasts[1]!;
    const view = render(<WatchPlayer broadcasts={[twitch]} defaultProvider="twitch" />);
    const frame = screen.getByTitle<HTMLIFrameElement>("Match Broadcast");
    const post = (data: unknown, origin = "https://player.twitch.tv") =>
      act(() => {
        window.dispatchEvent(
          new MessageEvent("message", { data, origin, source: frame.contentWindow }),
        );
      });
    post({ eventName: "UPDATE_STATE", params: { playback: "Playing" } }, "https://evil.example");
    expect(screen.queryByRole("status")).toBeNull();
    post({ eventName: "UPDATE_STATE", params: { playback: "Playing", channelName: "x" } });
    expect(screen.getByRole("status")).toHaveTextContent(
      `Playing on Twitch · ${twitch.externalId}`,
    );
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    // A player that has reported is never replaced.
    expect(screen.getByTitle("Match Broadcast")).toBeInTheDocument();

    view.unmount();
    render(<WatchPlayer broadcasts={[twitch]} defaultProvider="twitch" />);
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(screen.queryByTitle("Match Broadcast")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Watch on Twitch/ })).toHaveAttribute(
      "href",
      twitch.url,
    );
  } finally {
    vi.useRealTimers();
  }
});
