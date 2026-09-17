import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ReactNode } from "react";

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

const vitalityPlayers: readonly LoadoutPlayer[] = [
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
    armor: 100,
    defuseKit: true,
    handle: "flameZ",
    hasHelmet: true,
    money: 400,
    primary: "M4A1-S",
    secondary: "USP-S",
    utility: 4,
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
  {
    armor: 100,
    handle: "ropz",
    hasHelmet: true,
    money: 650,
    primary: "M4A4",
    secondary: "USP-S",
    utility: 3,
  },
];

const spiritPlayers: readonly LoadoutPlayer[] = [
  {
    armor: 100,
    handle: "chopper",
    hasHelmet: true,
    money: 300,
    primary: "AK-47",
    secondary: "Glock-18",
    utility: 3,
  },
  {
    armor: 100,
    handle: "donk",
    hasHelmet: true,
    money: 1700,
    primary: "AK-47",
    secondary: "Desert Eagle",
    utility: 2,
  },
  {
    armor: 100,
    handle: "sh1ro",
    hasHelmet: true,
    money: 250,
    primary: "AWP",
    secondary: "P250",
    utility: 2,
  },
  {
    armor: 100,
    handle: "zont1x",
    hasHelmet: true,
    money: 850,
    primary: "AK-47",
    secondary: "Glock-18",
    utility: 4,
  },
  {
    armor: 100,
    handle: "magixx",
    hasHelmet: true,
    money: 450,
    primary: "Galil AR",
    secondary: "Glock-18",
    utility: 3,
  },
];

function Canvas({
  children,
  index,
  summary,
  title,
}: {
  readonly children: ReactNode;
  readonly index: string;
  readonly summary: string;
  readonly title: string;
}) {
  return (
    <main className="np-review">
      <div className="np-review__inner">
        <header className="np-review__masthead">
          <div>
            <span className="np-eyebrow">V2 exploration / {index}</span>
            <h1>{title}</h1>
          </div>
          <p>{summary}</p>
        </header>
        {children}
      </div>
    </main>
  );
}

function Section({
  children,
  eyebrow,
  title,
}: {
  readonly children: ReactNode;
  readonly eyebrow: string;
  readonly title: string;
}) {
  return (
    <section className="np-review__section">
      <header className="np-review__section-header">
        <span className="np-eyebrow">{eyebrow}</span>
        <h2>{title}</h2>
      </header>
      <div className="np-review__content">{children}</div>
    </section>
  );
}

function CS2MatchGallery() {
  return (
    <Canvas
      index="01"
      summary="The title boundary stays explicit while the CS2 match surface adopts the same calm density, hierarchy, and evidence standards as League."
      title="One hub, distinct games"
    >
      <Section eyebrow="GameTitleSwitcher" title="Title context">
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
            {
              available: false,
              meta: <MetaText>Planned</MetaText>,
              description: "Not yet scheduled",
              id: "valorant",
              label: "VALORANT",
            },
          ]}
          value="cs2"
        />
      </Section>
      <Section eyebrow="MapVeto" title="Series preparation">
        <MapVeto
          bestOf={3}
          steps={[
            { action: "ban", id: "1", map: "Vertigo", team: "Vitality" },
            { action: "ban", id: "2", map: "Ancient", team: "Spirit" },
            { action: "pick", id: "3", map: "Dust II", side: "CT", team: "Vitality" },
            { action: "pick", id: "4", map: "Nuke", side: "T", team: "Spirit" },
            { action: "ban", id: "5", map: "Inferno", team: "Vitality" },
            { action: "ban", id: "6", map: "Anubis", team: "Spirit" },
            { action: "decider", id: "7", map: "Mirage" },
          ]}
        />
      </Section>
      <Section eyebrow="MapSeriesScore" title="Map progression">
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
        />
      </Section>
      <Section eyebrow="RoundScoreboard" title="Live round context">
        <div className="np-review__stack">
          <RoundScoreboard
            phase="live"
            round={16}
            teamA={{ equipmentValue: 24300, name: "Vitality", score: 7, side: "CT", timeouts: 3 }}
            teamB={{ equipmentValue: 21750, name: "Spirit", score: 8, side: "T", timeouts: 2 }}
            timer="1:18"
          />
          <RoundScoreboard
            phase="bomb-planted"
            round={16}
            teamA={{ equipmentValue: 24300, name: "Vitality", score: 7, side: "CT" }}
            teamB={{ equipmentValue: 21750, name: "Spirit", score: 8, side: "T" }}
            timer="0:31"
          />
        </div>
      </Section>
    </Canvas>
  );
}

