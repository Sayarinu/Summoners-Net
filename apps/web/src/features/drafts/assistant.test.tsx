import { expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { draftAssistantQuerySchema, type DraftAssistant } from "@summonersnet/data/contracts";
import { DraftAssistantPage } from "./assistant";
import type { DraftWinProbability } from "@summonersnet/data/contracts";

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
  draft: null,
  candidates: [
    {
      champion: ahri,
      games: 32,
      matchup: { value: 0.0451, sampleCount: 10 },
      synergy: null,
      blindability: null,
      score: 0.0451,
      parts: 1,
      winProbability: 0.53,
    },
    {
      champion: unknown,
      games: 2,
      matchup: { value: null, sampleCount: 0 },
      synergy: null,
      blindability: null,
      score: null,
      parts: 0,
      winProbability: 0.48,
    },
  ],
};
it("ranks candidates with each part's sample and explains the score", async () => {
  render(
    <DraftAssistantPage
      assistant={assistant}
      input={{ blue: "", red: "Nunu:MIDDLE", bans: "Zzz" }}
      error={null}
    />,
  );
  expect(screen.getByRole("heading", { name: "Draft Assistant" })).toBeVisible();
  expect(screen.getByLabelText("Red Picks")).toHaveValue("Nunu:MIDDLE");
  expect(screen.getByText(/Lane opponent: Nunu & Willump/)).toBeVisible();
  expect(screen.getByRole("status")).toHaveTextContent("ignored: Zzz");
  const table = screen.getByRole("table", { name: "Ranked candidates for Mid" });
  const rows = screen.getAllByRole("row").slice(1);
  expect(rows[0]).toHaveTextContent(/^1.*\+4\.5 pts · 1 known\+4\.5 pts · n=10 games/);
  expect(rows[0]).toHaveTextContent("Not used");
  expect(rows[1]).toHaveTextContent(/^2.*Unknown · 0 known/);
  expect(table).toHaveTextContent("Unknown · n=0 games");
  expect(screen.getByRole("link", { name: "Ahri" })).toHaveAttribute(
    "href",
    "/champions/Ahri/matchups?source=solo&patch=16.22&role=MIDDLE",
  );
  fireEvent.click(screen.getByText("How Candidates Are Ranked"));
  expect(await screen.findByText(/score = mean of the known parts/)).toBeInTheDocument();
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
  expect(screen.getByLabelText("Blue Picks")).toHaveValue("Ahri,Ahri");
  expect(screen.queryByRole("table")).toBeNull();
});
it("shows the draft win probability for your side and with each candidate", () => {
  const draft: DraftWinProbability = {
    model: { id: 7, modelVersion: 1, brier: 0.241, evalGames: 120, patches: ["16.22"] },
    reason: null,
    blueWinProbability: 0.45,
    inputs: [
      {
        kind: "strength",
        side: "red",
        role: "MIDDLE",
        championKeys: [20],
        value: 0.04,
        sampleCount: 80,
      },
    ],
    coverage: {
      strength: { known: 1, total: 1 },
      lane: { known: 0, total: 0 },
      synergy: { known: 0, total: 0 },
    },
  };
  render(
    <DraftAssistantPage
      assistant={{ ...assistant, query: { ...assistant.query, side: "red" }, draft }}
      input={{ blue: "", red: "Nunu:MIDDLE", bans: "" }}
      error={null}
    />,
  );
  const summary = screen.getByLabelText("Draft Win Probability by Side");
  expect(summary).toHaveTextContent("Red Side55.0%");
  expect(summary).toHaveTextContent("Blue Side45.0%");
  expect(summary).toHaveTextContent("Champion Strength Coverage1 of 1");
  expect(screen.getByText(/Brier score on 120 held-out games: 0.241/)).toBeVisible();
  expect(screen.getByRole("link", { name: "Calibration" })).toHaveAttribute(
    "href",
    "/models?model=7",
  );
  const inputs = screen.getByRole("table", { name: "Draft Model Inputs" });
  expect(inputs).toHaveTextContent("Champion StrengthRedMidNunu & Willump+4.0 pts80");
  expect(screen.getByRole("table", { name: "Ranked candidates for Mid" })).toHaveTextContent(
    "53.0%",
  );
});
it("explains a missing draft model and pro play", () => {
  const { rerender } = render(
    <DraftAssistantPage
      assistant={{
        ...assistant,
        draft: {
          model: null,
          reason: "No draft model is active yet.",
          blueWinProbability: null,
          inputs: [],
          coverage: {
            strength: { known: 0, total: 0 },
            lane: { known: 0, total: 0 },
            synergy: { known: 0, total: 0 },
          },
        },
      }}
      input={{ blue: "", red: "", bans: "" }}
      error={null}
    />,
  );
  expect(screen.getByText("No draft model is active yet.")).toBeVisible();
  expect(screen.queryByText("Draft Win Probability if Picked")).toBeNull();
  rerender(
    <DraftAssistantPage
      assistant={assistant}
      input={{ blue: "", red: "", bans: "" }}
      error={null}
    />,
  );
  expect(screen.getByText(/covers solo queue only/)).toBeVisible();
});
