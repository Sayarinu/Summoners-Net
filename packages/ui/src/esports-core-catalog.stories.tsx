import type { ReactNode } from "react";
import type { Meta } from "@storybook/react-vite";

import {
  BracketShell,
  ChampionPick,
  CompetitionIdentity,
  DateRail,
  EntityDirectoryIntro,
  EventHeader,
  FilterBar,
  MatchCard,
  MatchRow,
  PickBan,
  PlayerIdentity,
  RosterRow,
  ScheduleGroup,
  SearchResult,
  SpoilerControl,
  StandingsTable,
  StreamConsent,
  StreamEmbedShell,
  TeamIdentity,
} from "./esports.js";
import type { MatchDisplay } from "./esports.js";
import { SearchInput } from "./forms.js";
import { Button } from "./primitives.js";
import "./review.stories.css";

const noop = () => undefined;

const match: MatchDisplay = {
  bestOf: 3,
  classification: "official",
  competition: "Worlds 2026 · Swiss",
  href: "#match",
  id: "match-7F2A",
  lifecycle: "live",
  region: "International",
  scheduledLabel: "Game 2 · 24:18",
  sourceFreshness: "fresh",
  streamAvailable: true,
  streamHref: "#stream",
  teams: [
    { name: "Gen.G", score: 1, shortName: "GEN" },
    { name: "T1", score: 0, shortName: "T1" },
  ],
};

const picks = ["Renekton", "Maokai", "Orianna", "Kai'Sa", "Nautilus"].map((champion, index) => ({
  champion,
  order: index + 1,
  player: ["Kiin", "Canyon", "Chovy", "Ruler", "Duro"][index] ?? "Unknown",
}));

function ReviewStage({
  children,
  width = 900,
}: {
  readonly children: ReactNode;
  readonly width?: number;
}) {
  return (
    <main className="np-review">
      <div className="np-review__inner">
        <div className="np-review__stage" style={{ maxWidth: width }}>
          {children}
        </div>
      </div>
    </main>
  );
}

const meta = {
  parameters: { layout: "fullscreen" },
  title: "Component Inventory/02 V1 Esports Core",
} satisfies Meta;

export default meta;
interface ReviewStory {
  readonly name: string;
  readonly render: () => ReactNode;
}
// Inventory invariant: the first argument names exactly one public rendered export.
const review = (name: string, node: ReactNode, width?: number): ReviewStory => ({
  name,
  render: () => <ReviewStage {...(width === undefined ? {} : { width })}>{node}</ReviewStage>,
});

