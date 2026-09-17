import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";

import {
  BracketShell,
  EntityDirectoryIntro,
  FilterBar,
  PickBan,
  SearchResult,
  SpoilerControl,
  StreamConsent,
  StreamEmbedShell,
} from "./esports.js";
import { SearchInput } from "./forms.js";
import "./review.stories.css";

const noop = () => undefined;

const bracketTeams = {
  blg: { name: "Bilibili Gaming", score: 1, shortName: "BLG" },
  fly: { name: "FlyQuest", score: 0, shortName: "FLY" },
  gen: { name: "Gen.G", score: 2, shortName: "GEN", winner: true },
  g2: { name: "G2 Esports", score: 0, shortName: "G2" },
  hle: { name: "Hanwha Life Esports", score: 1, shortName: "HLE" },
  t1: { name: "T1", score: 2, shortName: "T1", winner: true },
};

const picks = ["Renekton", "Maokai", "Orianna", "Kai'Sa", "Nautilus"].map((champion, index) => ({
  champion,
  order: index + 1,
  player: ["Kiin", "Canyon", "Chovy", "Ruler", "Duro"][index] ?? "Unknown",
}));
const opponentPicks = ["Jax", "Sejuani", "Azir", "Xayah", "Rakan"].map((champion, index) => ({
  champion,
  order: index + 1,
  player: ["Zeus", "Oner", "Faker", "Gumayusi", "Keria"][index] ?? "Unknown",
}));

function AdvancedEsportsGallery() {
  const [spoilers, setSpoilers] = useState(true);

  return (
    <main className="np-review">
      <div className="np-review__inner">
        <header className="np-review__masthead">
          <div>
            <span className="np-eyebrow">Esports / 02</span>
            <h1>Live context & discovery</h1>
          </div>
          <p>
            Bracket, draft, search, filters, spoiler safety, consent, and stream failure handling.
          </p>
        </header>

        <section className="np-review__section">
          <header className="np-review__section-header">
            <span className="np-eyebrow">BracketShell</span>
            <h2>Ordered rounds</h2>
          </header>
          <BracketShell
            activeRound="semis"
            onMatchSelect={noop}
            onRoundSelect={noop}
            rounds={[
              {
                id: "quarters",
                label: "Quarterfinals",
                matches: [
                  { id: "q1", lifecycle: "final", teams: [bracketTeams.gen, bracketTeams.fly] },
                  { id: "q2", lifecycle: "final", teams: [bracketTeams.t1, bracketTeams.g2] },
                  { id: "q3", lifecycle: "final", teams: [bracketTeams.blg, bracketTeams.hle] },
                ],
              },
              {
                id: "semis",
                label: "Semifinals",
                matches: [
                  { id: "s1", lifecycle: "live", teams: [bracketTeams.gen, bracketTeams.t1] },
                  { id: "s2", lifecycle: "scheduled", teams: [bracketTeams.blg, bracketTeams.hle] },
                ],
              },
              {
                id: "final",
                label: "Final",
                matches: [
                  {
                    id: "f1",
                    lifecycle: "scheduled",
                    teams: [
                      { name: "TBD", shortName: "TBD" },
                      { name: "TBD", shortName: "TBD" },
                    ],
                  },
                ],
              },
            ]}
            title="Worlds 2026 knockout"
          />
        </section>

        <section className="np-review__section">
          <header className="np-review__section-header">
            <span className="np-eyebrow">PickBan + ChampionPick</span>
            <h2>League-only draft data</h2>
          </header>
          <div className="np-review__stack">
            <PickBan
              gameLabel="Game 2"
              sides={[
                {
                  bans: [
                    { action: "ban", champion: "Rumble" },
                    { action: "ban", champion: "Vi" },
                    { action: "ban", champion: "LeBlanc" },
                  ],
                  name: "Gen.G · Blue side",
                  picks,
                },
                {
                  bans: [
                    { action: "ban", champion: "Aurora" },
                    { action: "ban", champion: "Poppy" },
                    { action: "ban", champion: "Kalista" },
                  ],
                  name: "T1 · Red side",
                  picks: opponentPicks,
                },
              ]}
              status="live"
            />
            <div className="np-review__grid">
              <PickBan
                gameLabel="Game 3"
                sides={[
                  { bans: [], name: "Blue side", picks: [] },
                  { bans: [], name: "Red side", picks: [] },
                ]}
                status="unavailable"
              />
              <PickBan
                gameLabel="Game 1"
                sides={[
                  { bans: [], name: "Blue side", picks: [] },
                  { bans: [], name: "Red side", picks: [] },
                ]}
                spoilerHidden
              />
            </div>
          </div>
        </section>

        <section className="np-review__section">
          <header className="np-review__section-header">
            <span className="np-eyebrow">SearchResult + FilterBar</span>
            <h2>Cross-entity discovery</h2>
          </header>
          <div className="np-review__stack">
            <EntityDirectoryIntro>
              <SearchInput label="Search directory" placeholder="Team or player" />
            </EntityDirectoryIntro>
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
            </FilterBar>
            <div className="np-review__frame">
              <SearchResult
                description="LCK · Active roster"
                href="#"
                meta="Team"
                name="Gen.G"
                shortName="GEN"
                type="team"
              />
              <SearchResult
                description="Mid · Gen.G"
                href="#"
                meta="Player"
                name="Chovy"
                shortName="CHV"
                type="player"
              />
              <SearchResult
                description="Swiss stage · Live"
                href="#"
                meta="Event"
                name="World Championship 2026"
                shortName="W26"
                type="event"
              />
              <SearchResult
                description="Today · 18:00 EDT"
                href="#"
                meta="Match"
                name="Gen.G vs Bilibili Gaming"
                shortName="GEN"
                type="match"
              />
            </div>
          </div>
        </section>

        <section className="np-review__section">
          <header className="np-review__section-header">
            <span className="np-eyebrow">SpoilerControl</span>
            <h2>Persistent and one-time reveal</h2>
          </header>
          <SpoilerControl
            hidden={spoilers}
            onHiddenChange={setSpoilers}
            onReveal={() => setSpoilers(false)}
          />
        </section>

        <section className="np-review__section">
          <header className="np-review__section-header">
            <span className="np-eyebrow">StreamConsent</span>
            <h2>Privacy before embed</h2>
          </header>
          <StreamConsent onAccept={noop} onDecline={noop} privacyHref="#" provider="Twitch" />
        </section>

        <section className="np-review__section">
          <header className="np-review__section-header">
            <span className="np-eyebrow">StreamEmbedShell</span>
            <h2>Ready and failure states</h2>
          </header>
          <div className="np-review__grid np-review__grid--wide">
            <StreamEmbedShell provider="Twitch" title="Worlds 2026 official stream">
              <div className="np-review__fake-stream">
                <strong>OFFICIAL LIVE FEED</strong>
                <span>GEN vs T1 · Game 2</span>
              </div>
            </StreamEmbedShell>
            <StreamEmbedShell
              fallbackHref="#"
              provider="YouTube"
              state="blocked"
              title="YouTube stream blocked"
            />
            <StreamEmbedShell
              fallbackHref="#"
              onRetry={noop}
              provider="Twitch"
              state="failed"
              title="Twitch stream unavailable"
            />
            <StreamEmbedShell provider="Twitch" state="offline" title="Twitch stream offline" />
          </div>
        </section>
      </div>
    </main>
  );
}

const meta = {
  component: AdvancedEsportsGallery,
  parameters: { layout: "fullscreen" },
  title: "Esports/02 Live context and discovery",
} satisfies Meta<typeof AdvancedEsportsGallery>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Overview: Story = {};
