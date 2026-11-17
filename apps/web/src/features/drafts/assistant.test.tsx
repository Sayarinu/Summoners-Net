import { expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { draftAssistantQuerySchema, type DraftAssistant } from "@summonersnet/data/contracts";
import { DraftAssistantPage } from "./assistant";

const ahri = { championKey: 103, championId: "Ahri", name: "Ahri", imageUrl: null };
const nunu = { championKey: 20, championId: "Nunu", name: "Nunu & Willump", imageUrl: null };
const unknown = { championKey: 999, championId: null, name: null, imageUrl: null };
const assistant: DraftAssistant = {
  query: draftAssistantQuerySchema.parse({ red: "Nunu:MIDDLE", bans: "Zzz" }),
  patch: "16.22",
  patches: ["16.22"],
  unknownChampions: ["Zzz"],
  laneOpponent: nunu,
  synergyAllies: [],
  candidates: [
    {
      champion: ahri,
      games: 32,
      matchup: { value: 0.0451, sampleCount: 10 },
      synergy: null,
      blindability: null,
      score: 0.0451,
      parts: 1,
    },
    {
      champion: unknown,
      games: 2,
      matchup: { value: null, sampleCount: 0 },
      synergy: null,
      blindability: null,
      score: null,
      parts: 0,
    },
  ],
};
it("ranks candidates with each part's sample and explains the score", () => {
  render(
    <DraftAssistantPage
      assistant={assistant}
      input={{ blue: "", red: "Nunu:MIDDLE", bans: "Zzz" }}
      error={null}
    />,
  );
  expect(screen.getByRole("heading", { name: "Draft assistant" })).toBeVisible();
  expect(screen.getByLabelText("Red picks")).toHaveValue("Nunu:MIDDLE");
  expect(screen.getByText(/Lane opponent: Nunu & Willump/)).toBeVisible();
  expect(screen.getByRole("status")).toHaveTextContent("ignored: Zzz");
  const table = screen.getByRole("table", { name: "Ranked candidates for Mid" });
  const rows = screen.getAllByRole("row").slice(1);
  expect(rows[0]).toHaveTextContent(/^1.*Ahri\+4\.5 pts · 1 known\+4\.5 pts · n=10 games/);
  expect(rows[0]).toHaveTextContent("Not used");
  expect(rows[1]).toHaveTextContent(/^2.*Champion 999Unknown · 0 known/);
  expect(table).toHaveTextContent("Unknown · n=0 games");
  expect(screen.getByRole("link", { name: "Ahri" })).toHaveAttribute(
    "href",
    "/champions/Ahri/matchups?source=solo&patch=16.22&role=MIDDLE",
  );
  expect(screen.getByText("How candidates are ranked")).toBeVisible();
  expect(screen.getByText(/score = mean of the known parts/)).toBeInTheDocument();
});
it("shows validation errors without results and keeps the typed draft", () => {
  render(
    <DraftAssistantPage
      assistant={null}
      input={{ blue: "Ahri,Ahri", red: "", bans: "" }}
      error="Enter picks as champion IDs"
    />,
  );
  expect(screen.getByRole("alert")).toHaveTextContent("Enter picks");
  expect(screen.getByLabelText("Blue picks")).toHaveValue("Ahri,Ahri");
  expect(screen.queryByRole("table")).toBeNull();
});
