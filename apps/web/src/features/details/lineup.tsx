"use client";
import { RoleIcon, Table, TeamIdentity, TextLink } from "@summonersnet/ui";
import type { Game, HistoricalGameDetail } from "@summonersnet/data";
import { roleKey } from "@summonersnet/data/contracts";
import { ChampionPortrait, type ChampionPortraits } from "../browse/visuals";
import { gameTeams, identityHref } from "../browse/presentation";

const roles = ["top", "jungle", "mid", "bottom", "support"];
const teamNumber = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });
function roleOrder(role: string) {
  const index = roles.indexOf(roleKey(role.toLowerCase()) ?? "");
  return index === -1 ? roles.length : index;
}

export function LineupTable({
  game,
  detail,
  hidden,
  portraits,
}: {
  game: Game;
  detail?: HistoricalGameDetail | null | undefined;
  hidden: boolean;
  portraits?: ChampionPortraits | undefined;
}) {
  const teams = gameTeams(game);
  const facts = teams.map(({ side }) => {
    const stats = detail?.participants.find(
      (p) => p.side === side && p.position === "team",
    )?.statistics;
    return [
      stats?.combat.kills ?? null,
      stats?.economy.totalgold ?? null,
      stats?.objectives.towers ?? null,
      stats?.objectives.dragons ?? null,
      stats?.objectives.barons ?? null,
    ];
  });
  const metrics = ["Kills", "Gold", "Towers", "Dragons", "Barons"].flatMap((label, index) =>
    !hidden && facts.some((side) => side[index] !== null) ? [{ label, index }] : [],
  );
  return (
    <section className="ev-lineups" aria-label="Lineups">
      {teams.map((team, index) => {
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
            {metrics.length ? (
              <dl className="ev-lineup-card__facts" aria-label={`${team.name} Team Totals`}>
                {metrics.map(({ label, index: metricIndex }) => {
                  const value = facts[index]?.[metricIndex];
                  return (
                    <div key={label}>
                      <dt>{label}</dt>
                      <dd>{value == null ? "—" : teamNumber.format(value)}</dd>
                    </div>
                  );
                })}
              </dl>
            ) : null}
            <Table
              caption={`${team.name} Lineup`}
              compact
              getRowKey={(p) => p.slot}
              rows={players}
              columns={[
                {
                  id: "role",
                  header: "Role",
                  width: "3.25rem",
                  align: "center",
                  render: (p) => <RoleIcon role={p.role} />,
                },
                {
                  id: "player",
                  header: "Player",
                  render: (p) =>
                    p.player ? (
                      <TextLink
                        className="ev-lineup-player"
                        href={identityHref(p.player)}
                        title={p.player.name}
                      >
                        {p.player.name}
                      </TextLink>
                    ) : (
                      "—"
                    ),
                },
                {
                  id: "champion",
                  header: "Champion",
                  width: "5rem",
                  align: "center",
                  render: (p) =>
                    hidden ? (
                      "Hidden"
                    ) : (
                      <ChampionPortrait name={p.champion} portraits={portraits} size="medium" />
                    ),
                },
                {
                  id: "kda",
                  header: "KDA",
                  width: "6rem",
                  align: "center",
                  render: (p) => (
                    <span className="ev-lineup-kda">
                      {hidden
                        ? "Hidden"
                        : `${p.kills ?? "—"} / ${p.deaths ?? "—"} / ${p.assists ?? "—"}`}
                    </span>
                  ),
                },
              ]}
            />
          </div>
        );
      })}
    </section>
  );
}
