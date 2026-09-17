import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import {
  AffiliationTimeline,
  BroadcastSelector,
  DirectoryIntroActions,
  DirectoryList,
  EsportsFeatureGate,
  EventStageNavigation,
  GameSelector,
  GroupedSearchResults,
  GroupStandingsTable,
  HandleTimeline,
  LiveDataGate,
  LiveScoreboard,
  MatchFacts,
  MatchHeader,
  MatchMetadata,
  MatchSourceStatus,
  ObjectiveStrip,
  PlayerCard,
  PlayerLiveStatTable,
  PlayerProfileHeader,
  PlayerRankingTable,
  PlayerStatSummary,
  ScheduleCalendar,
  ScheduleCalendarLegend,
  ScheduleToolbar,
  SearchAutocomplete,
  SeriesScore,
  SeriesTimeline,
  StreamPlayAction,
  StreamStatePanel,
  TeamCard,
  TeamProfileHeader,
  TournamentBracket,
} from "./esports-extended.js";
import { Button } from "./primitives.js";

const teams = [
  { name: "Gen.G", score: 2, shortName: "GEN", winner: true },
  { name: "T1", score: 1, shortName: "T1" },
] as const;

describe("extended schedule and match components", () => {
  it("operates schedule search, view switching, and calendar selection", async () => {
    const user = userEvent.setup();
    const onQueryChange = vi.fn();
    const onViewChange = vi.fn();
    const onSelect = vi.fn();
    render(
      <>
        <ScheduleToolbar
          analyticsId="schedule-toolbar"
          onQueryChange={onQueryChange}
          onTimezoneChange={vi.fn()}
          onViewChange={onViewChange}
          query=""
          timezones={[{ label: "UTC", value: "UTC" }]}
          timezone="UTC"
          view="list"
        />
        <ScheduleCalendar
          days={[
            { date: "2026-07-10", label: "10", liveCount: 2, matchCount: 6, today: true },
            { date: "2026-07-11", disabled: true, label: "11", outsideRange: true },
          ]}
          label="July 2026"
          onSelect={onSelect}
          selectedDate="2026-07-10"
        />
        <ScheduleCalendarLegend />
      </>,
    );

    expect(document.querySelector('[data-analytics-id="schedule-toolbar"]')).toBeInTheDocument();
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "Gen.G" } });
    expect(onQueryChange).toHaveBeenCalledWith("Gen.G");
    await user.click(screen.getByRole("button", { name: "Calendar" }));
    expect(onViewChange).toHaveBeenCalledWith("calendar");
    await user.click(screen.getByRole("button", { name: /10/ }));
    expect(onSelect).toHaveBeenCalledWith("2026-07-10");
    expect(screen.getByText("Live")).toBeInTheDocument();
  });

  it("renders display-only calendar days when no selection handler exists", () => {
    render(<ScheduleCalendar days={[{ date: "2026-07-10", label: "10" }]} label="July" />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByRole("article")).toBeInTheDocument();
  });

  it("supports extended lifecycles and spoiler-safe match headings", () => {
    const { rerender } = render(
      <MatchHeader
        classification="showmatch"
        lifecycle="final"
        spoilerHidden
        teams={teams}
        title="Gen.G vs T1"
      />,
    );
    expect(screen.getByText("Showmatch")).toBeInTheDocument();
    expect(screen.getAllByText("Hidden")).toHaveLength(2);
    expect(screen.queryByText("2")).not.toBeInTheDocument();

    rerender(
      <MatchHeader
        gameLabel="Start unconfirmed"
        lifecycle="unknown"
        teams={teams}
        title="Gen.G vs T1"
      />,
    );
    expect(screen.getByText("Status unknown")).toBeInTheDocument();
    expect(screen.getByText("Start unconfirmed")).toBeInTheDocument();
  });

  it("renders metadata, facts, source states, and game selection", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const onRefresh = vi.fn();
    render(
      <>
        <MatchMetadata items={[{ label: "Patch", source: "Riot", value: "26.14" }]} />
        <MatchFacts facts={[{ detail: "Game 4", label: "Side selection", value: "Blue" }]} />
        <GameSelector
          games={[
            { id: "1", label: "Game 1", score: "GEN", state: "available", winner: "Gen.G" },
            { id: "2", label: "Game 2", state: "unavailable" },
          ]}
          onSelect={onSelect}
          selectedId="1"
        />
        <SeriesScore games={[{ id: "3", label: "Game 3", state: "live" }]} />
        <MatchSourceStatus
          href="#official"
          lastUpdated="12 seconds ago"
          onRefresh={onRefresh}
          provider="Official API"
          state="fresh"
        />
      </>,
    );
    expect(screen.getByText("Source: Riot")).toBeInTheDocument();
    expect(screen.getByText("Game 4")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Game 1/ }));
    expect(onSelect).toHaveBeenCalledWith("1");
    expect(screen.getByRole("button", { name: /Game 2/ })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Refresh" }));
    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("link", { name: /Official source/ })).toHaveAttribute(
      "href",
      "#official",
    );
  });

  it.each(["conflict", "delayed", "stale", "unavailable", "unknown"] as const)(
    "renders the %s source state",
    (state) => {
      render(<MatchSourceStatus state={state} />);
      expect(screen.getByRole("region")).toBeInTheDocument();
    },
  );
});