function CS2EconomyGallery() {
  return (
    <Canvas
      index="02"
      summary="Economy, equipment, and player performance are scanned as operational rows, with game-specific color used only where it communicates side or state."
      title="Round-level intelligence"
    >
      <Section eyebrow="EconomyStrip" title="Buy decisions">
        <EconomyStrip
          teams={[
            { equipmentValue: 24300, lossBonus: 1400, money: 5400, name: "Vitality", state: "buy" },
            { equipmentValue: 21750, lossBonus: 1900, money: 3550, name: "Spirit", state: "force" },
          ]}
        />
      </Section>
      <Section eyebrow="EconomyLoadoutStrip" title="Team equipment">
        <div className="np-review__stack">
          <EconomyLoadoutStrip
            players={vitalityPlayers}
            side="CT"
            team="Vitality"
            teamEconomy={{ equipmentValue: 24300, money: 5400, name: "Vitality", state: "buy" }}
          />
          <LoadoutStrip players={spiritPlayers} side="T" team="Spirit" />
        </div>
      </Section>
      <Section eyebrow="CS2PlayerStatsTable" title="Map performance">
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
            {
              adr: 78.2,
              assists: 7,
              deaths: 13,
              handle: "ropz",
              headshots: 54,
              id: "3",
              kast: 74,
              kd: 1.08,
              kills: 14,
              rating: 1.12,
              team: "Vitality",
            },
            {
              adr: 72.7,
              assists: 4,
              deaths: 14,
              handle: "sh1ro",
              headshots: 31,
              id: "4",
              kast: 70,
              kd: 0.93,
              kills: 13,
              rating: 1.04,
              team: "Spirit",
            },
          ]}
          sort={{ direction: "descending", key: "rating" }}
        />
      </Section>
    </Canvas>
  );
}

const predictionOutcomes = [
  { colorIndex: 1 as const, id: "vitality", label: "Vitality wins", probability: 0.63 },
  { colorIndex: 2 as const, id: "spirit", label: "Spirit wins", probability: 0.37 },
];

const calibrationBins = [
  { actual: 0.08, id: "10", predicted: 0.1, sampleSize: 84 },
  { actual: 0.21, id: "20", predicted: 0.2, sampleSize: 96 },
  { actual: 0.34, id: "30", predicted: 0.3, sampleSize: 111 },
  { actual: 0.39, id: "40", predicted: 0.4, sampleSize: 124 },
  { actual: 0.52, id: "50", predicted: 0.5, sampleSize: 130 },
  { actual: 0.58, id: "60", predicted: 0.6, sampleSize: 118 },
  { actual: 0.73, id: "70", predicted: 0.7, sampleSize: 104 },
  { actual: 0.79, id: "80", predicted: 0.8, sampleSize: 91 },
  { actual: 0.88, id: "90", predicted: 0.9, sampleSize: 62 },
];

