import type { League } from "./models.js";
// Predecessors are coverage aliases, never proof that two teams/players are the same identity.
const aliases: Record<string, League> = {
  lck: "LCK",
  ogn: "LCK",
  champions: "LCK",
  lpl: "LPL",
  lec: "LEC",
  eulcs: "LEC",
  lcs: "LCS",
  nalcs: "LCS",
  lcsna: "LCS",
  lcsnorthamerica: "LCS",
  lta: "LCS",
  ltan: "LCS",
  ltanorth: "LCS",
  lcp: "LCP",
  pcs: "LCP",
  lms: "LCP",
  gpl: "LCP",
  vcs: "LCP",
  worlds: "Worlds",
  worldchampionship: "Worlds",
  leagueoflegendsworldchampionship: "Worlds",
  msi: "MSI",
  midseasoninvitational: "MSI",
  fst: "First Stand",
  firststand: "First Stand",
  firststandtournament: "First Stand",
  ewc: "EWC",
  esportsworldcup: "EWC",
};
export function coveredLeague(name: string, year = 2100): League | null {
  const key = name.toLowerCase().replace(/[^a-z0-9]/g, "");
  // These domestic competitions became the LCP's second tier in 2025.
  if (["pcs", "vcs", "ljl", "lco", "opl"].includes(key)) return year < 2025 ? "LCP" : null;
  if (key === "wlds") return "Worlds";
  if (key === "leagueoflegendschampionshippacific") return "LCP";
  if (key === "leagueoflegendschampionskorea") return "LCK";
  if (key === "leagueoflegendsproleague") return "LPL";
  if (key === "leagueoflegendsemeachampionship") return "LEC";
  return aliases[key] ?? null;
}
export function sourceIdentity(
  source: "pandascore" | "oracle",
  kind: "team" | "player",
  externalId: string | undefined,
  observationKey: string,
): string {
  return `${source}:${kind}:${externalId?.trim() || `observation:${observationKey}`}`;
}
