import { afterEach, beforeEach, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within, waitFor } from "@testing-library/react";
import { MatchPage, GamePage, ProfilePage, SeriesGamePage } from "./pages";
import { match, game, profile, blue, instant, page, seriesGames } from "../../../tests/fixtures";
beforeEach(() => {
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
});
afterEach(() => vi.unstubAllGlobals());

it("keeps a finished replay collapsed and unloads it on close", async () => {
  const view = render(
    <MatchPage
      match={{ ...match, teams: match.teams.map((team) => ({ ...team, imageUrl: "/team.png" })) }}
      games={seriesGames()}
      timezone="UTC"
      hideSpoilers
      now={instant}
    />,
  );
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
    "Acceptance Blue vs Acceptance Red",
  );
  expect(screen.getByRole("link", { name: "Open Game 1" })).toHaveAttribute(
    "href",
    "/matches/1/games/1",
  );
  const replay = screen.getByText("Replay", { selector: "summary" });
  expect(screen.queryByTitle("Match Broadcast")).toBeNull();
  fireEvent.click(replay);
  expect(await screen.findByTitle("Match Broadcast")).toHaveAttribute(
    "src",
    expect.stringMatching(/youtube-nocookie\.com.*autoplay=0/),
  );
  expect(screen.queryByRole("button", { name: /Stream/ })).toBeNull();
  fireEvent.click(replay);
  await waitFor(() => expect(screen.queryByTitle("Match Broadcast")).toBeNull());
  expect(screen.queryByRole("columnheader", { name: "Status" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: /Reveal score/ }));
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
    "Acceptance Blue 2 vs 1 Acceptance Red",
  );
  const matchup = within(screen.getByRole("heading", { level: 1 }));
  const blueLink = matchup.getByRole("link", { name: "Acceptance Blue" });
  const redLink = matchup.getByRole("link", { name: "Acceptance Red" });
  expect(blueLink.children[0]).toHaveTextContent("Acceptance Blue");
  expect(blueLink.children[1]).toHaveClass("np-avatar");
  expect(redLink.children[0]).toHaveClass("np-avatar");
  expect(redLink.children[1]).toHaveTextContent("Acceptance Red");
  expect(blueLink).toHaveAttribute("href", "/teams/acceptance-blue");
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
  expect(screen.queryByText("Replay")).toBeNull();
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

