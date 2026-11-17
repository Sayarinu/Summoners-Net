import { expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import type { PatchOverview } from "@summonersnet/data/contracts";
import { PatchOverviewPage } from "./overview";
const empty: PatchOverview = {
  patch: "16.22",
  previousPatch: null,
  risers: [],
  fallers: [],
  builds: [],
  pro: [],
};
const champion = { championKey: 103, championId: "Ahri", name: "Ahri", imageUrl: null };
it("explains absent samples without inventing zero rates", () => {
  render(<PatchOverviewPage overview={empty} />);
  expect(screen.getByRole("heading", { name: "Patch 16.22" })).toBeVisible();
  expect(screen.getByRole("status")).toHaveTextContent("cannot be established");
  expect(screen.getAllByText(/No qualifying changes/)).toHaveLength(2);
  expect(screen.getByText(/No qualifying new builds/)).toBeVisible();
  expect(screen.getByText("Too little pro draft data for presence leaders.")).toBeVisible();
  expect(screen.queryByText("0.0%")).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Trending Champions" })).toHaveAttribute(
    "href",
    "/trending?patch=16.22",
  );
});
it("shows rate denominators, signed deltas, ordered cores and pro sample warnings", () => {
  render(
    <PatchOverviewPage
      overview={{
        ...empty,
        previousPatch: "16.21",
        risers: [
          {
            ...champion,
            metric: "win",
            change: {
              current: { value: 0.8, sampleCount: 100 },
              previous: { value: 0.4, sampleCount: 50 },
              delta: 0.4,
              z: 4,
              direction: "rising",
              reason: "significant",
            },
          },
        ],
        fallers: [
          {
            ...champion,
            championId: null,
            name: null,
            metric: "pick",
            change: {
              current: { value: 0.2, sampleCount: 1000 },
              previous: { value: 0.6, sampleCount: 1000 },
              delta: -0.4,
              z: -4,
              direction: "falling",
              reason: "significant",
            },
          },
        ],
        builds: [
          {
            ...champion,
            role: "MIDDLE",
            games: 50,
            share: { value: 0.5, sampleCount: 100 },
            previousSample: 60,
            items: [
              { kind: "item", id: 1, catalogId: "1", name: "Known item", imageUrl: null },
              { kind: "item", id: 2, catalogId: "2", name: null, imageUrl: null },
            ],
          },
        ],
        pro: [
          {
            ...champion,
            picks: 8,
            bans: 7,
            presence: { value: 0.5, sampleCount: 30 },
            sample: "low-sample",
          },
        ],
      }}
    />,
  );
  expect(screen.getByText("80.0% · n=100")).toBeVisible();
  expect(screen.getByText("40.0% · n=50")).toBeVisible();
  expect(screen.getByText("+40.0 pp")).toBeVisible();
  expect(screen.getByText("-40.0 pp")).toBeVisible();
  expect(screen.getByText("Champion 103")).toBeVisible();
  expect(screen.getByText("50 cores · 50.0% · n=100")).toBeVisible();
  expect(screen.getByText("Absent · n=60 cores")).toBeVisible();
  expect(screen.getAllByRole("listitem")[0]).toHaveTextContent("Known item");
  expect(screen.getAllByRole("listitem")[1]).toHaveTextContent("Item 2");
  expect(screen.getByText("50.0% · n=30 · Low sample")).toBeVisible();
  expect(screen.getByText("8 · n=30 drafts")).toBeVisible();
  expect(screen.getAllByRole("link", { name: "Ahri" }).at(-1)).toHaveAttribute(
    "href",
    "/champions/Ahri?source=pro&patch=16.22",
  );
});
