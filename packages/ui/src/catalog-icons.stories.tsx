import type { Meta, StoryObj } from "@storybook/react-vite";
import { ChampionIcon, ItemIcon, RuneIcon, SummonerSpellIcon } from "./catalog-icons.js";

const meta = {
  component: ChampionIcon,
  title: "Components/Catalog icons",
  args: {
    id: "MonkeyKing",
    name: "Wukong",
    imageUrl: "/api/images/catalog/16.22/champion/MonkeyKing",
  },
  parameters: {
    docs: {
      description: {
        component:
          "Names and ids are from the Data Dragon 16.22 catalog fixtures. Loaded stories read the local application's image cache through the Storybook proxy. Run the app and queue a metadata refresh for this patch, or set imageUrl to an existing local cache URL. An empty cache shows the labelled placeholder; no provider is called by the browser.",
      },
    },
  },
} satisfies Meta<typeof ChampionIcon>;
export default meta;
type Story = StoryObj<typeof meta>;
export const ChampionLoaded: Story = {};
export const ItemLoaded: Story = {
  render: () => <ItemIcon id="1001" name="Boots" imageUrl="/api/images/catalog/16.22/item/1001" />,
};
export const RuneLoaded: Story = {
  render: () => (
    <RuneIcon id="8112" name="Electrocute" imageUrl="/api/images/catalog/16.22/rune/8112" />
  ),
};
export const SpellLoaded: Story = {
  render: () => (
    <SummonerSpellIcon
      id="SummonerFlash"
      name="Flash"
      imageUrl="/api/images/catalog/16.22/spell/SummonerFlash"
    />
  ),
};
export const Missing: Story = {
  render: () => (
    <div>
      <ChampionIcon id="MonkeyKing" name="Wukong" imageUrl={null} />
      <ItemIcon id="1001" name="Boots" imageUrl={null} />
      <RuneIcon id="8112" name="Electrocute" imageUrl={null} />
      <SummonerSpellIcon id="SummonerFlash" name="Flash" imageUrl={null} />
    </div>
  ),
};
export const RuneChoices: Story = {
  name: "Rune Choices (Selected and Muted)",
  render: () => (
    <div style={{ display: "flex", gap: 12 }}>
      <RuneIcon
        id="8112"
        name="Electrocute"
        imageUrl="/api/images/catalog/16.22/rune/8112"
        state="selected"
      />
      <RuneIcon
        id="8128"
        name="Dark Harvest"
        imageUrl="/api/images/catalog/16.22/rune/8128"
        state="muted"
      />
      <RuneIcon
        id="9923"
        name="Hail of Blades"
        imageUrl="/api/images/catalog/16.22/rune/9923"
        state="muted"
      />
    </div>
  ),
};
