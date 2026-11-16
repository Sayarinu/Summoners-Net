import type { DraftParticipant } from "../src/domain/draft-order.js";
import { historyCsv } from "./fixtures.js";

export function draftParticipants(firstSide: "blue" | "red" = "blue"): DraftParticipant[] {
  const roles = ["top", "jungle", "mid", "bottom", "support", "team"];
  const champions = {
    blue: ["Renekton", "Lee Sin", "Orianna", "Jinx", "Nautilus"],
    red: ["K'Sante", "Sejuani", "Ahri", "Aphelios", "Leona"],
  };
  const picks = {
    blue: ["Nautilus", "Renekton", "Jinx", "Lee Sin", "Orianna"],
    red: ["Ahri", "Sejuani", "Aphelios", "K'Sante", "Leona"],
  };
  const bans = {
    blue: ["Kalista", "Rumble", "Azir", "Vi", "Rakan"],
    red: ["Lucian", "Draven", "Ashe", "Maokai", "Neeko"],
  };
  return (["blue", "red"] as const).flatMap((side) =>
    roles.map((position, i) => ({
      side,
      position,
      champion: champions[side][i] ?? null,
      result: side === "blue",
      draft:
        position === "team"
          ? Object.fromEntries<string>([
              ["firstpick", side === firstSide ? "1" : "0"],
              ...picks[side].map((c, i) => [`pick${i + 1}`, c] as const),
              ...bans[side].map((c, i) => [`ban${i + 1}`, c] as const),
            ])
          : {},
    })),
  );
}
export function draftCsv({
  id = "draft-game",
  league = "LCK",
  patch = "16.4",
  firstSide = "blue",
  missingBan = false,
  unknownResult = false,
}: {
  id?: string;
  league?: string;
  patch?: string;
  firstSide?: "blue" | "red";
  missingBan?: boolean;
  unknownResult?: boolean;
} = {}) {
  const participants = draftParticipants(firstSide);
  const lines = historyCsv({ id, league }).trim().split("\n");
  const fields = lines[0]!.split(",");
  const draftFields = [
    "firstpick",
    ...Array.from({ length: 5 }, (_, i) => `pick${i + 1}`),
    ...Array.from({ length: 5 }, (_, i) => `ban${i + 1}`),
  ];
  const rows = lines.slice(1).map((line, index) => {
    const row = Object.fromEntries(fields.map((f, i) => [f, line.split(",")[i]!]));
    const participant = participants[index]!;
    row.champion = participant.champion ?? "";
    row.patch = patch;
    if (unknownResult) row.result = "";
    if (missingBan && participant.side === "blue") participant.draft.ban5 = "";
    return [
      ...fields.map((f) => row[f]),
      ...draftFields.map((f) => participant.draft[f] ?? ""),
    ].join(",");
  });
  return [...fields, ...draftFields].join(",") + "\n" + rows.join("\n") + "\n";
}
