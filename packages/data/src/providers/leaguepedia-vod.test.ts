import { describe, expect, it } from "vitest";
import { gameReplayUrl, offsetSeconds, recordingAt } from "../domain/broadcasts.js";
import { leaguepediaVodsUrl, parseLeaguepediaVods } from "./leaguepedia-vod.js";
import reply from "../../tests/leaguepedia/vods.json" with { type: "json" };

describe("game recordings", () => {
  it("reads start offsets in seconds or hours, minutes and seconds", () => {
    expect(offsetSeconds("540")).toBe(540);
    expect(offsetSeconds("540s")).toBe(540);
    expect(offsetSeconds("1h2m3s")).toBe(3723);
    expect(offsetSeconds("9m")).toBe(540);
    for (const value of [null, undefined, "", "abc", "-5", "1d"])
      expect(offsetSeconds(value)).toBeNull();
  });

  it("keeps only https YouTube and Twitch videos, rebuilt with their start offset", () => {
    expect(recordingAt("https://youtu.be/c5ZgeZ0QdDI?t=540")).toBe(
      "https://www.youtube.com/watch?v=c5ZgeZ0QdDI&t=540s",
    );
    expect(recordingAt("https://www.youtube.com/watch?v=c5ZgeZ0QdDI&list=x&t=9m")).toBe(
      "https://www.youtube.com/watch?v=c5ZgeZ0QdDI&t=540s",
    );
    expect(recordingAt("https://youtu.be/c5ZgeZ0QdDI")).toBe(
      "https://www.youtube.com/watch?v=c5ZgeZ0QdDI",
    );
    expect(recordingAt("https://www.twitch.tv/videos/2345678901?t=3723s")).toBe(
      "https://www.twitch.tv/videos/2345678901?t=1h2m3s",
    );
    expect(recordingAt("https://twitch.tv/videos/2345678901")).toBe(
      "https://www.twitch.tv/videos/2345678901",
    );
    for (const value of [
      null,
      "",
      "not a link",
      "http://youtu.be/c5ZgeZ0QdDI",
      "https://www.youtube.com/embed/c5ZgeZ0QdDI",
      "https://www.youtube.com/live/c5ZgeZ0QdDI",
      "https://www.twitch.tv/examplechannel",
      "https://vods.example.com/c5ZgeZ0QdDI",
      "https://user:pass@youtu.be/c5ZgeZ0QdDI",
    ])
      expect(recordingAt(value)).toBeNull();
  });

  it("prefers the archive game's recording over the provider's and the series broadcast", () => {
    const match = {
      state: "final" as const,
      bestOf: 1 as const,
      broadcasts: [
        {
          provider: "youtube" as const,
          externalId: "abcdefghijk",
          url: "https://www.youtube.com/watch?v=abcdefghijk",
          language: "en",
        },
      ],
    };
    const archive = "https://www.youtube.com/watch?v=c5ZgeZ0QdDI&t=540s";
    const provider = "https://www.twitch.tv/videos/123";
    const game = { state: "finished", vodUrl: provider, gameVodUrl: archive };
    expect(gameReplayUrl(match, game)).toBe(archive);
    expect(gameReplayUrl(match, { ...game, gameVodUrl: null })).toBe(provider);
    expect(gameReplayUrl(match, { state: "finished" })).toBe(match.broadcasts[0]!.url);
    expect(gameReplayUrl(match, { ...game, state: "running" })).toBeNull();
  });
});

describe("Leaguepedia game recordings", () => {
  it("asks for up to 50 validated Riot game IDs in one Cargo query under maxlag", () => {
    const url = new URL(leaguepediaVodsUrl(["LOLTMNT02_487405", "ESPORTSTMNT01_100001"]));
    expect(url.origin + url.pathname).toBe("https://lol.fandom.com/api.php");
    expect(url.searchParams.get("action")).toBe("cargoquery");
    expect(url.searchParams.get("tables")).toBe("MatchScheduleGame");
    expect(url.searchParams.get("where")).toBe(
      "RiotPlatformGameId IN ('LOLTMNT02_487405','ESPORTSTMNT01_100001')",
    );
    expect(url.searchParams.get("maxlag")).toBe("5");
    const fifty = Array.from({ length: 50 }, (_, n) => `LOLTMNT02_${n + 1}`);
    expect(() => leaguepediaVodsUrl(fifty)).not.toThrow();
    expect(() => leaguepediaVodsUrl([...fifty, "LOLTMNT02_51"])).toThrow();
    expect(() => leaguepediaVodsUrl([])).toThrow();
    expect(() => leaguepediaVodsUrl(["LOLTMNT02_1') OR ('1'='1"])).toThrow();
  });

  it("keeps each requested game's usable links and reports games without any as null", () => {
    const ids = [
      "LOLTMNT02_487405",
      "LOLTMNT02_487406",
      "LOLTMNT02_487408",
      "ESPORTSTMNT01_100001",
      "ESPORTSTMNT01_100002",
      "LOLTMNT02_999999",
    ];
    const parsed = parseLeaguepediaVods(reply, ids);
    expect(parsed.state).toBe("rows");
    if (parsed.state !== "rows") return;
    expect([...parsed.vods.keys()]).toEqual(ids);
    expect(parsed.vods.get("LOLTMNT02_487405")).toEqual({
      leaguepediaGameId: "2026 Season World Championship/Main Event_Finals_1_1",
      gameStartUrl: "https://www.youtube.com/watch?v=c5ZgeZ0QdDI&t=540s",
      draftStartUrl: "https://www.youtube.com/watch?v=c5ZgeZ0QdDI",
      vodUrl: null,
    });
    expect(parsed.vods.get("LOLTMNT02_487406")?.draftStartUrl).toBe(
      "https://www.youtube.com/watch?v=c5ZgeZ0QdDI&t=2881s",
    );
    // An insecure game-start link and a live channel are dropped; the Twitch video stays.
    expect(parsed.vods.get("ESPORTSTMNT01_100001")).toEqual({
      leaguepediaGameId: "Example League/Week 1_1_1",
      gameStartUrl: null,
      draftStartUrl: null,
      vodUrl: "https://www.twitch.tv/videos/2345678901?t=1h2m3s",
    });
    for (const id of ["LOLTMNT02_487408", "ESPORTSTMNT01_100002", "LOLTMNT02_999999"])
      expect(parsed.vods.get(id)).toBeNull();
  });

  it("reports wiki lag, and rejects refusals and malformed replies", () => {
    const ids = ["LOLTMNT02_487405"];
    expect(parseLeaguepediaVods({ error: { code: "maxlag", info: "lag" } }, ids)).toEqual({
      state: "lagged",
    });
    expect(() => parseLeaguepediaVods({ error: { code: "badquery" } }, ids)).toThrow(
      "Leaguepedia refused the request.",
    );
    expect(() => parseLeaguepediaVods({ cargoquery: [{ title: { Vod: 5 } }] }, ids)).toThrow();
    expect(() => parseLeaguepediaVods({ query: {} }, ids)).toThrow();
  });
});
