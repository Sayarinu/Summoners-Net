import type { Meta, StoryObj } from "@storybook/react-vite";
import { ChampionIdentity, SkillOrderGrid } from "./champion.js";
import { Card } from "./layout.js";

const meta = {
  component: ChampionIdentity,
  title: "Components/Champion identity",
  args: {
    id: "Ahri",
    name: "Ahri",
    imageUrl: "/api/images/catalog/16.22/champion/Ahri",
  },
  parameters: {
    docs: {
      description: {
        component:
          "A champion portrait with its name, for tables, card grids and the champion profile banner. The portrait carries the accessible name; the visible name is not announced twice.",
      },
    },
  },
} satisfies Meta<typeof ChampionIdentity>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Medium: Story = { args: { href: "/champions/Ahri" } };
export const Compact: Story = { args: { size: "compact" } };
export const Display: Story = { args: { size: "display", detail: "Patch 16.22" } };
export const CardGrid: Story = {
  render: () => (
    <ul className="grid list-none grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3">
      {[
        ["Ahri", "Ahri"],
        ["MonkeyKing", "Wukong"],
        ["Nunu", "Nunu & Willump"],
      ].map(([id, name]) => (
        <li key={id}>
          <Card href={`/champions/${id}`}>
            <ChampionIdentity
              id={id!}
              name={name!}
              imageUrl={`/api/images/catalog/16.22/champion/${id}`}
              size="large"
            />
          </Card>
        </li>
      ))}
    </ul>
  ),
};
/** Levels 1–15 of a Q > E > W order, ultimate at 6 and 11. */
export const SkillOrder: Story = {
  render: () => (
    <SkillOrderGrid
      caption="Most Common Skill Order"
      path={[1, 3, 2, 1, 1, 4, 1, 3, 1, 3, 4, 3, 3, 2, 2]}
    />
  ),
};
