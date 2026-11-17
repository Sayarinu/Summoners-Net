import { expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
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
  const summary = screen.getByLabelText("Draft win probability by side");
  expect(summary).toHaveTextContent("Red side55.0%");
  expect(summary).toHaveTextContent("Blue side45.0%");
  expect(summary).toHaveTextContent("Champion strength coverage1 of 1");
  expect(screen.getByText(/Brier score on 120 held-out games: 0.241/)).toBeVisible();
  expect(screen.getByRole("link", { name: "Calibration" })).toHaveAttribute(
    "href",
    "/models?model=7",
  );
  const inputs = screen.getByRole("table", { name: "Draft model inputs" });
  expect(inputs).toHaveTextContent("Champion strengthRedMIDDLENunu & Willump+4.0 pts80");
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
  expect(screen.queryByText("Draft win probability if picked")).toBeNull();
  rerender(
    <DraftAssistantPage
      assistant={assistant}
      input={{ blue: "", red: "", bans: "" }}
      error={null}
    />,
  );
  expect(screen.getByText(/covers solo queue only/)).toBeVisible();
});