describe("extended team, player, and discovery components", () => {
  it("renders profile headers and entity cards with optional actions and metrics", () => {
    render(
      <>
        <TeamProfileHeader
          actions={<Button>Matches</Button>}
          meta={["LCK", "Korea"]}
          name="Gen.G"
          shortName="GEN"
          status={<span>Active</span>}
        />
        <PlayerProfileHeader affiliations={<span>Gen.G · Mid</span>} name="Chovy" shortName="CHV" />
        <TeamCard
          actions={<Button>Compare</Button>}
          detail="Tier 1"
          href="#team"
          statistics={[{ label: "Win rate", value: "72%" }]}
          team={{ name: "Gen.G", shortName: "GEN" }}
        />
        <PlayerCard
          actions={<Button>Compare</Button>}
          href="#player"
          player={{ handle: "Chovy", role: "Mid" }}
          statistics={[{ label: "KDA", value: "4.8" }]}
          team="Gen.G"
        />
      </>,
    );
    expect(screen.getAllByRole("heading", { name: "Gen.G" })).toHaveLength(1);
    expect(screen.getByRole("heading", { name: "Chovy" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open Gen.G" })).toHaveAttribute("href", "#team");
    expect(screen.getByRole("link", { name: "Open Chovy" })).toHaveAttribute("href", "#player");
    expect(screen.getAllByRole("button", { name: "Compare" })).toHaveLength(2);
  });

  it("covers directory loading, empty, partial, and ready states", () => {
    const { rerender } = render(<DirectoryList label="Teams" state="loading" />);
    expect(screen.getByLabelText("Loading directory")).toBeInTheDocument();
    rerender(<DirectoryList emptyAction={<Button>Clear</Button>} label="Teams" state="empty" />);
    expect(screen.getByText("No results")).toBeInTheDocument();
    rerender(
      <DirectoryList label="Teams" state="partial">
        <span>Gen.G</span>
      </DirectoryList>,
    );
    expect(screen.queryByText(/partial/i)).not.toBeInTheDocument();
    expect(screen.getByText("Gen.G")).toBeInTheDocument();
    rerender(
      <DirectoryList count={1} label="Teams">
        <span>T1</span>
      </DirectoryList>,
    );
    expect(screen.getByText("1 results")).toBeInTheDocument();
  });

  it("renders grouped results and autocomplete lifecycle states", () => {
    const groups = [
      {
        id: "teams",
        label: "Teams",
        results: [{ href: "#", name: "Gen.G", shortName: "GEN", type: "team" as const }],
      },
    ];
    const { rerender } = render(<GroupedSearchResults groups={groups} />);
    expect(screen.getByRole("heading", { name: "Teams" })).toBeInTheDocument();
    rerender(<SearchAutocomplete query="" recent={["Gen.G"]} state="idle" />);
    expect(screen.getByText("Recent searches")).toBeInTheDocument();
    rerender(<SearchAutocomplete query="unknown" state="no-results" />);
    expect(screen.getByText("No results")).toBeInTheDocument();
    rerender(<SearchAutocomplete query="gen" state="loading" />);
    expect(document.querySelectorAll(".np-skeleton").length).toBeGreaterThan(0);
    rerender(
      <SearchAutocomplete query="gen" state="partial">
        <GroupedSearchResults groups={groups} />
      </SearchAutocomplete>,
    );
    expect(screen.queryByText(/partial/i)).not.toBeInTheDocument();
  });

  it("renders affiliations, player metrics, rankings, and directory actions", () => {
    render(
      <>
        <AffiliationTimeline
          affiliations={[
            {
              current: true,
              dates: <time dateTime="2021-01-01">01/01/2021 — Present</time>,
              href: "#team",
              name: "Gen.G",
              shortName: "GEN",
              start: "2021",
            },
            { end: "2021", name: "DRX", shortName: "DRX", start: "2019" },
          ]}
        />
        <HandleTimeline
          handles={[
            {
              current: true,
              dates: <span>2021 — Present</span>,
              handle: "Current",
              shortName: "CU",
            },
            {
              dates: <span>2019 — 2020</span>,
              handle: "Previous",
              href: "#previous",
              shortName: "PR",
            },
          ]}
        />
        <PlayerStatSummary stats={[{ detail: "Season", label: "KDA", rank: "#1", value: "4.8" }]} />
        <PlayerRankingTable
          caption="Mid rankings"
          rows={[{ id: "1", player: { handle: "Chovy" }, rank: 1, value: "4.8" }]}
        />
        <DirectoryIntroActions>
          <Button>Browse</Button>
        </DirectoryIntroActions>
        <StreamPlayAction href="#stream" />
      </>,
    );
    expect(screen.getAllByText(/Present/)).toHaveLength(2);
    expect(screen.getByRole("link", { name: "Open Previous" })).toHaveAttribute(
      "href",
      "#previous",
    );
    expect(screen.getByText("#1")).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "Mid rankings" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Open official stream/ })).toHaveAttribute(
      "href",
      "#stream",
    );
  });
});

