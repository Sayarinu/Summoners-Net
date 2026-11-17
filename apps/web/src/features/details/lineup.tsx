"use client";
import { Table, TeamIdentity, PlayerIdentity } from "@summonersnet/ui";
import type { Game } from "@summonersnet/data";
import { identityHref } from "../browse/presentation";

/** The played lineup of one game; champions and results stay hidden with spoilers. */
export function LineupTable({ game, hidden }: { game: Game; hidden: boolean }) {
  return (
    <Table
      caption="Historical Played Lineup"
      getRowKey={(p) => p.slot}
      rows={game.participants.filter((p) => p.player)}
      columns={[
        { id: "side", header: "Side", render: (p) => p.side },
        {
          id: "team",
          header: "Team",
          render: (p) => (
            <TeamIdentity
              name={p.team.name}
              shortName={p.team.name}
              size="compact"
              href={identityHref(p.team)}
              {...(p.team.imageUrl ? { logo: p.team.imageUrl } : {})}
            />
          ),
        },
        { id: "role", header: "Role", render: (p) => p.role },
        {
          id: "player",
          header: "Player",
          render: (p) =>
            p.player ? (
              <PlayerIdentity
                handle={p.player.name}
                href={identityHref(p.player)}
                {...(p.player.imageUrl ? { portrait: p.player.imageUrl } : {})}
              />
            ) : (
              "—"
            ),
        },
        {
          id: "champion",
          header: "Champion",
          render: (p) => (hidden ? "Hidden" : (p.champion ?? "—")),
        },
        {
          id: "kda",
          header: "K / D / A",
          render: (p) =>
            hidden ? "Hidden" : `${p.kills ?? "—"} / ${p.deaths ?? "—"} / ${p.assists ?? "—"}`,
        },
        {
          id: "result",
          header: "Result",
          render: (p) => (hidden ? "Hidden" : p.won === null ? "Unknown" : p.won ? "Win" : "Loss"),
        },
      ]}
    />
  );
}
