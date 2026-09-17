import type { ReactNode } from "react";
import type { Meta } from "@storybook/react-vite";

import { MetaText } from "./primitives.js";
import {
  CalibrationChart,
  ConfidenceInterval,
  CS2PlayerStatsTable,
  CS2TitleIcon,
  EconomyLoadoutStrip,
  EconomyStrip,
  GameTitleSwitcher,
  LeagueTitleIcon,
  LoadoutStrip,
  MapSeriesScore,
  MapVeto,
  ModelSource,
  PredictionDisclaimer,
  PredictionGuardrail,
  PredictionLoading,
  PredictionPanel,
  PredictionProbability,
  PredictionQualitySummary,
  PredictionTitleIcon,
  PredictionUnavailable,
  RoundScoreboard,
  StaleModelNotice,
} from "./v2.js";
import type { LoadoutPlayer } from "./v2.js";
import "./review.stories.css";
import "./v2.css";

const noop = () => undefined;
const players: readonly LoadoutPlayer[] = [
  {
    armor: 100,
    defuseKit: true,
    handle: "apEX",
    hasHelmet: true,
    money: 850,
    primary: "AK-47",
    secondary: "Glock-18",
    utility: 3,
  },
  {
    armor: 100,
    handle: "ZywOo",
    hasHelmet: true,
    money: 1200,
    primary: "AWP",
    secondary: "P250",
    utility: 2,
  },
  {
    alive: false,
    armor: 72,
    handle: "mezii",
    hasHelmet: true,
    money: 2300,
    primary: "M4A1-S",
    secondary: "USP-S",
    utility: 0,
  },
];
const outcomes = [
  { colorIndex: 1 as const, id: "vitality", label: "Vitality wins", probability: 0.63 },
  { colorIndex: 2 as const, id: "spirit", label: "Spirit wins", probability: 0.37 },
];
const bins = [
  { actual: 0.08, id: "10", predicted: 0.1, sampleSize: 84 },
  { actual: 0.34, id: "30", predicted: 0.3, sampleSize: 111 },
  { actual: 0.52, id: "50", predicted: 0.5, sampleSize: 130 },
  { actual: 0.73, id: "70", predicted: 0.7, sampleSize: 104 },
  { actual: 0.88, id: "90", predicted: 0.9, sampleSize: 62 },
];
const model = {
  evaluatedAt: "2026-07-09T12:00:00Z",
  evaluatedLabel: "Yesterday",
  model: "Series outcome model",
  sampleSize: 920,
  source: "Verified historical match data",
  sourceHref: "/methodology/data-sources",
  version: "cs2-series-0.4.2",
};
const interval = {
  confidence: 95,
  higherLabel: "Vitality",
  lower: 0.55,
  lowerLabel: "Spirit",
  point: 0.63,
  upper: 0.7,
};

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
  title: "Component Inventory/07 V2 Exploration",
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

