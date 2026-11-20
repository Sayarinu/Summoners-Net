import type { Meta, StoryObj } from "@storybook/react-vite";

import { PlayerIdentity, TeamIdentity, TeamVersus } from "./esports.js";
import { Input, Select } from "./forms.js";
import {
  Card,
  DisclosurePanel,
  FilterBar,
  PageHeader,
  Panel,
  Stat,
  StatGroup,
  TabNav,
} from "./layout.js";
import { Button } from "./primitives.js";
import "./review.stories.css";

const grid = { display: "grid", gap: 16, gridTemplateColumns: "repeat(2, minmax(0, 1fr))" };

function PageLayoutGallery() {
  return (
    <main className="np-review">
      <div className="np-review__inner np-review__stack">
        <PageHeader
          actions={<Button>Watch Game VOD</Button>}
          breadcrumbs={[{ href: "#", label: "Past Matches" }, { label: "Game 1" }]}
          eyebrow="Worlds · Round 5 · Oct 31, 2026 · Best of 3"
          title="Hanwha Life Esports vs Bilibili Gaming"
        >
          <TabNav
            items={[
              { href: "#overview", label: "Overview" },
              { current: true, href: "#game-1", label: "Game 1", meta: "41:51" },
              { href: "#game-2", label: "Game 2", meta: "32:44" },
              { disabled: true, href: "#game-3", label: "Game 3" },
            ]}
            label="Series"
          />
        </PageHeader>

        <FilterBar aria-label="Filters">
          <Input label="Filter Matches" name="q" placeholder="Filter..." type="search" />
          <Select
            defaultValue="all"
            label="League"
            name="league"
            options={[
              { label: "All Leagues", value: "all" },
              { label: "LCK", value: "LCK" },
            ]}
          />
        </FilterBar>

        <div style={grid}>
          <Panel side="blue" title="Blue Side">
            <StatGroup label="Blue side totals">
              <Stat label="Kills" size="sm" value="19" />
              <Stat label="Gold" size="sm" value="80,910" />
              <Stat label="Towers" size="sm" value="7" />
            </StatGroup>
          </Panel>
          <Panel side="red" title="Red Side">
            <StatGroup label="Red side totals">
              <Stat label="Kills" size="sm" value="18" />
              <Stat label="Gold" size="sm" value="78,899" />
              <Stat detail="Unknown in 2 games" label="Towers" size="sm" value="—" />
            </StatGroup>
          </Panel>
        </div>

        <Panel
          actions={
            <TabNav
              items={[
                { current: true, href: "#series", label: "Series" },
                { href: "#games", label: "Games" },
              ]}
              label="Past Matches View"
              variant="segmented"
            />
          }
          title="Season Performance"
        >
          <StatGroup>
            <Stat label="Win Rate" tone="success" value="71.2%" />
            <Stat label="KDA" value="4.73" />
            <Stat detail="12 games" label="Average Duration" size="lg" value="31:04" />
          </StatGroup>
        </Panel>

        <Panel padding="none" title="Games">
          <div style={{ padding: 16 }}>
            <TeamVersus
              teams={[
                { name: "Hanwha Life Esports", shortName: "HLE", side: "blue", size: "compact" },
                {
                  name: "Bilibili Gaming",
                  shortName: "BLG",
                  side: "red",
                  size: "compact",
                  winner: true,
                },
              ]}
            />
          </div>
        </Panel>

        <DisclosurePanel defaultOpen title="Timeline">
          <p>Opens on demand; the body only renders while open.</p>
        </DisclosurePanel>

        <Panel aria-label="Bilibili Gaming">
          <TeamIdentity detail="LPL" name="Bilibili Gaming" shortName="BLG" size="display" />
        </Panel>

        <ul
          style={{ ...grid, gridTemplateColumns: "repeat(4, minmax(0, 1fr))", listStyle: "none" }}
        >
          <li>
            <Card href="#team">
              <TeamIdentity detail="LCK" name="Gen.G" shortName="GEN" size="large" />
            </Card>
          </li>
          <li>
            <Card>
              <PlayerIdentity handle="Chovy" layout="stacked" role="mid" />
            </Card>
          </li>
          <li>
            <Card>
              <PlayerIdentity href="#player" handle="Canyon" layout="stacked" role="jungle" />
            </Card>
          </li>
        </ul>
      </div>
    </main>
  );
}

const meta = {
  component: PageLayoutGallery,
  parameters: { layout: "fullscreen" },
  title: "Components/04 Page layout",
} satisfies Meta<typeof PageLayoutGallery>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Overview: Story = {};
