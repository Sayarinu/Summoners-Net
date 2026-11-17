"use client";
import { Table, TeamIdentity, PlayerIdentity, RoleIcon } from "@summonersnet/ui";
import type { Game } from "@summonersnet/data";
import { roleKey } from "@summonersnet/data/contracts";
import { ChampionPortrait, type ChampionPortraits } from "../browse/visuals";
import { gameTeams, identityHref } from "../browse/presentation";

const roles = ["top", "jungle", "mid", "bottom", "support"];
function roleOrder(role: string) {
  const index = roles.indexOf(roleKey(role.toLowerCase()) ?? "");
  return index === -1 ? roles.length : index;
}

export function LineupTable({
  game,
  hidden,
  portraits,
}: {
  game: Game;
  hidden: boolean;
  portraits?: ChampionPortraits | undefined;
}) {
  return (
    <section className="ev-lineups" aria-label="Lineups">
      {gameTeams(game).map((team) => {
        const side = team.side === "blue" ? "Blue Side" : "Red Side";
        const won = hidden ? null : team.won;
        const players = game.participants
          .filter((p) => p.team.id === team.id && p.side === team.side && p.player)
          .sort((a, b) => roleOrder(a.role) - roleOrder(b.role));
        return (
          <div
            key={team.id}
            className="ev-lineup-card"
            data-side={team.side}
            data-result={won === null ? undefined : won ? "win" : "loss"}
          >
            <header className="ev-lineup-card__header">
              <span className="ev-lineup-card__side">{side}</span>
              <TeamIdentity
                name={team.name}
                shortName={team.name}
                size="compact"
                href={identityHref(team)}
                winner={won === true}
                {...(team.imageUrl ? { logo: team.imageUrl } : {})}
              />
            </header>
            <Table
              caption={`${team.name} Lineup`}
              compact
              getRowKey={(p) => p.slot}
              rows={players}
              columns={[
                { id: "role", header: "Role", render: (p) => <RoleIcon role={p.role} /> },
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
                  render: (p) =>
                    hidden ? (
                      "Hidden"
                    ) : (
                      <ChampionPortrait name={p.champion} portraits={portraits} />
                    ),
                },
                {
                  id: "kda",
                  header: "K / D / A",
                  render: (p) =>
                    hidden
                      ? "Hidden"
                      : `${p.kills ?? "—"} / ${p.deaths ?? "—"} / ${p.assists ?? "—"}`,
                },
              ]}
            />
          </div>
        );
      })}
    </section>
  );
}
