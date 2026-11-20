"use client";
import { Avatar, Panel, RoleIcon, ShareBar, StatIcon, Table } from "@summonersnet/ui";
import type {
  DamageBreakdown,
  Game,
  HistoricalGameDetail,
  HistoricalParticipant,
} from "@summonersnet/data";
import { roleKey } from "@summonersnet/data/contracts";
import { gameTeams } from "../browse/presentation";
import { ChampionPortrait, type ChampionPortraits } from "../browse/visuals";

const roles = ["top", "jungle", "mid", "bottom", "support"];
const percentage = new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: 1 });
const count = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
type Statistics = HistoricalParticipant["statistics"];

const damageTypes = ["physical", "magic", "true"] as const;

const metrics = [
  {
    label: "Gold Distribution",
    unit: "gold",
    read: (stats?: Statistics) => stats?.economy.totalgold,
  },
  {
    label: "Damage Distribution",
    unit: "damage",
    read: (stats?: Statistics) => stats?.damage.damagetochampions,
    share: (stats?: Statistics) => stats?.damage.damageshare,
  },
] as const;

/** The amount behind a bar: gold with its icon, or damage with its type breakdown when recorded. */
function AmountTip({
  id,
  unit,
  amount,
  damage,
  side,
}: {
  id: string;
  unit: "gold" | "damage";
  amount: number;
  damage: DamageBreakdown | null;
  side: "blue" | "red";
}) {
  return (
    <span
      className={`invisible pointer-events-none absolute bottom-[calc(100%+var(--space-1))] z-2 grid gap-1 rounded-sm border border-line-strong bg-raised p-2 text-xs whitespace-nowrap tabular-nums [box-shadow:var(--shadow-md)] group-hover/value:visible group-focus-visible/value:visible ${side === "blue" ? "end-0" : "start-0"}`}
      role="tooltip"
      id={id}
    >
      {unit === "gold" ? (
        <span className={amountRow}>
          <StatIcon stat="gold" />
          {count.format(amount)}
        </span>
      ) : (
        <>
          <span className={amountRow}>Damage {count.format(amount)}</span>
          {damage ? (
            <ul className="m-0 grid list-none gap-1 p-0" aria-label="Damage by Type" role="list">
              {damageTypes.map((type) => (
                <li key={type} className={amountRow}>
                  <StatIcon stat={type} />
                  {count.format(damage[type])}
                </li>
              ))}
            </ul>
          ) : null}
        </>
      )}
    </span>
  );
}

const amountRow = "flex items-center gap-1";

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
  const cards = metrics.flatMap((metric) => {
    const { label, unit, read } = metric;
    const share = "share" in metric ? metric.share : undefined;
    const values = sides.map(({ team, players }) => {
      const amounts = players.map((player) => read(player?.statistics));
      const total = read(team) ?? measuredTotal(amounts);
      return players.map((player, index) => {
        const amount = amounts[index] ?? null;
        const damage =
          unit === "damage" && player
            ? (detail.telemetry?.builds[player.slot]?.damage ?? null)
            : null;
        const recorded = share?.(player?.statistics);
        if (recorded != null && recorded >= 0 && recorded <= 1)
          return { share: recorded, amount, damage };
        return total && amount != null && amount >= 0 && amount <= total
          ? { share: amount / total, amount, damage }
          : null;
      });
    });
    return values.some((side) => side.some((value) => value !== null))
      ? [{ label, unit, values }]
      : [];
  });
  if (!cards.length) return null;

  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,23rem),1fr))] gap-3">
      {cards.map(({ label, unit, values }) => {
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
            const tip = `ev-${unit}-${team.side}-${role}`;
            return value == null ? (
              "—"
            ) : (
              // Blue reads toward the middle: its share sits outside and its bar grows inward.
              <span
                className={`group/value relative grid items-center gap-2 ${team.side === "blue" ? "grid-cols-[auto_minmax(0,1fr)]" : "grid-cols-[minmax(0,1fr)_auto]"}`}
                data-side={team.side}
                {...(value.amount == null ? {} : { tabIndex: 0, "aria-describedby": tip })}
              >
                <ShareBar
                  className={team.side === "blue" ? "col-start-2 row-start-1" : undefined}
                  from={team.side === "blue" ? "end" : "start"}
                  side={team.side}
                  value={value.share}
                />
                <span className="np-meta">{percentage.format(value.share)}</span>
                {value.amount == null ? null : (
                  <AmountTip
                    id={tip}
                    unit={unit}
                    amount={value.amount}
                    damage={value.damage}
                    side={team.side}
                  />
                )}
              </span>
            );
          },
        }));
        return (
          <Panel key={label} title={label} padding="none">
            <Table
              className="border-t-0 [&_:is(th,td)]:px-2 [&_table]:table-fixed [&_th]:whitespace-normal [&_th]:wrap-anywhere"
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
                      <span className="inline-flex items-center gap-1">
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
          </Panel>
        );
      })}
    </div>
  );
}