describe("extended live, event, and stream components", () => {
  it("renders the live scoreboard, player table, objectives, and series timeline", () => {
    const view = render(
      <>
        <LiveScoreboard
          gameTime="31:24"
          teams={[
            {
              gold: "52k",
              kills: 14,
              name: "Gen.G",
              objectives: 4,
              score: 2,
              shortName: "GEN",
              side: "blue",
              towers: 8,
            },
            { name: "T1", score: 1, shortName: "T1", side: "red" },
          ]}
        />
        <PlayerLiveStatTable
          caption="Live players"
          rows={[
            {
              champion: "Azir",
              cs: 300,
              damage: "22k",
              gold: "13k",
              id: "1",
              kda: "5/1/7",
              player: { handle: "Chovy" },
            },
          ]}
        />
        <ObjectiveStrip
          events={[{ id: "1", label: "Baron", team: "GEN", time: "27:16", tone: "warning" }]}
        />
        <SeriesTimeline
          games={[
            { duration: "32:18", id: "1", label: "Game 1", state: "final", winner: "GEN" },
            { id: "2", label: "Game 2", state: "live" },
          ]}
        />
      </>,
    );
    expect(screen.getByRole("region", { name: "Live scoreboard" })).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "Live players" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Objective timeline" })).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Series timeline" })).toBeInTheDocument();
    for (const [status, label] of [
      ["paused", "Paused"],
      ["stale", "Stale"],
      ["complete", "Complete"],
    ] as const) {
      view.rerender(
        <LiveScoreboard
          gameTime="31:24"
          status={status}
          teams={[
            { name: "Gen.G", score: 2, shortName: "GEN", side: "blue" },
            { name: "T1", score: 1, shortName: "T1", side: "red" },
          ]}
        />,
      );
      expect(screen.getByText(label)).toBeVisible();
    }
  });

  it.each(["delayed", "disconnected", "paused", "stale", "unavailable"] as const)(
    "renders the %s live-data gate",
    (state) => {
      render(<LiveDataGate state={state} />);
      expect(screen.getByRole("heading")).toBeInTheDocument();
    },
  );

  it("passes through ready live data and feature-gated content", () => {
    const { rerender } = render(
      <LiveDataGate state="ready">
        <span>Licensed data</span>
      </LiveDataGate>,
    );
    expect(screen.getByText("Licensed data")).toBeInTheDocument();
    rerender(
      <EsportsFeatureGate enabled feature="Pick/ban">
        <span>Draft</span>
      </EsportsFeatureGate>,
    );
    expect(screen.getByText("Draft")).toBeInTheDocument();
    rerender(<EsportsFeatureGate enabled={false} feature="Pick/ban" />);
    expect(screen.getByText("Pick/ban not active")).toBeInTheDocument();
  });

  it("operates stage navigation and enhanced standings", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <>
        <EventStageNavigation
          activeId="swiss"
          onSelect={onSelect}
          stages={[
            { id: "play-in", label: "Play-in", status: "complete" },
            { count: 8, id: "swiss", label: "Swiss", status: "live" },
            { disabled: true, id: "final", label: "Final", status: "upcoming" },
          ]}
        />
        <GroupStandingsTable
          caption="Group A"
          rows={[
            {
              differential: 3,
              form: ["W", "L"],
              id: "gen",
              losses: 1,
              points: 6,
              rank: 1,
              seed: "A1",
              team: { name: "Gen.G", shortName: "GEN" },
              wins: 2,
            },
          ]}
        />
      </>,
    );
    await user.click(screen.getByRole("button", { name: /Play-in/ }));
    expect(onSelect).toHaveBeenCalledWith("play-in");
    expect(screen.getByRole("button", { name: /Final/ })).toBeDisabled();
    expect(screen.getByRole("table", { name: "Group A" })).toBeInTheDocument();
  });

  it("renders bracket loading, empty, unavailable, stale, and selectable states", async () => {
    const user = userEvent.setup();
    const onMatchSelect = vi.fn();
    const lanes = [
      {
        id: "upper",
        label: "Upper",
        rounds: [
          {
            id: "r1",
            label: "Round 1",
            matches: [
              {
                bestOf: 5 as const,
                date: "Oct 30",
                id: "m1",
                lifecycle: "final" as const,
                seed: "1",
                teams,
              },
            ],
          },
        ],
      },
    ];
    const { rerender } = render(
      <TournamentBracket
        lanes={lanes}
        onMatchSelect={onMatchSelect}
        spoilerHidden
        title="Playoffs"
      />,
    );
    await user.click(screen.getByRole("button", { name: "Open Gen.G versus T1" }));
    expect(onMatchSelect).toHaveBeenCalledWith("m1");
    expect(screen.queryByText("2")).not.toBeInTheDocument();
    rerender(<TournamentBracket lanes={lanes} state="stale" title="Playoffs" />);
    expect(screen.getByText("Stale")).toBeInTheDocument();
    rerender(<TournamentBracket lanes={[]} state="loading" title="Playoffs" />);
    expect(document.querySelector(".np-skeleton")).toBeInTheDocument();
    rerender(<TournamentBracket lanes={[]} state="empty" title="Playoffs" />);
    expect(screen.getByText("Bracket pending")).toBeInTheDocument();
    rerender(<TournamentBracket lanes={[]} state="unavailable" title="Playoffs" />);
    expect(screen.getByText("Bracket unavailable")).toBeInTheDocument();
  });

  it("operates broadcast selection and renders every stream state", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const { rerender } = render(
      <BroadcastSelector
        broadcasts={[
          { id: "en", label: "Main", language: "English", provider: "Twitch", state: "live" },
          { id: "vod", label: "Replay", language: "English", provider: "YouTube", state: "replay" },
        ]}
        onSelect={onSelect}
        selectedId="en"
      />,
    );
    await user.click(screen.getByRole("button", { name: /Replay/ }));
    expect(onSelect).toHaveBeenCalledWith("vod");
    rerender(
      <StreamStatePanel provider="Twitch" state="live">
        <span>Player</span>
      </StreamStatePanel>,
    );
    expect(screen.getByText("Player")).toBeInTheDocument();
    rerender(
      <StreamStatePanel provider="YouTube" state="replay">
        <span>VOD</span>
      </StreamStatePanel>,
    );
    expect(screen.getByText("Replay")).toBeInTheDocument();
    for (const state of ["consent", "ended", "geo-blocked", "offline", "restricted"] as const) {
      rerender(<StreamStatePanel provider="Twitch" rememberedConsent state={state} />);
      expect(screen.getByRole("heading")).toBeInTheDocument();
    }
  });
});
