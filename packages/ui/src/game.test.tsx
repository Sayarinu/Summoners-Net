import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ShareBar, SideName, SidePair, TeamSideHeader } from "./game.js";

describe("game components", () => {
  it("marks a team name with its side only when the side is known", () => {
    const view = render(<SideName side="red">Hanwha Life Esports</SideName>);
    expect(screen.getByText("Hanwha Life Esports")).toHaveAttribute("title", "red side");
    view.rerender(<SideName>Hanwha Life Esports</SideName>);
    expect(screen.getByText("Hanwha Life Esports")).not.toHaveAttribute("title");
    expect(screen.getByText("Hanwha Life Esports")).not.toHaveAttribute("data-side");
  });

  it("labels a team's half with its side", () => {
    const view = render(<TeamSideHeader side="blue">Bilibili Gaming</TeamSideHeader>);
    const header = screen.getByRole("banner");
    expect(header).toHaveTextContent("Blue SideBilibili Gaming");
    view.rerender(<TeamSideHeader side="red">Hanwha Life Esports</TeamSideHeader>);
    expect(header).toHaveTextContent("Red SideHanwha Life Esports");
    view.rerender(
      <TeamSideHeader label="Red Side · Second Pick" side="red">
        Hanwha Life Esports
      </TeamSideHeader>,
    );
    expect(header).toHaveTextContent("Red Side · Second Pick");
  });

  it("names a pair of sides as a region only when given a label", () => {
    const view = render(
      <SidePair label="Lineups">
        <div data-side="blue">Blue</div>
        <div data-side="red">Red</div>
      </SidePair>,
    );
    expect(screen.getByRole("region", { name: "Lineups" })).toHaveTextContent("BlueRed");
    view.rerender(
      <SidePair>
        <div data-side="blue">Blue</div>
      </SidePair>,
    );
    expect(screen.queryByRole("region")).toBeNull();
    expect(screen.getByText("Blue")).toBeVisible();
  });

  it("fills a share bar to its clamped value without exposing it to assistive technology", () => {
    const view = render(<ShareBar side="blue" value={0.25} />);
    const fill = () => view.container.querySelector<HTMLElement>("[aria-hidden] > span")!;
    expect(fill().style.inlineSize).toBe("25%");
    view.rerender(<ShareBar value={1.4} />);
    expect(fill().style.inlineSize).toBe("100%");
    view.rerender(<ShareBar from="end" value={-1} />);
    expect(fill().style.inlineSize).toBe("0%");
    view.rerender(<ShareBar value={Number.NaN} />);
    expect(fill().style.inlineSize).toBe("0%");
  });
});