function PredictionGallery() {
  return (
    <Canvas
      index="03"
      summary="Every estimate is paired with uncertainty, calibration, evaluation context, source attribution, and language that prevents predictive analysis from masquerading as fact."
      title="Transparent probabilities"
    >
      <Section eyebrow="PredictionPanel" title="Complete estimate">
        <PredictionPanel
          interval={{
            confidence: 95,
            higherLabel: "Vitality",
            lower: 0.55,
            lowerLabel: "Spirit",
            point: 0.63,
            upper: 0.7,
          }}
          model={{
            evaluatedAt: "2026-07-09T12:00:00Z",
            evaluatedLabel: "Yesterday",
            model: "Series outcome model",
            sampleSize: 920,
            source: "Verified historical match data",
            sourceHref: "/methodology/data-sources",
            version: "cs2-series-0.4.2",
          }}
          outcomes={predictionOutcomes}
          title="Vitality vs Spirit"
        >
          <PredictionQualitySummary brierScore={0.184} calibrationError={0.032} sampleSize={920} />
        </PredictionPanel>
      </Section>
      <Section eyebrow="Probability + confidence" title="Atomic analysis">
        <div className="np-review__grid np-review__grid--wide">
          <PredictionProbability outcomes={predictionOutcomes} title="Series winner" />
          <ConfidenceInterval
            confidence={90}
            higherLabel="Vitality"
            lower={0.57}
            lowerLabel="Spirit"
            point={0.63}
            upper={0.68}
          />
        </div>
      </Section>
      <Section eyebrow="CalibrationChart" title="Observed model quality">
        <CalibrationChart bins={calibrationBins} calibrationError={0.032} />
      </Section>
      <Section eyebrow="ModelSource + disclaimer" title="Method and limits">
        <div className="np-review__stack">
          <ModelSource
            evaluatedAt="2026-07-09T12:00:00Z"
            evaluatedLabel="Yesterday"
            model="Series outcome model"
            sampleSize={920}
            source="Verified historical match data"
            sourceHref="/methodology/data-sources"
            version="cs2-series-0.4.2"
          />
          <PredictionDisclaimer />
        </div>
      </Section>
    </Canvas>
  );
}

function PredictionStatesGallery() {
  return (
    <Canvas
      index="04"
      summary="Loading, stale, unavailable, and withheld predictions preserve the rest of the match experience and explain why the estimate cannot be trusted."
      title="Fail closed, explain why"
    >
      <Section eyebrow="PredictionLoading" title="Pending estimate">
        <PredictionLoading />
      </Section>
      <Section eyebrow="StaleModelNotice" title="Freshness boundary">
        <StaleModelNotice
          ageLabel="36 hours ago"
          lastEvaluatedAt="2026-07-09T06:00:00Z"
          onRefresh={noop}
          thresholdLabel="12 hours"
          version="cs2-series-0.4.1"
        />
      </Section>
      <Section eyebrow="PredictionUnavailable" title="No trustworthy result">
        <div className="np-review__stack">
          <PredictionUnavailable
            onRetry={noop}
            reason="Required roster inputs are incomplete, so the model declined to generate an estimate."
          />
          <PredictionUnavailable />
        </div>
      </Section>
      <Section eyebrow="PredictionGuardrail" title="Release gates">
        <div className="np-review__grid np-review__grid--wide">
          <PredictionGuardrail
            checks={[
              { id: "license", label: "Feature data license permits model use", passed: true },
              { id: "fresh", label: "Roster and map pool are current", passed: true },
              {
                id: "calibration",
                label: "Calibration remains within release threshold",
                passed: true,
              },
            ]}
          />
          <PredictionGuardrail
            checks={[
              { id: "license", label: "Feature data license permits model use", passed: true },
              { id: "fresh", label: "Roster and map pool are current", passed: false },
              {
                id: "calibration",
                label: "Calibration remains within release threshold",
                passed: true,
              },
            ]}
          />
        </div>
      </Section>
      <Section eyebrow="Title boundary" title="Experimental navigation">
        <GameTitleSwitcher
          titles={[
            {
              icon: <LeagueTitleIcon />,
              id: "lol",
              label: "League of Legends",
              shortLabel: "League",
            },
            { icon: <CS2TitleIcon />, id: "cs2", label: "Counter-Strike 2", shortLabel: "CS2" },
            {
              meta: <MetaText tone="info">Experimental</MetaText>,
              description: "Informational model analysis",
              icon: <PredictionTitleIcon />,
              id: "prediction",
              label: "Prediction lab",
              shortLabel: "Models",
            },
          ]}
          value="prediction"
        />
      </Section>
    </Canvas>
  );
}

const meta = {
  parameters: { layout: "fullscreen" },
  title: "V2 Exploration/Component Galleries",
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const CS2MatchContext: Story = { render: () => <CS2MatchGallery /> };
export const CS2EconomyAndStats: Story = { render: () => <CS2EconomyGallery /> };
export const PredictionTransparency: Story = { render: () => <PredictionGallery /> };
export const PredictionStates: Story = { render: () => <PredictionStatesGallery /> };
