import type { Meta, StoryObj } from "@storybook/react-vite";

import { TeamIdentity } from "./esports.js";
import { ShareBar, SideName, SidePair, TeamSideHeader } from "./game.js";
import { Panel } from "./layout.js";

import "./review.stories.css";

const teams = [
  { name: "Bilibili Gaming", side: "blue" as const, share: 0.272 },
  { name: "Hanwha Life Esports", side: "red" as const, share: 0.198 },
];

function GameGallery() {
  return (
    <main className="np-review">
      <div className="np-review__inner">
        <header className="np-review__masthead">
          <div>
            <span className="np-eyebrow">Components / Game</span>
            <h1>Game sides</h1>
          </div>
          <p>Blue and red halves of one game, facing each other once there is room for both.</p>
        </header>

        <section className="np-review__section">
          <header className="np-review__section-header">
            <span className="np-eyebrow">SideName</span>
            <h2>Teams by side</h2>
          </header>
          <div className="np-review__stage">
            <h3>
              <SideName side="blue">Bilibili Gaming</SideName> vs{" "}
              <SideName side="red">Hanwha Life Esports</SideName> vs <SideName>TBD</SideName>
            </h3>
          </div>
        </section>

        <section className="np-review__section">
          <header className="np-review__section-header">
            <span className="np-eyebrow">SidePair + TeamSideHeader</span>
            <h2>Mirrored halves</h2>
          </header>
          <SidePair label="Lineups">
            {teams.map((team) => (
              <Panel aria-label={team.name} key={team.side} padding="none" side={team.side}>
                <TeamSideHeader side={team.side}>
                  <TeamIdentity name={team.name} shortName={team.name} size="compact" />
                </TeamSideHeader>
                <p style={{ padding: 12 }}>Team totals and lineup sit below the header.</p>
              </Panel>
            ))}
          </SidePair>
        </section>

        <section className="np-review__section">
          <header className="np-review__section-header">
            <span className="np-eyebrow">ShareBar</span>
            <h2>Shares growing toward the middle</h2>
          </header>
          <div className="np-review__stage" style={{ display: "grid", gap: 12, maxWidth: 480 }}>
            {teams.map((team) => (
              <div
                key={team.side}
                style={{ display: "grid", gap: 8, gridTemplateColumns: "1fr 1fr" }}
              >
                <ShareBar from="end" side="blue" value={team.share} />
                <ShareBar side="red" value={team.share * 0.8} />
              </div>
            ))}
            <ShareBar value={0.5} />
          </div>
        </section>
      </div>
    </main>
  );
}

const meta = {
  component: GameGallery,
  parameters: { layout: "fullscreen" },
  title: "Components/Game sides",
} satisfies Meta<typeof GameGallery>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Overview: Story = {};