it("shows both sides of zero for the recorded probabilities after reveal", async () => {
  const winProbability = {
    model: { id: 2, modelVersion: 1, brier: 0.2, years: ["2025", "2026"] },
    reason: null,
    points: [
      { minute: 10, blueWinProbability: 0.55 },
      { minute: 15, blueWinProbability: 0.4 },
      { minute: 20, blueWinProbability: null },
      { minute: 25, blueWinProbability: 0.5 },
    ],
  };
  const view = render(
    <GamePage game={game} timezone="UTC" hideSpoilers winProbability={winProbability} />,
  );
  expect(screen.queryByText("Win Probability")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Reveal Game Statistics" }));
  expect(screen.queryByRole("group", { name: /^Win Probability by Minute/ })).toBeNull();
  fireEvent.click(screen.getByText("Win Probability", { selector: "summary" }));
  const chart = await screen.findByRole("group", { name: /^Win Probability by Minute/ });
  expect(within(chart).getByText("0", { exact: true })).toBeVisible();
  expect(
    within(chart).getByText("10 minutes: Blue Side 55%, Red Side 45%").closest("li"),
  ).toHaveAttribute("data-side", "blue");
  expect(
    within(chart).getByText("15 minutes: Blue Side 40%, Red Side 60%").closest("li"),
  ).toHaveAttribute("data-side", "red");
  expect(
    within(chart).getByText("20 minutes: win probability unavailable").closest("li"),
  ).not.toHaveAttribute("data-side");
  expect(
    within(chart).getByText("25 minutes: Blue Side 50%, Red Side 50%").closest("li"),
  ).not.toHaveAttribute("data-side");
  expect(screen.queryByRole("link", { name: "Model Diagnostics" })).toBeNull();
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
    "/matches/1/games/2",
  );
  // An unplayed game is listed but cannot be opened.
  expect(within(tabs).queryByRole("link", { name: "Game 3" })).toBeNull();
  expect(within(tabs).getByText("Game 3")).toHaveAttribute("aria-disabled", "true");
  expect(screen.getAllByText("Result hidden")).toHaveLength(2);
  expect(screen.getByText("31:05")).toBeVisible();
  expect(screen.getByText("0:00")).toBeVisible();
  expect(within(tabs).getByText("Mar 1, 2026")).toBeVisible();
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

it("shows the draft by side, team totals and the score through the selected game after reveal", async () => {
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
      { side: "blue" as const, firstPick: false, picks: ["Ahri", null], bans: [] },
      { side: "red" as const, firstPick: true, picks: ["Orianna"], bans: ["Azir"] },
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
        slot: 2,
        side: "blue" as const,
        champion: "Ahri",
        role: "mid",
        blind: true,
      },
    ],
    participants: [
      {
        slot: "blue:team",
        side: "blue" as const,
        position: "team",
        player: null,
        team: { name: "Acceptance Blue", sourceId: "10" },
        champion: null,
        won: true,
        statistics: {
          combat: { kills: 14 },
          objectives: {
            towers: 7,
            dragons: 3,
            barons: 0,
            void_grubs: 3,
            heralds: 1,
            elementaldrakes: 2,
            elders: 1,
            infernals: 2,
          },
          damage: {},
          vision: {},
          economy: { totalgold: 56005 },
          checkpoints: {},
        },
      },
      {
        slot: game.participants[0]!.slot,
        side: "blue" as const,
        position: "mid",
        player: { name: "Player Blue mid", sourceId: "10-mid" },
        team: { name: "Acceptance Blue", sourceId: "10" },
        champion: "Ahri",
        won: true,
        statistics: {
          combat: {},
          objectives: {},
          damage: { damagetochampions: 20819 },
          vision: { visionscore: 28 },
          economy: { totalgold: 14912, "total cs": 236 },
          checkpoints: {},
        },
      },
    ],
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
    "/matches/1",
  );
  expect(within(tabs).getByRole("link", { name: "Game 2" })).toBeVisible();
  expect(screen.queryByText("31:05")).toBeNull();
  expect(screen.queryByText(/^Patch/)).toBeNull();
  expect(screen.getByText("LCK · Grand Finals · Best of 3")).toBeVisible();
  expect(screen.queryByText(/Playoffs/)).toBeNull();
  expect(screen.queryByText("Final", { exact: true })).toBeNull();
  expect(
    within(screen.getByRole("heading", { level: 1 }).closest("header")!).getByRole("link", {
      name: "Watch Game VOD",
    }),
  ).toHaveAttribute("href", vodUrl);
  const heading = screen.getByRole("heading", { level: 1 });
  expect(heading).toHaveTextContent("Acceptance Blue vs Acceptance Red");
  expect(heading.parentElement?.querySelector("time")).toHaveTextContent("Mar 1, 2026");
  expect(within(tabs).queryByText("Mar 1, 2026")).toBeNull();
  expect(screen.queryByText("Draft Order")).toBeNull();
  expect(screen.queryByText("56,005")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Reveal Game Statistics" }));
  expect(heading).toHaveTextContent("Acceptance Blue 1 vs 0 Acceptance Red");
  const draft = screen.getByRole("region", { name: "Draft Order" });
  expect(tabs.nextElementSibling).toContainElement(draft);
  expect(within(draft).getByText("First Pick").parentElement).toHaveTextContent("Red Side");
  expect(within(draft).getByText("Second Pick").parentElement).toHaveTextContent("Blue Side");
  const bans = await screen.findByRole("list", { name: "Red Side First Phase Bans" });
  expect(within(bans).getByRole("img", { name: "Azir" })).toBeVisible();
  expect(bans.querySelector(".ev-draft-slot")).toBeNull();
  expect(
    within(screen.getByRole("list", { name: "Blue Side First Phase Picks" })).getByRole("img", {
      name: "Ahri",
    }),
  ).toBeVisible();
  expect(screen.getByRole("table", { name: "Acceptance Blue Lineup" })).toBeVisible();
  expect(screen.getAllByText("Winner")).toHaveLength(1);
  expect(screen.queryByRole("link", { name: "Open Archive Record" })).toBeNull();
  expect(within(draft).queryByText("Draft Order", { selector: "summary" })).toBeNull();
  expect(screen.getByText("56,005")).toBeVisible();
  const dragons = within(screen.getByRole("group", { name: "Acceptance Blue Dragon Breakdown" }));
  expect(dragons.getAllByRole("img", { name: "Infernal Drake" })).toHaveLength(2);
  expect(dragons.getByRole("img", { name: "Elder Dragon" })).toBeVisible();
  expect(dragons.queryByText(/Elemental|Elder/)).toBeNull();
  expect(screen.getByText("20,819")).toBeVisible();
  expect(document.querySelector('[aria-label="Acceptance Blue Team Totals"]')).toHaveTextContent(
    "Void Grubs3Rift Herald1Barons0",
  );
  expect(document.querySelector('[aria-label="Acceptance Red Team Totals"]')).toHaveTextContent(
    "Void Grubs—Rift Herald—Barons—",
  );
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
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
    "Acceptance Blue 1 vs 1 Acceptance Red",
  );
  expect(screen.getByText("2026 · Playoffs · Best of 3")).toBeVisible();
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
    "/matches/1/games/1",
  );
  view.rerender(<GamePage game={game} timezone="UTC" hideSpoilers={false} />);
  expect(screen.queryByRole("link", { name: "Open in Series" })).toBeNull();
});
