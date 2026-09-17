import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ReactNode } from "react";

import { PickBan } from "./esports.js";
import { Button } from "./primitives.js";
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
import "./review.stories.css";

const noop = () => undefined;
const noopValue = (_value: string) => undefined;

const teams = [
  { name: "Gen.G", score: 2, shortName: "GEN", winner: true },
  { name: "T1", score: 1, shortName: "T1" },
] as const;

const meta = {
  parameters: { layout: "fullscreen" },
  title: "Esports/03 Extended production patterns",
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

function Canvas({ children, label }: { readonly children: ReactNode; readonly label: string }) {
  return (
    <main className="np-review">
      <header className="np-review__header">
        <div>
          <span className="np-eyebrow">Extended system</span>
          <h1>{label}</h1>
        </div>
        <p>Production-ready component contract and representative states.</p>
      </header>
      <section className="np-review__section np-review__section--single">
        <div className="np-review__stage">{children}</div>
      </section>
    </main>
  );
}

export const ScheduleControls: Story = {
  name: "ScheduleToolbar",
  render: () => (
    <Canvas label="Schedule toolbar">
      <ScheduleToolbar
        filters={<span className="np-meta">Tier 1 · Official + showmatches · All regions</span>}
        onQueryChange={noopValue}
        onTimezoneChange={noopValue}
        onViewChange={noopValue}
        query="Gen.G"
        timezones={[
          { label: "Eastern Time", value: "America/New_York" },
          { label: "UTC", value: "UTC" },
        ]}
        timezone="America/New_York"
        view="list"
      />
    </Canvas>
  ),
};

const calendarDays = Array.from({ length: 21 }, (_, index) => ({
  date: `2026-07-${String(index + 1).padStart(2, "0")}`,
  label: String(index + 1),
  ...(index === 9 ? { liveCount: 2 } : {}),
  matchCount: (index % 6) + 1,
  today: index === 9,
}));

export const CalendarSchedule: Story = {
  name: "ScheduleCalendar",
  render: () => (
    <Canvas label="Schedule calendar">
      <ScheduleCalendar
        days={calendarDays}
        label="July 2026"
        onSelect={noopValue}
        selectedDate="2026-07-10"
      />
      <ScheduleCalendarLegend />
    </Canvas>
  ),
};

export const CalendarLegend: Story = {
  name: "ScheduleCalendarLegend",
  render: () => (
    <Canvas label="Schedule calendar legend">
      <ScheduleCalendarLegend />
    </Canvas>
  ),
};

export const MatchHeading: Story = {
  name: "MatchHeader",
  render: () => (
    <Canvas label="Match header">
      <MatchHeader
        actions={<Button>Open Official Stream</Button>}
        classification="official"
        gameLabel="Game 4 · 31:24"
        lifecycle="live"
        teams={teams}
        title="Gen.G vs T1"
      />
    </Canvas>
  ),
};

export const MatchDetails: Story = {
  name: "MatchMetadata",
  render: () => (
    <Canvas label="Match metadata">
      <MatchMetadata
        items={[
          { label: "Competition", value: "Worlds 2026" },
          { label: "Stage", value: "Semifinal" },
          { label: "Format", value: "Best of 5" },
          { label: "Start", value: "18:00 EDT", source: "Official event schedule" },
        ]}
      />
    </Canvas>
  ),
};

const seriesGames = [
  { id: "1", label: "Game 1", score: "GEN", state: "available" as const, winner: "Gen.G" },
  { id: "2", label: "Game 2", score: "T1", state: "available" as const, winner: "T1" },
  { id: "3", label: "Game 3", score: "GEN", state: "available" as const, winner: "Gen.G" },
  { id: "4", label: "Game 4", state: "live" as const },
  { id: "5", label: "Game 5", state: "scheduled" as const },
];

export const SeriesScoreStates: Story = {
  name: "SeriesScore",
  render: () => (
    <Canvas label="Series score">
      <SeriesScore games={seriesGames} onSelect={noopValue} selectedId="4" />
    </Canvas>
  ),
};
export const GameSelection: Story = {
  name: "GameSelector",
  render: () => (
    <Canvas label="Game selector">
      <GameSelector games={seriesGames} onSelect={noopValue} selectedId="3" />
    </Canvas>
  ),
};

export const MatchFactSummary: Story = {
  name: "MatchFacts",
  render: () => (
    <Canvas label="Match facts">
      <MatchFacts
        facts={[
          { label: "Patch", value: "26.14" },
          { label: "Venue", value: "Mercedes-Benz Arena" },
          { label: "Side selection", value: "GEN · Blue", detail: "Game 4" },
          { label: "Officials", value: "Riot Games" },
        ]}
      />
    </Canvas>
  ),
};

export const MatchSourceStates: Story = {
  name: "MatchSourceStatus",
  render: () => (
    <Canvas label="Match source status">
      <div className="np-review__stack">
        <MatchSourceStatus
          href="#"
          lastUpdated="12 seconds ago"
          provider="Official event API"
          state="fresh"
        />
        <MatchSourceStatus lastUpdated="18 minutes ago" provider="Live telemetry" state="stale" />
        <MatchSourceStatus provider="Schedule API + manual override" state="conflict" />
      </div>
    </Canvas>
  ),
};

export const TeamProfile: Story = {
  name: "TeamProfileHeader",
  render: () => (
    <Canvas label="Team profile header">
      <TeamProfileHeader
        actions={<Button>Open Matches</Button>}
        meta={["LCK", "Korea", "Founded 2017"]}
        name="Gen.G"
        shortName="GEN"
        status={<span className="np-meta">Active roster · 5 players</span>}
      />
    </Canvas>
  ),
};

export const PlayerProfile: Story = {
  name: "PlayerProfileHeader",
  render: () => (
    <Canvas label="Player profile header">
      <PlayerProfileHeader
        affiliations={<span>Gen.G · Mid lane</span>}
        meta={["Jeong Ji-hoon", "Korea"]}
        name="Chovy"
        shortName="CHV"
        status={<span className="np-meta">Active</span>}
      />
    </Canvas>
  ),
};

export const TeamDirectoryCard: Story = {
  name: "TeamCard",
  render: () => (
    <Canvas label="Team card">
      <TeamCard
        detail="LCK · Active roster"
        href="#"
        statistics={[
          { label: "Match win rate", value: "72.4%" },
          { label: "World rank", value: "#1" },
        ]}
        team={{ name: "Gen.G", shortName: "GEN" }}
      />
    </Canvas>
  ),
};

export const PlayerDirectoryCard: Story = {
  name: "PlayerCard",
  render: () => (
    <Canvas label="Player card">
      <PlayerCard
        href="#"
        player={{ fullName: "Jeong Ji-hoon", handle: "Chovy", role: "Mid" }}
        statistics={[
          { label: "KDA", value: "4.8" },
          { label: "Win rate", value: "74.2%" },
        ]}
        team="Gen.G"
      />
    </Canvas>
  ),
};

export const DirectoryStates: Story = {
  name: "DirectoryList",
  render: () => (
    <Canvas label="Directory list">
      <div className="np-review__stack">
        <DirectoryList count={2} label="Tier-1 teams">
          <TeamCard href="#" team={{ name: "Gen.G", shortName: "GEN" }} />
          <TeamCard href="#" team={{ name: "T1", shortName: "T1" }} />
        </DirectoryList>
        <DirectoryList label="Filtered teams" state="empty" />
        <DirectoryList label="Provider results" state="partial">
          <TeamCard href="#" team={{ name: "Bilibili Gaming", shortName: "BLG" }} />
        </DirectoryList>
      </div>
    </Canvas>
  ),
};

const searchGroups = [
  {
    id: "teams",
    label: "Teams",
    results: [{ href: "#", name: "Gen.G", shortName: "GEN", type: "team" as const }],
  },
  {
    id: "players",
    label: "Players",
    results: [
      {
        description: "Mid · Gen.G",
        href: "#",
        name: "Chovy",
        shortName: "CHV",
        type: "player" as const,
      },
    ],
  },
];

export const GroupedDiscovery: Story = {
  name: "GroupedSearchResults",
  render: () => (
    <Canvas label="Grouped search results">
      <GroupedSearchResults groups={searchGroups} />
    </Canvas>
  ),
};
export const SearchSuggestions: Story = {
  name: "SearchAutocomplete",
  render: () => (
    <Canvas label="Search autocomplete">
      <SearchAutocomplete onQueryChange={noopValue} query="gen" state="results">
        <GroupedSearchResults groups={searchGroups} />
      </SearchAutocomplete>
    </Canvas>
  ),
};
export const RecentSearches: Story = {
  name: "SearchAutocomplete — recent searches",
  render: () => (
    <Canvas label="Recent searches">
      <SearchAutocomplete
        onQueryChange={noopValue}
        query=""
        recent={["Gen.G", "Worlds 2026", "Chovy"]}
      />
    </Canvas>
  ),
};

export const PlayerHistory: Story = {
  name: "AffiliationTimeline",
  render: () => (
    <Canvas label="Affiliation timeline">
      <AffiliationTimeline
        affiliations={[
          { current: true, name: "Gen.G", shortName: "GEN", start: "2021" },
          { end: "2021", name: "DRX", shortName: "DRX", start: "2019" },
          { end: "2019", name: "Griffin", shortName: "GRF", start: "2017" },
        ]}
      />
    </Canvas>
  ),
};

export const PlayerHandleHistory: Story = {
  name: "HandleTimeline",
  render: () => (
    <Canvas label="Handle timeline">
      <HandleTimeline
        handles={[
          {
            current: true,
            dates: "01/01/2026 — Present",
            handle: "Current Handle",
            shortName: "CH",
          },
          {
            dates: "01/01/2024 — 12/31/2025",
            handle: "Previous Handle",
            shortName: "PH",
          },
        ]}
      />
    </Canvas>
  ),
};

export const PlayerStatistics: Story = {
  name: "PlayerStatSummary",
  render: () => (
    <Canvas label="Player stat summary">
      <PlayerStatSummary
        stats={[
          { label: "KDA", rank: "#1 LCK", value: "4.8" },
          { detail: "Spring + Summer", label: "Games", value: "96" },
          { label: "Gold diff @15", rank: "#2 LCK", value: "+412" },
          { label: "Kill participation", value: "67.4%" },
        ]}
      />
    </Canvas>
  ),
};

export const PlayerRankings: Story = {
  name: "PlayerRankingTable",
  render: () => (
    <Canvas label="Player ranking table">
      <PlayerRankingTable
        caption="Mid lane KDA · 2026 season"
        rows={[
          {
            id: "1",
            player: { handle: "Chovy", role: "Mid" },
            rank: 1,
            team: "Gen.G",
            value: "4.8",
          },
          { id: "2", player: { handle: "Faker", role: "Mid" }, rank: 2, team: "T1", value: "4.2" },
        ]}
      />
    </Canvas>
  ),
};

export const LiveScore: Story = {
  name: "LiveScoreboard",
  render: () => (
    <Canvas label="Live scoreboard">
      <LiveScoreboard
        gameTime="31:24"
        teams={[
          {
            gold: "52.1k",
            kills: 14,
            name: "Gen.G",
            objectives: 4,
            score: 2,
            shortName: "GEN",
            side: "blue",
            towers: 8,
          },
          {
            gold: "47.8k",
            kills: 9,
            name: "T1",
            objectives: 2,
            score: 1,
            shortName: "T1",
            side: "red",
            towers: 4,
          },
        ]}
      />
    </Canvas>
  ),
};

const liveRows = [
  {
    champion: "Azir",
    cs: 312,
    damage: "24.8k",
    gold: "13.2k",
    id: "chovy",
    kda: "5/1/7",
    player: { handle: "Chovy", role: "Mid" },
  },
  {
    champion: "Orianna",
    cs: 286,
    damage: "19.1k",
    gold: "11.8k",
    id: "faker",
    kda: "3/2/6",
    player: { handle: "Faker", role: "Mid" },
  },
];
export const LivePlayerStats: Story = {
  name: "PlayerLiveStatTable",
  render: () => (
    <Canvas label="Player live stat table">
      <PlayerLiveStatTable caption="Game 4 live player statistics" rows={liveRows} />
    </Canvas>
  ),
};

export const FixtureGameInsights: Story = {
  name: "Game insight fixture composition",
  render: () => (
    <Canvas label="Fixture game insights">
      <section aria-label="Game insights" className="np-game-insights">
        <header className="np-game-insights__heading">
          <div>
            <span className="np-eyebrow">Game 4</span>
            <h2>Game Insights</h2>
          </div>
        </header>
        <MatchSourceStatus
          lastUpdated="15 second delay · update 4"
          provider="Licensed telemetry"
          state="fresh"
        />
        <LiveScoreboard
          gameTime="31:24"
          teams={[
            {
              gold: "52.1k",
              kills: 14,
              name: "T1",
              objectives: 4,
              score: 1,
              shortName: "T1",
              side: "blue",
              towers: 8,
            },
            {
              gold: "47.8k",
              kills: 9,
              name: "Gen.G",
              objectives: 2,
              score: 1,
              shortName: "GEN",
              side: "red",
              towers: 4,
            },
          ]}
        />
        <PickBan
          gameLabel="Game 4"
          sides={[
            {
              bans: [{ action: "ban", champion: "Aurora", order: 1 }],
              name: "T1",
              picks: [{ champion: "Azir", order: 5, player: "T1 Mid" }],
            },
            {
              bans: [{ action: "ban", champion: "Vi", order: 2 }],
              name: "Gen.G",
              picks: [{ champion: "Orianna", order: 6, player: "GEN Mid" }],
            },
          ]}
          status="live"
        />
        <section aria-labelledby="fixture-final-lineup" className="np-game-insights__lineup">
          <h3 id="fixture-final-lineup">Final Lineup</h3>
          <PlayerLiveStatTable
            caption="Game 4 final lineup and live player statistics"
            rows={liveRows.map((row) => ({
              ...row,
              player: { ...row.player, href: `/players/${row.id}` },
            }))}
          />
        </section>
      </section>
    </Canvas>
  ),
};

export const ObjectiveTimeline: Story = {
  name: "ObjectiveStrip",
  render: () => (
    <Canvas label="Objective strip">
      <ObjectiveStrip
        events={[
          { id: "1", label: "First blood", team: "GEN", time: "03:42", tone: "danger" },
          { id: "2", label: "Dragon", team: "T1", time: "06:18", tone: "info" },
          { id: "3", label: "Herald", team: "GEN", time: "10:04", tone: "success" },
          { id: "4", label: "Baron", team: "GEN", time: "27:16", tone: "warning" },
        ]}
      />
    </Canvas>
  ),
};

export const SeriesProgress: Story = {
  name: "SeriesTimeline",
  render: () => (
    <Canvas label="Series timeline">
      <SeriesTimeline
        games={[
          { duration: "32:18", id: "1", label: "Game 1", state: "final", winner: "GEN" },
          { duration: "36:42", id: "2", label: "Game 2", state: "final", winner: "T1" },
          { id: "3", label: "Game 3", state: "live" },
          { id: "4", label: "Game 4", state: "scheduled" },
        ]}
      />
    </Canvas>
  ),
};

export const LiveDataStates: Story = {
  name: "LiveDataGate",
  render: () => (
    <Canvas label="Live data gates">
      <div className="np-review__stack">
        <LiveDataGate state="unavailable" />
        <LiveDataGate onRetry={noop} state="disconnected" />
        <LiveDataGate state="paused" />
      </div>
    </Canvas>
  ),
};

export const EventStages: Story = {
  name: "EventStageNavigation",
  render: () => (
    <Canvas label="Event stage navigation">
      <EventStageNavigation
        activeId="playoffs"
        onSelect={noopValue}
        stages={[
          { id: "play-in", label: "Play-in", status: "complete" },
          { id: "swiss", label: "Swiss", status: "complete" },
          { count: 8, id: "playoffs", label: "Playoffs", status: "live" },
          { id: "final", label: "Final", status: "upcoming" },
        ]}
      />
    </Canvas>
  ),
};

const standingRows = [
  {
    differential: 5,
    form: ["W", "W", "W"] as const,
    id: "gen",
    losses: 0,
    points: 9,
    rank: 1,
    team: { name: "Gen.G", shortName: "GEN" },
    wins: 3,
  },
  {
    differential: 1,
    form: ["W", "L", "W"] as const,
    id: "t1",
    losses: 1,
    points: 6,
    rank: 2,
    team: { name: "T1", shortName: "T1" },
    wins: 2,
  },
];
export const GroupStandings: Story = {
  name: "GroupStandingsTable",
  render: () => (
    <Canvas label="Group standings">
      <GroupStandingsTable caption="Worlds 2026 · Group A" rows={standingRows} />
    </Canvas>
  ),
};

const bracketMatch = {
  bestOf: 5 as const,
  date: "Oct 30 · 18:00",
  id: "sf1",
  lifecycle: "scheduled" as const,
  seed: "1 vs 4",
  teams,
};
export const DoubleEliminationBracket: Story = {
  name: "TournamentBracket",
  render: () => (
    <Canvas label="Tournament bracket">
      <TournamentBracket
        lanes={[
          {
            id: "upper",
            label: "Upper bracket",
            rounds: [
              { id: "upper-sf", label: "Semifinals", matches: [bracketMatch] },
              {
                id: "upper-final",
                label: "Upper final",
                matches: [
                  {
                    ...bracketMatch,
                    id: "uf",
                    teams: [
                      { name: "TBD", shortName: "TBD" },
                      { name: "TBD", shortName: "TBD" },
                    ],
                  },
                ],
              },
            ],
          },
          {
            id: "lower",
            label: "Lower bracket",
            rounds: [
              { id: "lower-1", label: "Round 1", matches: [{ ...bracketMatch, id: "lr1" }] },
            ],
          },
        ]}
        onMatchSelect={noopValue}
        title="Worlds 2026 playoffs"
      />
    </Canvas>
  ),
};

const broadcasts = [
  {
    id: "en",
    label: "Worlds main broadcast",
    language: "English",
    provider: "Twitch",
    state: "live" as const,
  },
  {
    id: "ko",
    label: "LCK broadcast",
    language: "Korean",
    provider: "YouTube",
    state: "live" as const,
  },
  {
    id: "vod",
    label: "Game 3 replay",
    language: "English",
    provider: "YouTube",
    state: "replay" as const,
  },
];
export const BroadcastOptions: Story = {
  name: "BroadcastSelector",
  render: () => (
    <Canvas label="Broadcast selector">
      <BroadcastSelector broadcasts={broadcasts} onSelect={noopValue} selectedId="en" />
    </Canvas>
  ),
};

export const StreamStates: Story = {
  name: "StreamStatePanel",
  render: () => (
    <Canvas label="Stream states">
      <div className="np-review__stack">
        <StreamStatePanel provider="Twitch" state="live">
          <strong>Official stream player</strong>
        </StreamStatePanel>
        <StreamStatePanel
          actions={<Button>Load Provider</Button>}
          provider="Twitch"
          state="consent"
        />
        <StreamStatePanel provider="YouTube" state="geo-blocked" />
      </div>
    </Canvas>
  ),
};

export const LicensedFeedGate: Story = {
  name: "EsportsFeatureGate",
  render: () => (
    <Canvas label="Feature gate">
      <EsportsFeatureGate enabled={false} feature="Live pick/ban" />
    </Canvas>
  ),
};
export const DirectoryActionCluster: Story = {
  name: "DirectoryIntroActions",
  render: () => (
    <Canvas label="Directory intro actions">
      <DirectoryIntroActions>
        <Button>Browse Teams</Button>
        <Button variant="ghost">Browse Players</Button>
      </DirectoryIntroActions>
    </Canvas>
  ),
};
export const OfficialStreamLink: Story = {
  name: "StreamPlayAction",
  render: () => (
    <Canvas label="Stream play action">
      <StreamPlayAction href="#" />
    </Canvas>
  ),
};