export const GameTitleSwitcherReview = review(
  "GameTitleSwitcher",
  <GameTitleSwitcher
    onChange={noop}
    titles={[
      {
        description: "Schedules, live games, teams, and players",
        icon: <LeagueTitleIcon />,
        id: "lol",
        label: "League of Legends",
        shortLabel: "League",
      },
      {
        meta: <MetaText tone="accent">V2</MetaText>,
        description: "Map vetoes, rounds, economy, and player stats",
        icon: <CS2TitleIcon />,
        id: "cs2",
        label: "Counter-Strike 2",
        shortLabel: "CS2",
      },
    ]}
    value="cs2"
  />,
);
export const MapVetoReview = review(
  "MapVeto",
  <MapVeto
    bestOf={3}
    steps={[
      { action: "ban", id: "1", map: "Vertigo", team: "Vitality" },
      { action: "ban", id: "2", map: "Ancient", team: "Spirit" },
      { action: "pick", id: "3", map: "Dust II", side: "CT", team: "Vitality" },
      { action: "pick", id: "4", map: "Nuke", side: "T", team: "Spirit" },
      { action: "decider", id: "5", map: "Mirage" },
    ]}
  />,
);
export const MapSeriesScoreReview = review(
  "MapSeriesScore",
  <MapSeriesScore
    bestOf={3}
    games={[
      { id: "dust2", map: "Dust II", scoreA: 13, scoreB: 9, state: "complete" },
      { id: "nuke", map: "Nuke", scoreA: 7, scoreB: 8, state: "live" },
      { id: "mirage", map: "Mirage", state: "scheduled" },
    ]}
    scoreA={1}
    scoreB={0}
    teamA="Vitality"
    teamB="Spirit"
  />,
);
export const RoundScoreboardReview = review(
  "RoundScoreboard",
  <RoundScoreboard
    phase="live"
    round={16}
    teamA={{ equipmentValue: 24300, name: "Vitality", score: 7, side: "CT", timeouts: 3 }}
    teamB={{ equipmentValue: 21750, name: "Spirit", score: 8, side: "T", timeouts: 2 }}
    timer="1:18"
  />,
);
export const EconomyStripReview = review(
  "EconomyStrip",
  <EconomyStrip
    teams={[
      { equipmentValue: 24300, lossBonus: 1400, money: 5400, name: "Vitality", state: "buy" },
      { equipmentValue: 21750, lossBonus: 1900, money: 3550, name: "Spirit", state: "force" },
    ]}
  />,
);
export const LoadoutStripReview = review(
  "LoadoutStrip",
  <LoadoutStrip players={players} side="CT" team="Vitality" />,
);
export const EconomyLoadoutStripReview = review(
  "EconomyLoadoutStrip",
  <EconomyLoadoutStrip
    players={players}
    side="CT"
    team="Vitality"
    teamEconomy={{ equipmentValue: 24300, money: 5400, name: "Vitality", state: "buy" }}
  />,
);
export const CS2PlayerStatsTableReview = review(
  "CS2PlayerStatsTable",
  <CS2PlayerStatsTable
    onSort={noop}
    rows={[
      {
        adr: 101.4,
        assists: 5,
        deaths: 10,
        handle: "ZywOo",
        headshots: 38,
        id: "1",
        kast: 82,
        kd: 1.8,
        kills: 18,
        rating: 1.42,
        team: "Vitality",
      },
      {
        adr: 96.8,
        assists: 3,
        deaths: 12,
        handle: "donk",
        headshots: 67,
        id: "2",
        kast: 78,
        kd: 1.42,
        kills: 17,
        rating: 1.31,
        team: "Spirit",
      },
    ]}
    sort={{ direction: "descending", key: "rating" }}
  />,
  1100,
);
export const PredictionProbabilityReview = review(
  "PredictionProbability",
  <PredictionProbability outcomes={outcomes} title="Series winner" />,
);
export const ConfidenceIntervalReview = review(
  "ConfidenceInterval",
  <ConfidenceInterval
    confidence={90}
    higherLabel="Vitality"
    lower={0.57}
    lowerLabel="Spirit"
    point={0.63}
    upper={0.68}
  />,
);
export const CalibrationChartReview = review(
  "CalibrationChart",
  <CalibrationChart bins={bins} calibrationError={0.032} />,
);
export const ModelSourceReview = review("ModelSource", <ModelSource {...model} />);
export const PredictionDisclaimerReview = review("PredictionDisclaimer", <PredictionDisclaimer />);
export const PredictionPanelReview = review(
  "PredictionPanel",
  <PredictionPanel interval={interval} model={model} outcomes={outcomes} title="Vitality vs Spirit">
    <PredictionQualitySummary brierScore={0.184} calibrationError={0.032} sampleSize={920} />
  </PredictionPanel>,
);
export const PredictionUnavailableReview = review(
  "PredictionUnavailable",
  <PredictionUnavailable
    onRetry={noop}
    reason="Required roster inputs are incomplete, so the model declined to generate an estimate."
  />,
);
export const PredictionLoadingReview = review("PredictionLoading", <PredictionLoading />);
export const StaleModelNoticeReview = review(
  "StaleModelNotice",
  <StaleModelNotice
    ageLabel="36 hours ago"
    lastEvaluatedAt="2026-07-09T06:00:00Z"
    onRefresh={noop}
    thresholdLabel="12 hours"
    version="cs2-series-0.4.1"
  />,
);
export const PredictionQualitySummaryReview = review(
  "PredictionQualitySummary",
  <PredictionQualitySummary brierScore={0.184} calibrationError={0.032} sampleSize={920} />,
);
export const PredictionGuardrailReview = review(
  "PredictionGuardrail",
  <PredictionGuardrail
    checks={[
      { id: "license", label: "Feature data license permits model use", passed: true },
      { id: "fresh", label: "Roster and map pool are current", passed: false },
      { id: "calibration", label: "Calibration remains within release threshold", passed: true },
    ]}
  />,
);
export const CS2TitleIconReview = review("CS2TitleIcon", <CS2TitleIcon />, 240);
export const LeagueTitleIconReview = review("LeagueTitleIcon", <LeagueTitleIcon />, 240);
export const PredictionTitleIconReview = review(
  "PredictionTitleIcon",
  <PredictionTitleIcon />,
  240,
);
