"use client";
import { TabNav } from "@summonersnet/ui";

/** The champion's sibling pages: its overview, its lane matchups and its heatmaps. */
export function ChampionPages({
  current,
  overviewHref,
  matchupsHref,
  heatmapsHref,
}: {
  current: "overview" | "matchups";
  overviewHref: string;
  matchupsHref: string;
  heatmapsHref: string;
}) {
  return (
    <TabNav
      label="Champion Pages"
      items={[
        { href: overviewHref, label: "Overview", current: current === "overview" },
        { href: matchupsHref, label: "Lane Matchups", current: current === "matchups" },
        { href: heatmapsHref, label: "Heatmaps" },
      ]}
    />
  );
}

/** The heatmaps page for a champion; solo queue keeps the patch, pro shows every patch. */
export function championHeatmapsHref(championId: string, source: string, patch: string | null) {
  return `/heatmaps?subjectKind=champion&subject=${championId}${source === "solo" && patch ? `&patch=${patch}` : ""}`;
}
