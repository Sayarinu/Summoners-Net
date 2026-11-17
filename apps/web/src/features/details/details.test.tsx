import { it, expect } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { MatchPage, GamePage, ProfilePage, SeriesGamePage } from "./pages";
import { match, game, profile, blue, instant, page, seriesGames } from "../../../tests/fixtures";
it("prioritizes match identity and loads a paused replay while retaining game context", () => {
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
  // A finished match offers its YouTube recording, loaded but not playing.
  expect(screen.getByRole("heading", { name: "Watch Replay" })).toBeVisible();
  expect(screen.getByTitle("Match Broadcast")).toHaveAttribute(
    "src",
    expect.stringMatching(/youtube-nocookie\.com.*autoplay=0/),
  );
  expect(screen.queryByRole("columnheader", { name: "Status" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: /Reveal score/ }));
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
  expect(screen.getByText("No Replay Available")).toBeVisible();
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
  expect(screen.getAllByText("Hidden")).toHaveLength(6);
  fireEvent.click(screen.getByRole("button", { name: "Reveal Game Statistics" }));
  expect(screen.getByText("5 / 2 / 7")).toBeVisible();
  expect(screen.getByText("— / — / —")).toBeVisible();
  expect(screen.getByText("Unknown")).toBeVisible();
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
  expect(screen.getByRole("img", { name: "Loss" })).toBeVisible();
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

it("shows a coarse checkpoint win probability only with revealed statistics", () => {
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
    screen.getByRole("heading", { name: "Win Probability (Coarse, 4 Checkpoints)" }),
  ).toBeVisible();
  expect(screen.getByRole("link", { name: "Model Diagnostics" })).toHaveAttribute(
    "href",
    "/models?model=2",
  );
  view.rerender(
    <GamePage
      game={game}
      timezone="UTC"
      hideSpoilers={false}
      winProbability={{
        model: null,
        reason: "No pro win probability model is active yet.",
        points: [],
      }}
    />,
  );
  expect(screen.getByRole("status")).toHaveTextContent(
    "No pro win probability model is active yet.",
  );
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

it("shows a linked game's draft and lineup, and an honest gap for an unlinked game", () => {
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
    participants: [],
  };
  const view = render(
    <SeriesGamePage
      match={match}
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
  const steps = screen.getByRole("navigation", { name: "Series Games" });
  expect(within(steps).getByRole("link", { name: "Series Overview" })).toHaveAttribute(
    "href",
    "/matches/pandascore%3Amatch%3A1",
  );
  expect(within(steps).getByRole("link", { name: "Next: Game 2" })).toBeVisible();
  expect(screen.getByText("31:05")).toBeVisible();
  expect(screen.getByRole("link", { name: "Watch Game VOD" })).toHaveAttribute("href", vodUrl);
  // The draft and results stay hidden until revealed.
  expect(screen.queryByRole("heading", { name: "Draft" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Reveal Game Statistics" }));
  expect(screen.getByRole("heading", { name: "Blue Side · Acceptance Blue · First Pick" }));
  expect(
    within(screen.getByRole("heading", { name: /Blue Side/ }).parentElement!).getByRole("img", {
      name: "Ahri",
    }),
  ).toBeVisible();
  expect(screen.getByRole("img", { name: "Azir" })).toBeVisible();
  // Without a pick order, the red side lists the champions it played.
  expect(screen.getByText("Played")).toBeVisible();
  expect(screen.getByRole("table", { name: "Historical Played Lineup" })).toBeVisible();
  expect(screen.getByRole("link", { name: "Open Archive Record" })).toHaveAttribute(
    "href",
    "/games/oracle%3Agame%3Aacceptance-game",
  );
  view.rerender(
    <SeriesGamePage
      match={match}
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
  expect(screen.queryByRole("link", { name: "Watch Game VOD" })).toBeNull();
  expect(screen.getByRole("link", { name: "Previous: Game 1" })).toBeVisible();
  expect(screen.queryByRole("link", { name: /^Next/ })).toBeNull();
  expect(screen.getByText("Patch").nextElementSibling).toHaveTextContent("—");
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
