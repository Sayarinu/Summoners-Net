import { describe, expect, it } from "vitest";
import { playbackLabel, playerPlayback } from "./playback";

const youtube = "https://www.youtube-nocookie.com";
const twitch = "https://player.twitch.tv";

describe("playerPlayback", () => {
  it("reads YouTube's ready, state-change and info messages", () => {
    expect(playerPlayback("youtube", youtube, '{"event":"onReady","id":1}')).toBe("ready");
    expect(playerPlayback("youtube", youtube, '{"event":"onStateChange","info":1}')).toBe(
      "playing",
    );
    expect(
      playerPlayback("youtube", youtube, {
        event: "infoDelivery",
        info: { playerState: 2, currentTime: 31 },
      }),
    ).toBe("paused");
    expect(
      playerPlayback("youtube", youtube, '{"event":"infoDelivery","info":{"volume":50}}'),
    ).toBe(null);
    expect(playerPlayback("youtube", youtube, '{"event":"onStateChange","info":9}')).toBeNull();
  });

  it("reads the Twitch player's state updates and named events", () => {
    const state = (playback: string) => ({
      eventName: "UPDATE_STATE",
      params: { channelName: "riotgames", playback, currentTime: 0 },
    });
    expect(playerPlayback("twitch", twitch, state("Idle"))).toBe("ready");
    expect(playerPlayback("twitch", twitch, state("Playing"))).toBe("playing");
    expect(playerPlayback("twitch", twitch, state("Buffering"))).toBe("buffering");
    expect(
      playerPlayback("twitch", twitch, {
        eventName: "offline",
        params: {},
        namespace: "twitch-embed",
      }),
    ).toBe("offline");
    expect(
      playerPlayback("twitch", twitch, {
        eventName: "seek",
        params: {},
        namespace: "twitch-embed",
      }),
    ).toBeNull();
  });

  it("ignores other origins, other providers' messages and malformed data", () => {
    expect(
      playerPlayback("twitch", "https://evil.example", {
        eventName: "playing",
        namespace: "twitch-embed",
      }),
    ).toBeNull();
    expect(playerPlayback("youtube", twitch, '{"event":"onReady"}')).toBeNull();
    expect(playerPlayback("twitch", twitch, '{"event":"onReady"}')).toBeNull();
    expect(playerPlayback("youtube", youtube, "not json")).toBeNull();
  });

  it("names the state for the status line", () => {
    expect(playbackLabel("playing", "Twitch")).toBe("Playing on Twitch");
    expect(playbackLabel("offline", "Twitch")).toBe("Channel offline on Twitch");
  });
});
