import type { Meta, StoryObj } from "@storybook/react-vite";

import { Minimap } from "./minimap.js";

// Published building coordinates, retaining their source identifiers: https://hextechdocs.dev/map-data/.
const blue = [
  {
    id: "BLUE_MID_LANE_BASE_TURRET",
    label: "Blue mid base turret",
    side: "blue" as const,
    x: 3651,
    y: 3696,
  },
  {
    id: "BLUE_MID_LANE_INNER_TURRET",
    label: "Blue mid inner turret",
    side: "blue" as const,
    x: 5048,
    y: 4812,
  },
  {
    id: "BLUE_MID_LANE_OUTER_TURRET",
    label: "Blue mid outer turret",
    side: "blue" as const,
    x: 5846,
    y: 6396,
  },
];
const red = {
  id: "RED_MID_LANE_OUTER_TURRET",
  label: "Red mid outer turret",
  side: "red" as const,
  x: 8955,
  y: 8510,
};

const meta = {
  component: Minimap,
  title: "Components/Minimap",
  args: { title: "Summoner’s Rift — mid-lane buildings", points: [...blue, red] },
  parameters: {
    docs: {
      description: {
        component:
          "Building coordinates come from https://hextechdocs.dev/map-data/. The map background uses /api/images/maps/11; run the local app and queue a metadata refresh to populate its cache. Storybook development proxies image reads to that local app. No provider is called by the browser.",
      },
    },
  },
} satisfies Meta<typeof Minimap>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Points: Story = {};
export const Layers: Story = {
  args: {
    paths: [
      {
        id: "mid-buildings",
        label: "Blue mid-lane building sequence",
        side: "blue",
        positions: blue,
      },
    ],
    heat: [...blue, red].map((p) => ({ ...p, value: 1, sampleCount: 1 })),
  },
};
export const MissingCoordinates: Story = {
  args: {
    points: [...blue, { ...red, x: null }],
    paths: [
      {
        id: "gap",
        label: "Building sequence with missing position",
        side: "blue",
        positions: [blue[0]!, { x: null, y: null }, blue[1]!, blue[2]!],
      },
    ],
  },
};
export const Empty: Story = { args: { points: [] } };
export const Uncached: Story = { args: { imageUrl: null } };
