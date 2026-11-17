import { expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import type { ChampionOverview, ChampionStats, TierList } from "@summonersnet/data/contracts";
import { ChampionComparePage, PatchComparePage } from "./pages";

const sampled = (value: number | null, sampleCount: number) => ({ value, sampleCount });
const overview = {
  champion: { id: "Ahri", key: 103, name: "Ahri", imageUrl: null },
  patch: "16.22",
  games: 120,
  winRate: { ...sampled(0.525, 118), lower: 0.43, upper: 0.61 },
  shrunkWinRate: sampled(0.51, 118),
  pickRate: sampled(0.06, 2000),
  banRate: sampled(null, 0),
  tier: "B",
} as unknown as ChampionOverview;

it("shows two champions side by side with each value's sample", () => {
  render(
    <ChampionComparePage
      comparison={{
        query: { a: "Ahri", b: "Zed", source: "solo", role: "MIDDLE" },
        a: overview,
        b: null,
      }}
      error={null}
      search="a=Ahri&b=Zed&role=MIDDLE"
    />,
  );
  const table = screen.getByRole("table", { name: "Ahri and Zed (unknown), Mid" });
  const row = (name: string) => within(table).getByRole("row", { name: new RegExp(`^${name}`) });
  expect(row("Win rate 52")).toHaveTextContent("Win rate52.5%118Not stored0");
  expect(row("Ban rate")).toHaveTextContent("Ban rateUnknown0Not stored0");
  expect(row("Games")).toHaveTextContent("Games120120Not stored0");
  expect(screen.getByLabelText("First champion id")).toHaveValue("Ahri");
  expect(screen.getByRole("button", { name: "Save this view" })).toBeVisible();
});
it("prompts for champions and shows validation errors", () => {
  const { unmount } = render(<ChampionComparePage comparison={null} error={null} />);
  expect(screen.getByText("Choose two champions")).toBeVisible();
  unmount();
  render(<ChampionComparePage comparison={null} error="Choose two champion ids." />);
  expect(screen.getByRole("alert")).toHaveTextContent("Choose two champion ids.");
});

const list = {
  patch: "16.22",
  page: {
    page: 1,
    pageSize: 1,
    total: 2,
    items: [
      {
        championKey: 103,
        championId: "Ahri",
        name: "Ahri",
        role: "MIDDLE",
        winRate: sampled(0.5, 40),
        pickRate: sampled(0.1, 400),
      },
    ],
  },
} as unknown as TierList;
const other = {
  patch: "16.21",
  rows: [
    {
      championKey: 103,
      role: "MIDDLE",
      winRate: sampled(0.45, 20),
      pickRate: sampled(0.05, 400),
    },
  ],
} as unknown as ChampionStats;

it("shows two patches side by side with samples and paging", () => {
  const query = { a: "16.22", b: "16.21", source: "solo", role: "MIDDLE", page: 1 };
  const { unmount } = render(
    <PatchComparePage
      comparison={{ query, a: list, b: other }}
      error={null}
      search="a=16.22&b=16.21&role=MIDDLE"
    />,
  );
  const table = screen.getByRole("table", { name: "Patch 16.22 and patch 16.21, Mid" });
  expect(table).toHaveTextContent("Ahri50.0% (40)45.0% (20)10.0% (400)5.0% (400)");
  expect(screen.getByRole("link", { name: "Next page" })).toHaveAttribute(
    "href",
    "/compare/patches?a=16.22&b=16.21&role=MIDDLE&page=2",
  );
  unmount();
  const { unmount: close } = render(
    <PatchComparePage comparison={{ query, a: list, b: null }} error={null} />,
  );
  expect(screen.getByRole("status")).toHaveTextContent("Patch 16.21 has no stored statistics");
  expect(screen.getByRole("table")).toHaveTextContent("Not stored (0)");
  close();
  render(<PatchComparePage comparison={{ query, a: null, b: other }} error={null} />);
  expect(screen.getByText("No statistics for patch 16.22")).toBeVisible();
});
