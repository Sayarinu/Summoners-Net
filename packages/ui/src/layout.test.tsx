import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { TeamVersus } from "./esports.js";
import {
  Card,
  CardLink,
  DisclosurePanel,
  FilterBar,
  PageHeader,
  Panel,
  Stat,
  StatGroup,
  TabNav,
} from "./layout.js";

describe("page layout", () => {
  it("heads a page with its trail, facts, title and actions", () => {
    render(
      <PageHeader
        actions={<button type="button">Watch Game VOD</button>}
        breadcrumbs={[{ href: "/history", label: "Past Matches" }, { label: "Game 1" }]}
        eyebrow="Worlds · Best of 3"
        title="HLE vs BLG"
      />,
    );

    expect(screen.getByRole("heading", { level: 1, name: "HLE vs BLG" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Past Matches" })).toHaveAttribute("href", "/history");
    expect(screen.getByText("Worlds · Best of 3")).toBeVisible();
    expect(screen.getByRole("button", { name: "Watch Game VOD" })).toBeVisible();
  });

  it("names a panel by its title and marks the team side", () => {
    render(
      <Panel actions={<button type="button">Show All</button>} side="red" title="Red Side">
        <p>Lineup</p>
      </Panel>,
    );

    const panel = screen.getByRole("region", { name: "Red Side" });
    expect(panel).toHaveAttribute("data-side", "red");
    expect(screen.getByRole("heading", { level: 2, name: "Red Side" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Show All" })).toBeVisible();
  });

  it("keeps an explicit label over the title", () => {
    render(<Panel aria-label="Bilibili Gaming">Banner</Panel>);
    expect(screen.getByRole("region", { name: "Bilibili Gaming" })).toHaveTextContent("Banner");
  });

  it("renders a disclosure body only while it is open", async () => {
    render(
      <DisclosurePanel title="Timeline">
        <p>Gold difference</p>
      </DisclosurePanel>,
    );

    expect(screen.queryByText("Gold difference")).toBeNull();
    await userEvent.click(screen.getByText("Timeline"));
    expect(screen.getByText("Gold difference")).toBeVisible();
  });

  it("pairs each stat label with its value and keeps unknowns as given", () => {
    render(
      <StatGroup label="Totals">
        <Stat label="Kills" value="19" />
        <Stat detail="2 games" label="Towers" value="—" />
      </StatGroup>,
    );

    const terms = screen.getAllByRole("term").map((term) => term.textContent);
    const values = screen.getAllByRole("definition").map((value) => value.textContent);
    expect(terms).toEqual(["Kills", "Towers2 games"]);
    expect(values).toEqual(["19", "—"]);
  });

  it("links tabs to their views and marks the current and unavailable ones", () => {
    render(
      <TabNav
        items={[
          { href: "/overview", label: "Overview" },
          { current: true, href: "/game-1", label: "Game 1", meta: "41:51" },
          { disabled: true, href: "/game-3", label: "Game 3" },
        ]}
        label="Series"
      />,
    );

    const nav = screen.getByRole("navigation", { name: "Series" });
    expect(nav).toBeVisible();
    expect(screen.getByRole("link", { name: /^Game 1/ })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Overview" })).not.toHaveAttribute("aria-current");
    expect(screen.queryByRole("link", { name: "Game 3" })).toBeNull();
    expect(screen.getByText("Game 3")).toHaveAttribute("aria-disabled", "true");
  });

  it("makes a card one link and a filter bar one form", () => {
    render(
      <>
        <Card href="/teams/gen-g">Gen.G</Card>
        <FilterBar aria-label="Filters">
          <input aria-label="Filter" />
        </FilterBar>
      </>,
    );

    expect(screen.getByRole("link", { name: "Gen.G" })).toHaveAttribute("href", "/teams/gen-g");
    expect(screen.getByRole("form", { name: "Filters" })).toContainElement(
      screen.getByRole("textbox", { name: "Filter" }),
    );
  });

  it("sets two teams against each other with their sides", () => {
    render(
      <TeamVersus
        teams={[
          { name: "Hanwha Life Esports", shortName: "HLE", side: "blue" },
          { href: "/teams/blg", name: "Bilibili Gaming", shortName: "BLG", side: "red" },
        ]}
      />,
    );

    expect(screen.getByText("vs")).toBeVisible();
    expect(screen.getByText("blue side")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Bilibili Gaming/ })).toHaveAttribute(
      "href",
      "/teams/blg",
    );
  });

  it("lets a card hold its main link beside secondary links", () => {
    render(
      <Card>
        <CardLink href="/players/faker">Faker</CardLink>
        <a href="/teams/t1">T1</a>
      </Card>,
    );

    expect(screen.getByRole("link", { name: "Faker" })).toHaveAttribute("href", "/players/faker");
    expect(screen.getByRole("link", { name: "T1" })).toHaveAttribute("href", "/teams/t1");
  });
});
