import { it, expect } from "vitest";
import { render, screen, fireEvent, within, waitFor } from "@testing-library/react";
import { MatchPage, GamePage, ProfilePage, SeriesGamePage } from "./pages";
import { match, game, profile, blue, instant, page, seriesGames } from "../../../tests/fixtures";
it("keeps a finished replay collapsed and unloads it on close", async () => {
  const view = render(
    <MatchPage match={match} games={seriesGames()} timezone="UTC" hideSpoilers now={instant} />,
  );
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
    "Acceptance Blue vs Acceptance Red",
  );
  expect(screen.getByRole("link", { name: "Open Game 1" })).toHaveAttribute(
    "href",
    "/matches/pandascore%3Amatch%3A1/games/1",
  );
  const replay = screen.getByText("Watch Replay", { selector: "summary" });
  expect(screen.queryByTitle("Match Broadcast")).toBeNull();
  fireEvent.click(replay);
  expect(await screen.findByTitle("Match Broadcast")).toHaveAttribute(
    "src",
    expect.stringMatching(/youtube-nocookie\.com.*autoplay=0/),
  );
  expect(screen.queryByRole("button", { name: /Broadcast/ })).toBeNull();
  fireEvent.click(replay);
  await waitFor(() => expect(screen.queryByTitle("Match Broadcast")).toBeNull());
  expect(screen.queryByRole("columnheader", { name: "Status" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: /Reveal score/ }));
  expect(screen.getByRole("img", { name: /Series score/ })).toHaveTextContent("2 – 1");
  expect(screen.queryByText("Hidden")).toBeNull();
  view.rerender(
    <MatchPage
      games={seriesGames()}
      match={{ ...match, teams: [], games: [] }}
      timezone="UTC"
      hideSpoilers={false}
      now={instant}
    />,
  );
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(match.name);
  view.rerender(
    <MatchPage
      games={seriesGames()}
      match={{ ...match, broadcasts: match.broadcasts.slice(1) }}
      timezone="UTC"
      hideSpoilers={false}
      now={instant}
    />,
  );
  // Only a live Twitch channel is stored, which would show an unrelated broadcast.
  expect(screen.queryByText("Watch Replay")).toBeNull();
  expect(document.querySelector("iframe")).toBeNull();
  view.rerender(
    <MatchPage
      games={seriesGames()}
      match={{ ...match, state: "scheduled", games: [] }}
      timezone="UTC"
      hideSpoilers={false}
      now={instant}
    />,
  );
  expect(screen.queryByRole("heading", { name: "Watch" })).toBeNull();
});
it("shows played lineups with null statistics and explicit partial eligibility", () => {
  const view = render(<GamePage game={game} timezone="UTC" hideSpoilers />);
  expect(screen.getAllByText("Hidden")).toHaveLength(4);
  expect(screen.queryByText("Winner")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Reveal Game Statistics" }));
  expect(screen.getByText("5 / 2 / 7")).toBeVisible();
  expect(screen.getByText("— / — / —")).toBeVisible();
  expect(screen.getByText("Winner")).toBeVisible();
  expect(screen.getByText("Blue Side")).toBeVisible();
  expect(screen.getByText("Red Side")).toBeVisible();
  expect(screen.queryByRole("columnheader", { name: "Result" })).toBeNull();
  expect(screen.queryByRole("columnheader", { name: "Team" })).toBeNull();
  expect(screen.getByRole("table", { name: "Acceptance Blue Lineup" })).toBeVisible();
  view.rerender(
    <GamePage
      game={{
        ...game,
        complete: false,
        patch: null,
        matchId: "match",
        participants: [
          { ...game.participants[0]!, won: false },
          { ...game.participants[1]!, player: null },
        ],
      }}
      timezone="UTC"
      hideSpoilers={false}
    />,
  );
  expect(screen.getByText(/Partial Record/)).toBeVisible();
  expect(screen.queryByText("Winner")).toBeNull();
});
it("separates roster observations, filtered game pages and full-sample summaries", () => {
  const view = render(<ProfilePage profile={profile} query={{ timezone: "UTC" }} hideSpoilers />);
  expect(screen.getByRole("table", { name: "Current Roster" })).toBeVisible();
  expect(screen.queryByText("100.0%")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Reveal Summary Statistics" }));
  expect(screen.getByText("100.0%")).toBeVisible();
  expect(screen.getByText("6.00")).toBeVisible();
  expect(screen.getByText("Champion Usage")).toBeVisible();
  view.rerender(
    <ProfilePage
      profile={{
        ...profile,
        identity: blue,
        roster: [],
        games: page([]),
        summary: {
          ...profile.summary,
          winRate: null,
          kda: null,
          champions: [],
        },
      }}
      query={{}}
      hideSpoilers={false}
    />,
  );
  expect(screen.getByText("No Current Roster")).toBeVisible();
  expect(screen.getAllByText("—")).toHaveLength(2);
});
it("keeps canonical destinations and portraits while omitting alternate names", () => {
  const image = "/api/images/" + "a".repeat(64);
  const identity = {
    ...profile.identity,
    imageUrl: image,
    imageSource: "PandaScore",
    entityId: "canonical",
    sourceCount: 2,
  };
  const linked = {
    ...profile,
    identity,
    sources: [profile.identity],
    aliases: ["Old handle", identity.name],
    resolution: [{ gameId: game.id, playedAt: instant, observedAt: instant, matchedPlayers: 3 }],
    roster: profile.roster.map((r) => ({
      ...r,
      player: { ...r.player, imageUrl: image },
      team: { ...r.team, imageUrl: image },
    })),
  };
  const view = render(<ProfilePage profile={linked} query={{}} hideSpoilers={false} />);
  expect(
    screen.getAllByRole("img", { name: `${identity.name} portrait` })[0]!.querySelector("img"),
  ).toHaveAttribute("src", image);
  expect(screen.queryByText("Identity Details")).toBeNull();
  expect(screen.queryByText(/Old handle/)).toBeNull();
  view.rerender(
    <GamePage
      game={{
        ...game,
        participants: game.participants.map((p) => ({
          ...p,
          team: { ...p.team, imageUrl: image, entityId: "canonical-team" },
          player: p.player ? { ...p.player, imageUrl: image, entityId: "canonical-player" } : null,
        })),
      }}
      timezone="UTC"
      hideSpoilers={false}
    />,
  );
  expect(screen.getAllByRole("img").length).toBeGreaterThan(1);
  expect(screen.queryByRole("img", { name: /portrait/ })).toBeNull();
  expect(screen.getByRole("link", { name: new RegExp(profile.identity.name) })).toHaveAttribute(
    "href",
    "/players/player-blue-mid",
  );
  view.rerender(
    <MatchPage
      games={seriesGames()}
      match={{ ...match, teams: match.teams.map((t) => ({ ...t, imageUrl: image })) }}
      timezone="UTC"
      now={instant}
      hideSpoilers={false}
    />,
  );
  expect(screen.getAllByRole("img").length).toBeGreaterThan(1);
});

it("shows a coarse checkpoint win probability when opened after revealing statistics", async () => {
  const winProbability = {
    model: { id: 2, modelVersion: 1, brier: 0.2, years: ["2025", "2026"] },
    reason: null,
    points: [
      { minute: 10, blueWinProbability: 0.55 },
      { minute: 15, blueWinProbability: 0.6 },
      { minute: 20, blueWinProbability: null },
      { minute: 25, blueWinProbability: 0.8 },
    ],
  };
  const view = render(
    <GamePage game={game} timezone="UTC" hideSpoilers winProbability={winProbability} />,
  );
  expect(screen.queryByText("Win Probability (Coarse, 4 Checkpoints)")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Reveal Game Statistics" }));
  expect(
    screen.queryByRole("heading", { name: "Win Probability (Coarse, 4 Checkpoints)" }),
  ).toBeNull();
  fireEvent.click(screen.getByText("Win Probability", { selector: "summary" }));
  expect(
    await screen.findByRole("heading", { name: "Win Probability (Coarse, 4 Checkpoints)" }),
  ).toBeVisible();
  expect(screen.getByRole("link", { name: "Model Diagnostics" })).toHaveAttribute(
    "href",
    "/models?model=2",
  );
  for (const unavailable of [
    { model: null, reason: "No pro win probability model is active yet.", points: [] },
    { ...winProbability, points: [{ minute: 10, blueWinProbability: null }] },
  ]) {
    view.rerender(
      <GamePage game={game} timezone="UTC" hideSpoilers={false} winProbability={unavailable} />,
    );
    expect(screen.queryByText("Win Probability", { selector: "summary" })).toBeNull();
  }
});

it("moves between a series overview and its played games with spoilers kept", () => {
  const games = seriesGames();
  const view = render(
    <MatchPage match={match} games={games} timezone="UTC" hideSpoilers now={instant} />,
  );
  const tabs = screen.getByRole("navigation", { name: "Series" });
  expect(within(tabs).getByRole("link", { name: "Overview" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  expect(within(tabs).getByRole("link", { name: "Game 2" })).toHaveAttribute(
    "href",
    "/matches/pandascore%3Amatch%3A1/games/2",
  );
  // An unplayed game is listed but cannot be opened.
  expect(within(tabs).queryByRole("link", { name: "Game 3" })).toBeNull();
  expect(within(tabs).getByText("Game 3")).toHaveAttribute("aria-disabled", "true");
  expect(screen.getAllByText("Result hidden")).toHaveLength(3);
  expect(screen.getByText(/^31:05 · /)).toBeVisible();
  expect(screen.getByText(/^0:00 · /)).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: /Reveal score/ }));
  expect(screen.queryByText("Result hidden")).toBeNull();
  expect(screen.getByRole("link", { name: "Open Game 1" })).toHaveTextContent("Acceptance Blue");
  expect(screen.getByRole("link", { name: "Open Game 2" })).toHaveTextContent("Acceptance Red");
  view.rerender(
    <MatchPage match={match} games={[]} timezone="UTC" hideSpoilers={false} now={instant} />,
  );
  expect(screen.getByText("No Games Reported Yet")).toBeVisible();
  expect(screen.getByRole("link", { name: "Past Matches" })).toHaveAttribute("href", "/history");
});

it("shows the chronological draft above the lineups after spoilers are revealed", async () => {
  const vodUrl = "https://www.youtube.com/watch?v=abcdefghijk";
  const games = seriesGames().map((item) => (item.number === 1 ? { ...item, vodUrl } : item));
  const detail = {
    id: "oracle:archive:a",
    year: 2026,
    sourceLeague: "LCK",
    competition: "LCK" as const,
    sourceGameId: "acceptance-game",
    occurredAt: instant,
    patch: "16.4",
    complete: true,
    summaryEligible: true,
    teams: [
      { name: "Acceptance Blue", side: "blue" as const, won: true },
      { name: "Acceptance Red", side: "red" as const, won: false },
    ],
    context: {
      sourceYear: 2026,
      sourceUrl: null,
      split: null,
      week: null,
      playoffs: null,
      gameNumber: "1",
      durationSeconds: 1865,
    },
    draft: [
      { side: "blue" as const, firstPick: true, picks: ["Ahri", null], bans: [] },
      { side: "red" as const, firstPick: false, picks: [null], bans: ["Azir"] },
    ],
    draftOrder: [
      {
        phase: 1,
        action: "ban" as const,
        slot: 1,
        side: "red" as const,
        champion: "Azir",
        role: null,
        blind: null,
      },
      {
        phase: 1,
        action: "pick" as const,
        slot: 1,
        side: "blue" as const,
        champion: "Ahri",
        role: "mid",
        blind: true,
      },
    ],
    participants: [],
  };
  const view = render(
    <SeriesGamePage
      match={{ ...match, name: `Grand final: ${match.name}`, event: "2026 · Playoffs" }}
      games={games}
      number={1}
      game={game}
      detail={detail}
      winProbability={null}
      timezone="UTC"
      hideSpoilers
      now={instant}
    />,
  );
  expect(
    within(screen.getByRole("navigation", { name: "Series" })).getByRole("link", {
      name: "Game 1",
    }),
  ).toHaveAttribute("aria-current", "page");
  const tabs = screen.getByRole("navigation", { name: "Series" });
  expect(within(tabs).getByRole("link", { name: "Overview" })).toHaveAttribute(
    "href",
    "/matches/pandascore%3Amatch%3A1",
  );
  expect(within(tabs).getByRole("link", { name: "Game 2" })).toBeVisible();
  expect(screen.queryByText("31:05")).toBeNull();
  expect(screen.queryByText(/^Patch/)).toBeNull();
  expect(screen.getByText(/2026 · Playoffs · Grand Final ·/)).toBeVisible();
  expect(
    within(screen.getByRole("heading", { level: 1 }).closest("header")!).getByRole("link", {
      name: "Watch Game VOD",
    }),
  ).toHaveAttribute("href", vodUrl);
  expect(screen.queryByText("Draft Order")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Reveal Game Statistics" }));
  const draft = screen.getByText("Draft Order", { selector: "summary" });
  expect(tabs.nextElementSibling).toBe(draft.parentElement);
  const bans = await screen.findByRole("region", { name: "Bans 1–6" });
  expect(within(bans).getByRole("listitem")).toHaveAttribute("data-side", "red");
  expect(within(bans).getByRole("img", { name: "Azir" })).toBeVisible();
  expect(
    within(screen.getByRole("region", { name: "Picks 1–6" })).getByRole("img", { name: "Ahri" }),
  ).toBeVisible();
  expect(screen.getByRole("table", { name: "Acceptance Blue Lineup" })).toBeVisible();
  expect(screen.getAllByText("Winner")).toHaveLength(1);
  expect(screen.queryByRole("link", { name: "Open Archive Record" })).toBeNull();
  fireEvent.click(draft);
  await waitFor(() => expect(screen.queryByRole("region", { name: "Bans 1–6" })).toBeNull());
  fireEvent.click(draft);
  expect(await screen.findByRole("region", { name: "Bans 1–6" })).toBeVisible();
  view.rerender(
    <SeriesGamePage
      match={{ ...match, event: "2026 · Playoffs" }}
      games={games}
      number={2}
      game={null}
      detail={null}
      winProbability={null}
      timezone="UTC"
      hideSpoilers={false}
      now={instant}
    />,
  );
  expect(screen.getByText("Game Details Not Available Yet")).toBeVisible();
  expect(screen.getByText(/2026 · Playoffs · \d/)).toBeVisible();
  expect(screen.queryByText(/Grand Final/)).toBeNull();
  expect(screen.queryByRole("link", { name: "Watch Game VOD" })).toBeNull();
  expect(
    within(screen.getByRole("navigation", { name: "Series" })).getByRole("link", {
      name: "Game 1",
    }),
  ).toBeVisible();
  expect(screen.queryByText(/^Patch/)).toBeNull();
});

it("links an archive game back to its confirmed series", () => {
  const view = render(
    <GamePage
      game={game}
      timezone="UTC"
      hideSpoilers={false}
      series={{ matchId: match.id, number: 1 }}
    />,
  );
  expect(screen.getByRole("link", { name: "Open in Series" })).toHaveAttribute(
    "href",
    "/matches/pandascore%3Amatch%3A1/games/1",
  );
  view.rerender(<GamePage game={game} timezone="UTC" hideSpoilers={false} />);
  expect(screen.queryByRole("link", { name: "Open in Series" })).toBeNull();
});
