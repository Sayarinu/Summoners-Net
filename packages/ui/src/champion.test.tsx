import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { ChampionIdentity, SkillOrderGrid } from "./champion.js";

it("announces a linked champion once, by its portrait, and keeps the detail readable", () => {
  render(
    <ChampionIdentity
      id="Nunu"
      name="Nunu & Willump"
      imageUrl={null}
      href="/champions/Nunu"
      detail="Patch 16.22"
    />,
  );
  const link = screen.getByRole("link", { name: /^Nunu & Willump\s*Patch 16\.22$/ });
  expect(link).toHaveAttribute("href", "/champions/Nunu");
  expect(screen.getByRole("img", { name: "Nunu & Willump" })).toBeVisible();
  expect(link).toHaveTextContent("Nunu & Willump");
});

it("renders an unlinked identity at the display size", () => {
  const { container } = render(
    <ChampionIdentity id="Ahri" name="Ahri" imageUrl={null} size="display" />,
  );
  expect(screen.queryByRole("link")).toBeNull();
  expect(screen.getByRole("img", { name: "Ahri" })).toBeVisible();
  expect(container.firstElementChild).toHaveClass("np-identity--display");
});

it("marks the ability ranked at each level in a grid of abilities by level", () => {
  render(<SkillOrderGrid caption="Skill Order" path={[1, 3, 2, 1, 1, 4]} />);
  const grid = screen.getByRole("table", { name: "Skill Order" });
  const row = (key: string) => screen.getByRole("row", { name: new RegExp(`^${key}`) });
  expect(grid).toBeVisible();
  expect(screen.getAllByRole("columnheader").map((h) => h.textContent)).toEqual([
    "Ability",
    "1",
    "2",
    "3",
    "4",
    "5",
    "6",
  ]);
  expect(row("Q")).toHaveTextContent(/^QQQQ$/);
  expect(row("Q").querySelectorAll("td[data-ranked]")).toHaveLength(3);
  expect(row("Q").querySelectorAll("td[data-projected]")).toHaveLength(0);
  expect(row("R").querySelectorAll("td[data-ranked]")).toHaveLength(1);
});

it("dims the levels that are projected rather than observed", () => {
  render(<SkillOrderGrid caption="Projected Order" path={[1, 3, 2, 4]} projectedFrom={3} />);
  const cells = screen.getByRole("row", { name: /^Q/ }).querySelectorAll("td");
  expect([...cells].map((c) => c.hasAttribute("data-projected"))).toEqual([
    false,
    false,
    true,
    true,
  ]);
});
