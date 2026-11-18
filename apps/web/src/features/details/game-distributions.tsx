"use client";
import { Avatar, RoleIcon, Table } from "@summonersnet/ui";
import type { Game, HistoricalGameDetail, HistoricalParticipant } from "@summonersnet/data";
import { roleKey } from "@summonersnet/data/contracts";
import { gameTeams } from "../browse/presentation";
import { ChampionPortrait, type ChampionPortraits } from "../browse/visuals";

const roles = ["top", "jungle", "mid", "bottom", "support"];
const percentage = new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: 1 });
type Statistics = HistoricalParticipant["statistics"];

const metrics = [
  { label: "Gold Distribution", read: (stats?: Statistics) => stats?.economy.totalgold },
  {
    label: "Damage Distribution",
    read: (stats?: Statistics) => stats?.damage.damagetochampions,
    share: (stats?: Statistics) => stats?.damage.damageshare,
  },
];

function measuredTotal(values: (number | null | undefined)[]) {
  return values.every((value) => value != null)
    ? values.reduce((total, value) => total + value, 0)
    : null;
}

export function GameDistributions({
  game,
  detail,
  portraits,
}: {
  game: Game;
  detail?: HistoricalGameDetail | null | undefined;
  portraits?: ChampionPortraits | undefined;
}) {
  if (!detail) return null;
  const teams = gameTeams(game);
  if (teams.length !== 2) return null;
  const sides = teams.map(({ side }) => {
    const rows = detail.participants.filter((row) => row.side === side);
    return {
      team: rows.find(({ position }) => position === "team")?.statistics,
      players: roles.map((role) => {
        const matches = rows.filter(
          (row) => row.player && roleKey(row.position.toLowerCase()) === role,
        );
        return matches.length === 1 ? matches[0] : undefined;
      }),
    };
  });
  const cards = metrics.flatMap(({ label, read, share }) => {
    const values = sides.map(({ team, players }) => {
      const amounts = players.map((player) => read(player?.statistics));
      const total = read(team) ?? measuredTotal(amounts);
      return players.map((player, index) => {
        const recorded = share?.(player?.statistics);
        if (recorded != null && recorded >= 0 && recorded <= 1) return recorded;
        const amount = amounts[index];
        return total && amount != null && amount >= 0 && amount <= total ? amount / total : null;
      });
    });
    return values.some((side) => side.some((value) => value !== null)) ? [{ label, values }] : [];
  });
  if (!cards.length) return null;

  return (
    <div className="ev-game-distributions">
      {cards.map(({ label, values }) => {
        const teamColumns = teams.map((team, index) => ({
          id: team.id,
          header: (
            <Avatar
              alt={team.name}
              fallback={team.name}
              src={team.imageUrl ?? undefined}
              entityKind="team"
              size="small"
            />
          ),
          align: team.side === "blue" ? ("end" as const) : ("start" as const),
          render: (role: string) => {
            const value = values[index]?.[roles.indexOf(role)];
            return value == null ? (
              "—"
            ) : (
              <span className="ev-game-distribution__value" data-side={team.side}>
                <span className="ev-game-distribution__track" aria-hidden="true">
                  <span style={{ inlineSize: `${value * 100}%` }} />
                </span>
                <span className="np-meta">{percentage.format(value)}</span>
              </span>
            );
          },
        }));
        return (
          <section className="ev-game-distribution" key={label}>
            <h2>{label}</h2>
            <Table
              caption={label}
              compact
              rows={roles}
              getRowKey={(role) => role}
              columns={[
                ...teamColumns.slice(0, 1),
                {
                  id: "role",
                  header: "Matchup",
                  width: "6.75rem",
                  align: "center",
                  render: (role) => {
                    const index = roles.indexOf(role);
                    return (
                      <span className="ev-game-distribution__matchup">
                        <ChampionPortrait
                          name={sides[0]?.players[index]?.champion ?? null}
                          portraits={portraits}
                        />
                        <RoleIcon role={role} />
                        <ChampionPortrait
                          name={sides[1]?.players[index]?.champion ?? null}
                          portraits={portraits}
                        />
                      </span>
                    );
                  },
                },
                ...teamColumns.slice(1),
              ]}
            />
          </section>
        );
      })}
    </div>
  );
}