export const CompetitionIdentityReview = review(
  "CompetitionIdentity",
  <CompetitionIdentity
    name="League of Legends Champions Korea"
    region="Korea"
    shortName="LCK"
    tier="Tier 1"
  />,
);
export const TeamIdentityReview = review(
  "TeamIdentity",
  <TeamIdentity detail="LCK · Seed 1" name="Gen.G" shortName="GEN" />,
);
export const PlayerIdentityReview = review(
  "PlayerIdentity",
  <PlayerIdentity country="Korea" fullName="Jeong Ji-hoon" handle="Chovy" role="Mid" />,
);
export const RosterRowReview = review(
  "RosterRow",
  <RosterRow
    actions={<Button size="compact">Stats</Button>}
    detail="71.4% win rate · 5.8 KDA"
    player={{ handle: "Kiin", role: "Top" }}
    status="starter"
  />,
);
export const MatchRowReview = review("MatchRow", <MatchRow match={match} />, 1100);
export const MatchCardReview = review("MatchCard", <MatchCard match={match} />, 560);
export const ScheduleGroupReview = review(
  "ScheduleGroup",
  <ScheduleGroup
    count={2}
    dateLabel="Friday, July 11"
    description="Times shown in America/New_York"
  >
    <MatchRow match={match} />
    <MatchRow
      match={{ ...match, id: "match-2", lifecycle: "scheduled", scheduledLabel: "21:00 EDT" }}
    />
  </ScheduleGroup>,
  1100,
);
export const DateRailReview = review(
  "DateRail",
  <DateRail
    items={[
      { count: 3, day: "Thu", id: "jul-10", label: "Jul 10" },
      { count: 5, day: "Fri", id: "jul-11", label: "Jul 11", today: true },
      { count: 8, day: "Sat", id: "jul-12", label: "Jul 12" },
    ]}
    onChange={noop}
    selectedId="jul-11"
  />,
);
export const EventHeaderReview = review(
  "EventHeader",
  <EventHeader
    actions={<Button>Official Site</Button>}
    dates="September 24 — November 7"
    format="Swiss + knockout"
    name="World Championship 2026"
    region="International"
    shortName="W26"
    status="live"
    tier="Tier 1"
  />,
  1100,
);
export const StandingsTableReview = review(
  "StandingsTable",
  <StandingsTable
    caption="Worlds 2026 Swiss standings"
    rows={[
      {
        id: "gen",
        losses: 0,
        points: 9,
        position: 1,
        qualified: true,
        team: { name: "Gen.G", shortName: "GEN" },
        wins: 3,
      },
      {
        id: "t1",
        losses: 1,
        points: 6,
        position: 2,
        qualified: true,
        team: { name: "T1", shortName: "T1" },
        wins: 3,
      },
    ]}
  />,
);
export const BracketShellReview = review(
  "BracketShell",
  <BracketShell
    activeRound="semis"
    onMatchSelect={noop}
    onRoundSelect={noop}
    rounds={[
      {
        id: "quarters",
        label: "Quarterfinals",
        matches: [
          {
            id: "q1",
            lifecycle: "final",
            teams: [
              { name: "Gen.G", score: 2, shortName: "GEN", winner: true },
              { name: "FlyQuest", score: 0, shortName: "FLY" },
            ],
          },
        ],
      },
      {
        id: "semis",
        label: "Semifinals",
        matches: [{ id: "s1", lifecycle: "live", teams: match.teams }],
      },
    ]}
    title="Worlds 2026 knockout"
  />,
  1100,
);
export const ChampionPickReview = review(
  "ChampionPick",
  <ChampionPick action="pick" champion="Orianna" order={3} player="Chovy" />,
);
export const PickBanReview = review(
  "PickBan",
  <PickBan
    gameLabel="Game 2"
    sides={[
      { bans: [{ action: "ban", champion: "Rumble" }], name: "Gen.G · Blue side", picks },
      {
        bans: [{ action: "ban", champion: "Aurora" }],
        name: "T1 · Red side",
        picks: picks.map((pick) => ({ ...pick, player: `T1 ${pick.player}` })),
      },
    ]}
    status="live"
  />,
  1100,
);
export const SearchResultReview = review(
  "SearchResult",
  <SearchResult
    description="Mid · Gen.G"
    href="#"
    meta="Player"
    name="Chovy"
    shortName="CHV"
    type="player"
  />,
);
export const FilterBarReview = review(
  "FilterBar",
  <FilterBar
    applied={[
      { id: "tier", label: "Tier 1" },
      { id: "region", label: "LCK" },
    ]}
    onClearAll={noop}
    onOpenFilters={noop}
    onRemove={noop}
    resultCount={24}
  >
    Active rosters
  </FilterBar>,
);
export const StreamConsentReview = review(
  "StreamConsent",
  <StreamConsent onAccept={noop} onDecline={noop} privacyHref="#" provider="Twitch" />,
);
export const StreamEmbedShellReview = review(
  "StreamEmbedShell",
  <StreamEmbedShell provider="Twitch" title="Worlds 2026 official stream">
    <div className="np-review__fake-stream">
      <strong>OFFICIAL LIVE FEED</strong>
      <span>GEN vs T1 · Game 2</span>
    </div>
  </StreamEmbedShell>,
  1100,
);
export const StreamReplayShellReview = review(
  "StreamEmbedShell / Replay",
  <StreamEmbedShell mode="replay" provider="YouTube" title="Worlds 2026 replay">
    <div className="np-review__fake-stream">
      <strong>OFFICIAL REPLAY</strong>
      <span>GEN vs T1 · Game 2</span>
    </div>
  </StreamEmbedShell>,
  1100,
);
export const SpoilerControlReview = review(
  "SpoilerControl",
  <SpoilerControl hidden onHiddenChange={noop} onReveal={noop} />,
);
export const EntityDirectoryIntroReview = review(
  "EntityDirectoryIntro",
  <EntityDirectoryIntro>
    <SearchInput label="Search directory" placeholder="Team or player" />
  </EntityDirectoryIntro>,
  1100,
);
