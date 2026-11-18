import { fireEvent, render, screen } from "@testing-library/react";
import axe from "axe-core";
import { expect, it } from "vitest";
import {
  ChampionIcon,
  ItemIcon,
  ObjectiveIcon,
  StatIcon,
  RuneIcon,
  SummonerSpellIcon,
} from "./catalog-icons.js";

it.each([
  [ChampionIcon, "MonkeyKing", "Wukong", "champion"],
  [ItemIcon, "1001", "Boots", "item"],
  [RuneIcon, "8112", "Electrocute", "rune"],
  [SummonerSpellIcon, "SummonerFlash", "Flash", "spell"],
] as const)(
  "renders catalog identities and handles missing, failed and replacement images for %s",
  (Component, id, name, kind) => {
    const url = `/api/images/${"a".repeat(64)}`;
    const { rerender } = render(<Component id={id} name={name} imageUrl={url} />);
    const icon = screen.getByRole("img", { name });
    expect(icon).toHaveAttribute("data-catalog-id", id);
    expect(icon).toHaveAttribute("data-catalog-kind", kind);
    expect(icon.querySelector("img")).toHaveAttribute("src", url);
    fireEvent.error(icon.querySelector("img")!);
    expect(icon.querySelector("img")).toBeNull();
    expect(icon).toHaveTextContent(name.slice(0, 3));
    rerender(<Component id={id} name={name} imageUrl={null} />);
    expect(icon.querySelector("img")).toBeNull();
    rerender(
      <Component id={id} name={name} imageUrl="https://ddragon.leagueoflegends.com/image.png" />,
    );
    expect(icon.querySelector("img")).toBeNull();
    rerender(
      <Component
        id={id}
        name={name}
        imageUrl={`/api/images/catalog/16.22/${kind}/${id}`}
        size="large"
      />,
    );
    expect(icon.querySelector("img")).toHaveAttribute(
      "src",
      `/api/images/catalog/16.22/${kind}/${id}`,
    );
  },
);
it("has accessible names in both states", async () => {
  render(
    <div>
      <ChampionIcon id="MonkeyKing" name="Wukong" imageUrl={null} />
      <ItemIcon id="1001" name="Boots" imageUrl={`/api/images/${"a".repeat(64)}`} />
    </div>,
  );
  const result = await axe.run(document.body, {
    rules: { "color-contrast": { enabled: false }, region: { enabled: false } },
  });
  expect(
    result.violations.filter((v) => v.impact === "serious" || v.impact === "critical"),
  ).toEqual([]);
});

it("names objective icons by default or by the given label", () => {
  render(
    <>
      <ObjectiveIcon objective="herald" />
      <ObjectiveIcon objective="grub" label="Void Grubs" />
      <ObjectiveIcon objective="tower" />
      <ObjectiveIcon objective="first-blood" />
      <ObjectiveIcon objective="baron" />
    </>,
  );
  for (const name of ["Rift Herald", "Void Grubs", "First Tower", "First Blood", "Baron Nashor"])
    expect(screen.getByRole("img", { name })).toHaveAttribute("title", name);
});

it("names gold and damage type icons", () => {
  render(
    <>
      <StatIcon stat="gold" />
      <StatIcon stat="physical" />
      <StatIcon stat="magic" />
      <StatIcon stat="true" />
    </>,
  );
  for (const name of ["Gold", "Physical Damage", "Magic Damage", "True Damage"])
    expect(screen.getByRole("img", { name })).toHaveAttribute("title", name);
});
