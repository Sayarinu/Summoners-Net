import { afterEach, beforeEach, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within, waitFor } from "@testing-library/react";
import { MatchPage, GamePage, SeriesGamePage } from "./pages";
import { PlayerProfile } from "../players/profile";
import { match, game, profile, instant, performance, seriesGames } from "../../../tests/fixtures";
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
  const view = render(
    <PlayerProfile
      profile={linked}
      performance={performance}
      seasons={[]}
      query={{}}
      hideSpoilers={false}
    />,
  );
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
  expect(screen.queryByText("Timeline")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Reveal Game Statistics" }));
  expect(screen.getByRole("heading", { name: "Timeline" })).toBeVisible();
  const chart = await screen.findByRole("group", { name: /^Win Probability by Minute/ });
  expect(within(chart).getAllByText("100%", { exact: true })).toHaveLength(2);
  expect(within(chart).getByText("0%", { exact: true })).toBeVisible();
  expect(screen.queryByRole("table", { name: "Win Probability Checkpoints" })).toBeNull();
  expect(within(chart).queryByText("Acceptance Blue", { exact: true })).toBeNull();
  expect(within(chart).queryByText("Acceptance Red", { exact: true })).toBeNull();
  expect(
    within(chart).getByText("10:00: Acceptance Blue 55%, Acceptance Red 45%").closest("li"),
  ).toHaveAttribute("data-side", "blue");
  expect(
    within(chart).getByText("15:00: Acceptance Blue 40%, Acceptance Red 60%").closest("li"),
  ).toHaveAttribute("data-side", "red");
  expect(
    within(chart).getByText("20:00: win probability unavailable").closest("li"),
  ).not.toHaveAttribute("data-side");
  expect(
    within(chart).getByText("25:00: Acceptance Blue 50%, Acceptance Red 50%").closest("li"),
  ).not.toHaveAttribute("data-side");
  expect(screen.queryByRole("link", { name: "Model Diagnostics" })).toBeNull();
  for (const unavailable of [
    { model: null, reason: "No pro win probability model is active yet.", points: [] },
    { ...winProbability, points: [{ minute: 10, blueWinProbability: null }] },
  ]) {
    view.rerender(
      <GamePage game={game} timezone="UTC" hideSpoilers={false} winProbability={unavailable} />,
    );
    expect(screen.queryByRole("heading", { name: "Timeline" })).toBeNull();
  }
});

