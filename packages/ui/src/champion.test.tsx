import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { ChampionIdentity } from "./champion.js";

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