it("moves between a series overview and its played games with spoilers kept", () => {
  const games = seriesGames();
  const view = render(
    <MatchPage
      match={match}
      games={games}
      summaries={[
        {
          number: 1,
          durationSeconds: 1976,
          teams: [{ id: match.teams[0]!.entityId ?? match.teams[0]!.id, side: "blue", kills: 19 }],
        },
      ]}
      timezone="UTC"
      hideSpoilers
      now={instant}
    />,
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
  // Game 1's card takes the archive's in-game length over the provider's times.
  expect(screen.getByText("32:56")).toBeVisible();
  expect(screen.queryByText("0:00")).toBeNull();
  expect(screen.getByText("Mar 1, 2026", { selector: "time" })).toBeVisible();
  expect(within(tabs).queryByText("Mar 1, 2026")).toBeNull();
  expect(screen.queryByRole("region", { name: "Series Summary" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: /Reveal score/ }));
  expect(screen.queryByText("Result hidden")).toBeNull();
  expect(screen.getByRole("link", { name: "Open Game 1" })).toHaveTextContent("Acceptance Blue");
  expect(screen.getByRole("link", { name: "Open Game 2" })).toHaveTextContent("Acceptance Red");
  const summary = within(screen.getByRole("region", { name: "Series Summary" }));
  expect(summary.getByRole("link", { name: "Game 1" })).toHaveAttribute(
    "href",
    "/matches/1/games/1",
  );
  expect(summary.getByText("19 kills").parentElement).toHaveAttribute("data-side", "blue");
  expect(summary.getByText("32:56")).toBeVisible();
  view.rerender(
    <MatchPage match={match} games={[]} timezone="UTC" hideSpoilers={false} now={instant} />,
  );
  expect(screen.getByText("No Games Reported Yet")).toBeVisible();
  expect(screen.getByRole("link", { name: "Past Matches" })).toHaveAttribute("href", "/history");
});

it("shows each game card's in-game length and its VOD at the game start, or else its start time", () => {
  const vodUrl = "https://www.youtube.com/watch?v=c5ZgeZ0QdDI&t=540s";
  const games = seriesGames().map((item) =>
    item.number === 1
      ? {
          ...item,
          startsAt: "2026-03-01T01:00:00.000Z",
          finishedAt: "2026-03-01T02:01:51.000Z",
          gameVodUrl: vodUrl,
        }
      : item,
  );
  const view = render(
    <MatchPage
      match={match}
      games={games}
      summaries={[
        { number: 1, durationSeconds: 3196, startsAt: "2026-03-01T01:08:00.000Z", teams: [] },
        { number: 2, durationSeconds: null, startsAt: "2026-03-01T02:08:00.000Z", teams: [] },
      ]}
      timezone="America/New_York"
      hideSpoilers
      now={instant}
    />,
  );
  const cards = within(screen.getByRole("heading", { name: "Games" }).parentElement!);
  const [first, second, third] = cards.getAllByRole("listitem");
  // PandaScore's times include the draft (61:51); the archive's in-game length is shown.
  expect(within(first!).getByText("53:16")).toBeVisible();
  expect(within(first!).queryByText("61:51")).toBeNull();
  expect(within(first!).getByRole("link", { name: "Watch Game 1 VOD" })).toHaveAttribute(
    "href",
    vodUrl,
  );
  expect(within(first!).queryByText(/Started/)).toBeNull();
  // Without an archive length the provider's times remain; without a VOD the start time shows.
  expect(within(second!).getByText("31:05")).toBeVisible();
  expect(within(second!).queryByRole("link", { name: /VOD/ })).toBeNull();
  expect(within(second!).getByText(/Started/)).toHaveTextContent("Started 9:08 PM");
  expect(within(second!).getByText("9:08 PM")).toHaveAttribute(
    "datetime",
    "2026-03-01T02:08:00.000Z",
  );
  expect(within(third!).queryByText(/Started/)).toBeNull();
  // Without a summary, the provider's start stands in.
  view.rerender(
    <MatchPage match={match} games={games} timezone="UTC" hideSpoilers now={instant} />,
  );
  expect(screen.getByText(/Started/)).toHaveTextContent("Started 2:00 AM");
  expect(screen.getByText("61:51")).toBeVisible();
  view.rerender(
    <SeriesGamePage
      match={match}
      games={games}
      number={1}
      game={null}
      detail={null}
      winProbability={null}
      timezone="UTC"
      hideSpoilers
      now={instant}
    />,
  );
  expect(screen.getByRole("link", { name: "Watch Game VOD" })).toHaveAttribute("href", vodUrl);
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
          combat: { kills: 14, firstblood: 1, fbtime: 2.5 },
          objectives: {
            towers: 7,
            turretplates: 5,
            dragons: 3,
            firstdragon: 1,
            fdtime: 6.25,
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
          checkpoints: { golddiffat10: 2750, golddiffat15: -1500 },
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
          damage: { damagetochampions: 20819, damageshare: 0.25 },
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
  expect(screen.getByText("Mar 1, 2026", { selector: "time" }).parentElement).toHaveTextContent(
    "LCK · Grand Finals · Mar 1, 2026 · Best of 3",
  );
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
  const blueTotals = within(
    document.querySelector<HTMLElement>('[aria-label="Acceptance Blue Team Totals"]')!,
  );
  expect(
    within(blueTotals.getByRole("list", { name: "Elemental Dragons" })).getAllByRole("img", {
      name: "Infernal Drake",
    }),
  ).toHaveLength(2);
  expect(
    within(blueTotals.getByRole("list", { name: "Elder Dragons" })).getAllByRole("img"),
  ).toEqual([blueTotals.getByRole("img", { name: "Elder Dragon" })]);
  expect(
    within(blueTotals.getByRole("list", { name: "Captured Void Grubs" })).getAllByRole("img", {
      name: "Void Grub",
    }),
  ).toHaveLength(3);
  expect(screen.getByText("20,819")).toBeVisible();
  expect(document.querySelector('[aria-label="Acceptance Blue Team Totals"]')).toHaveTextContent(
    "Tower Plates5",
  );
  expect(screen.queryByText("Build Path")).toBeNull();
  const goldShare = within(screen.getByRole("table", { name: "Gold Distribution" }));
  const damageShare = within(screen.getByRole("table", { name: "Damage Distribution" }));
  expect(goldShare.getByText("26.6%")).toBeVisible();
  expect(damageShare.getByText("25%")).toBeVisible();
  expect(goldShare.getByText("26.6%").closest("[title]")).toHaveAttribute(
    "title",
    expect.stringMatching(/^[\d,]+ gold$/),
  );
  expect(damageShare.getByText("25%").closest("[title]")).toHaveAttribute(
    "title",
    expect.stringMatching(/^[\d,]+ damage$/),
  );
  expect(goldShare.getByRole("img", { name: "Acceptance Blue" })).toBeVisible();
  expect(goldShare.getByRole("img", { name: "Ahri" }).closest("tr")).toContainElement(
    goldShare.getByRole("img", { name: /^Mid$/ }),
  );
  expect(document.querySelector('[aria-label="Acceptance Blue Team Totals"]')).toHaveTextContent(
    "Void GrubsRift Herald1Barons0",
  );
  expect(document.querySelector('[aria-label="Acceptance Red Team Totals"]')).toHaveTextContent(
    "Void Grubs—Rift Herald—Barons—",
  );
  const events = await screen.findByRole("list", { name: "Game Events" });
  expect(
    within(events)
      .getAllByRole("listitem")
      .map((item) => item.textContent),
  ).toEqual(["2:30", "6:15First Dragon"]);
  expect(within(events).getByRole("img", { name: "First Blood" })).toHaveAttribute(
    "data-objective",
    "first-blood",
  );
  const goldPlot = within(screen.getByRole("group", { name: /^Gold Difference by Time/ }));
  expect(
    goldPlot.getByText("10:00: Acceptance Blue ahead by 2,750 gold").closest("li"),
  ).toHaveAttribute("data-side", "blue");
  expect(
    goldPlot.getByText("15:00: Acceptance Red ahead by 1,500 gold").closest("li"),
  ).toHaveAttribute("data-side", "red");
  expect(screen.queryByRole("group", { name: /^Win Probability by Minute/ })).toBeNull();
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
  expect(screen.getByText("Mar 1, 2026", { selector: "time" }).parentElement).toHaveTextContent(
    "2026 · Playoffs · Mar 1, 2026 · Best of 3",
  );
  expect(screen.queryByText(/Grand Final/)).toBeNull();
  expect(screen.queryByRole("link", { name: "Watch Game VOD" })).toBeNull();
  expect(
    within(screen.getByRole("navigation", { name: "Series" })).getByRole("link", {
      name: "Game 1",
    }),
  ).toBeVisible();
  expect(screen.queryByText(/^Patch/)).toBeNull();

  const priorPicks = [
    { role: "mid", champion: "Orianna" },
    { role: "top", champion: "Gnar" },
    { role: "jungle", champion: "Vi" },
    { role: "bottom", champion: "Ezreal" },
    { role: "support", champion: "Lulu" },
    { role: "mid", champion: "Ahri" },
  ];
  view.rerender(
    <SeriesGamePage
      match={{ ...match, league: "Worlds", event: "2026 · Playoffs" }}
      games={games}
      number={2}
      game={{ ...game, number: 2 }}
      detail={detail}
      fearless={priorPicks}
      winProbability={null}
      timezone="UTC"
      hideSpoilers={false}
      now={instant}
    />,
  );
  const combinedDraft = screen.getByRole("region", { name: "Draft Order" });
  const fearless = within(combinedDraft).getByRole("region", { name: "Fearless Bans" });
  expect(combinedDraft).toHaveAttribute("data-fearless", "true");
  expect(within(fearless).queryByRole("heading")).toBeNull();
  expect(within(fearless).queryByText(/Game \d/)).toBeNull();
  const mid = within(fearless).getByRole("list", { name: "Mid Fearless Bans" });
  expect(within(mid).getAllByRole("img")).toEqual([
    within(mid).getByRole("img", { name: "Orianna" }),
    within(mid).getByRole("img", { name: "Ahri" }),
  ]);
  expect(within(fearless).getByRole("img", { name: /^Mid$/ })).toBeVisible();
  expect(fearless.querySelector("[data-action], .ev-draft-portrait")).toBeNull();
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
  const crumbs = within(screen.getByRole("navigation", { name: "Breadcrumb" }));
  expect(crumbs.getByRole("link", { name: "Acceptance Blue vs Acceptance Red" })).toHaveAttribute(
    "href",
    "/matches/1",
  );
  expect(screen.getByText(/· Game 1/, { selector: ".np-overline" })).toHaveTextContent(
    new RegExp(
      `${new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(game.occurredAt))}`,
    ),
  );
  view.rerender(<GamePage game={game} timezone="UTC" hideSpoilers={false} />);
  expect(screen.queryByRole("link", { name: "Open in Series" })).toBeNull();
  expect(
    within(screen.getByRole("navigation", { name: "Breadcrumb" })).queryByRole("link", {
      name: "Acceptance Blue vs Acceptance Red",
    }),
  ).toBeNull();
});

it("shows a player's final items and reveals their recorded purchases by minute", async () => {
  render(
    <GamePage
      game={game}
      detail={{
        id: game.id,
        sourceGameId: game.sourceId,
        sourceLeague: "Worlds",
        competition: "Worlds",
        year: 2026,
        occurredAt: instant,
        patch: game.patch,
        complete: true,
        summaryEligible: true,
        teams: [],
        context: {
          sourceYear: 2026,
          sourceUrl: null,
          split: null,
          week: null,
          playoffs: null,
          gameNumber: "1",
          durationSeconds: 1865,
        },
        draft: [],
        draftOrder: [],
        participants: [],
        telemetry: {
          patch: "16.22",
          gold: [
            { seconds: 60, lead: 200 },
            { seconds: 120, lead: -120 },
          ],
          events: [
            { seconds: 402, label: "Dragon", side: "blue", drake: "cloud" },
            { seconds: 1500, label: "Baron Nashor", side: "red", drake: null },
          ],
          builds: {
            "blue:mid": {
              inventory: [3089],
              purchases: [
                { itemId: 1056, timestampMs: 551 },
                { itemId: 3089, timestampMs: 550100 },
              ],
            },
          },
        },
      }}
      items={{
        "3089": { name: "Rabadon's Deathcap", imageUrl: null },
        "1056": { name: "Doran's Ring", imageUrl: null },
      }}
      timezone="UTC"
      hideSpoilers={false}
    />,
  );
  expect(
    within(screen.getByRole("group", { name: /Final Items$/ })).getByRole("img", {
      name: "Rabadon's Deathcap",
    }),
  ).toBeVisible();
  const trigger = screen.getByLabelText(/Build Path$/);
  expect(trigger.closest("details")).not.toHaveAttribute("open");
  fireEvent.click(trigger);
  expect(trigger.closest("details")).toHaveAttribute("open");
  const path = within(screen.getByRole("list", { name: /Purchase Order$/ }));
  expect(path.getByText("9m")).toBeVisible();
  expect(path.getByRole("img", { name: "Doran's Ring" })).toBeVisible();
  expect(path.getByTitle("Rabadon's Deathcap at 9:10")).toBeVisible();
  const gold = await screen.findByRole("group", { name: /^Gold Difference by Time/ });
  expect(within(gold).getByText("2:00: Acceptance Red ahead by 120 gold")).toBeInTheDocument();
  const events = within(screen.getByRole("list", { name: "Game Events" }));
  expect(events.getByText("6:42")).toBeVisible();
  expect(events.getByRole("img", { name: "Baron Nashor" }).closest("li")).toHaveAttribute(
    "data-side",
    "red",
  );
  // Hovering an event marks its time on every chart with a dashed line.
  const eventLine = () => gold.querySelector(".ev-probability__event");
  expect(eventLine()).not.toHaveAttribute("data-active");
  fireEvent.pointerEnter(events.getByText("6:42").closest("li")!);
  expect(eventLine()).toHaveAttribute("data-active");
  fireEvent.pointerLeave(events.getByText("6:42").closest("li")!);
  expect(eventLine()).not.toHaveAttribute("data-active");
  // Pointing at the plot reads out the nearest recorded minute.
  const plot = gold.querySelector<HTMLElement>(".ev-probability__plot")!;
  plot.getBoundingClientRect = () => ({ left: 0, width: 600 }) as DOMRect;
  fireEvent.pointerMove(plot, { clientX: 16 + (120 / 1865) * 568 });
  const readout = gold.querySelector(".ev-probability__readout");
  expect(readout).toHaveTextContent("2:00+120 GoldAcceptance Red");
  fireEvent.pointerLeave(plot);
  expect(gold.querySelector(".ev-probability__readout")).toBeNull();
});
