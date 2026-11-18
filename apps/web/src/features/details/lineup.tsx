"use client";
import type { ReactNode } from "react";
import {
  DrakeIcon,
  ObjectiveIcon,
  RoleIcon,
  Table,
  TeamIdentity,
  TextLink,
} from "@summonersnet/ui";
import type { Game, HistoricalGameDetail, HistoricalParticipant } from "@summonersnet/data";
import { roleKey } from "@summonersnet/data/contracts";
import { ChampionPortrait, type ChampionPortraits } from "../browse/visuals";
import { PlayerBuild, type ProItemIcons } from "./player-build";
import { gameTeams, identityHref } from "../browse/presentation";

const roles = ["top", "jungle", "mid", "bottom", "support"];
const teamNumber = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });
type Statistics = HistoricalParticipant["statistics"];
const playerMetrics = [
  {
    id: "cs",
    header: "CS",
    width: "3.5rem",
    read: (stats?: Statistics) => stats?.economy["total cs"],
  },
  {
    id: "gold",
    header: "Gold",
    width: "4.5rem",
    read: (stats?: Statistics) => stats?.economy.totalgold,
  },
  {
    id: "damage",
    header: "Damage",
    width: "4.5rem",
    read: (stats?: Statistics) => stats?.damage.damagetochampions,
  },
  {
    id: "vision",
    header: "Vision",
    width: "4.25rem",
    read: (stats?: Statistics) => stats?.vision.visionscore,
  },
];
const drakeStats = [
  ["infernal", "infernals", "infernaldrakes"],
  ["mountain", "mountains", "mountaindrakes"],
  ["cloud", "clouds", "clouddrakes"],
  ["ocean", "oceans", "oceandrakes"],
  ["chemtech", "chemtechs", "chemtechdrakes"],
  ["hextech", "hextechs", "hextechdrakes"],
  ["elder", "elders", "elders"],
] as const;
const formatMetric = (value: number | null | undefined) =>
  value == null ? "—" : teamNumber.format(value);
/** Counts drawn as one icon each; larger or fractional counts show one icon and the count. */
const iconLimit = 24;

type DrakeType = (typeof drakeStats)[number][0];

/** A row of icons, one per capture; a large or fractional count shows one icon and the count. */
function IconRow({
  label,
  entries,
}: {
  label: string;
  entries: { key: string; count: number; icon: ReactNode }[];
}) {
  return (
    <ul className="ev-lineup-card__icons" aria-label={label} role="list">
      {entries.flatMap(({ key, count, icon }) =>
        Number.isInteger(count) && count <= iconLimit ? (
          Array.from({ length: count }, (_, slot) => <li key={`${key}-${slot}`}>{icon}</li>)
        ) : (
          <li key={key}>
            {icon}
            <span>×{formatMetric(count)}</span>
          </li>
        ),
      )}
    </ul>
  );
}

/** Dragons as icons: elemental drakes first, then Elder Dragons on their own row. */
function DragonIcons({ drakes }: { drakes: { type: DrakeType; count: number }[] }) {
  return (["Elemental Dragons", "Elder Dragons"] as const).map((label) => {
    const entries = drakes
      .filter(({ type }) => (type === "elder") === (label === "Elder Dragons"))
      .map(({ type, count }, index) => ({
        key: `${type}-${index}`,
        count,
        icon: <DrakeIcon drake={type} />,
      }));
    return entries.length ? <IconRow key={label} label={label} entries={entries} /> : null;
  });
}

function roleOrder(role: string) {
  const index = roles.indexOf(roleKey(role.toLowerCase()) ?? "");
  return index === -1 ? roles.length : index;
}

export function LineupTable({
  game,
  detail,
  hidden,
  portraits,
  items,
}: {
  game: Game;
  detail?: HistoricalGameDetail | null | undefined;
  hidden: boolean;
  portraits?: ChampionPortraits | undefined;
  items?: ProItemIcons | undefined;
}) {
  const teams = gameTeams(game);
  const teamStats = teams.map(
    ({ side }) =>
      detail?.participants.find((p) => p.side === side && p.position === "team")?.statistics,
  );
  const facts = teamStats.map((stats) => [
    stats?.combat.kills ?? stats?.combat.teamkills ?? null,
    stats?.economy.totalgold ?? null,
    stats?.objectives.towers ?? null,
    stats?.objectives.turretplates ?? null,
    stats?.objectives.dragons ?? null,
    stats?.objectives.void_grubs ?? null,
    stats?.objectives.heralds ?? null,
    stats?.objectives.barons ?? null,
  ]);
  const drakeCounts = teamStats.map((stats) =>
    drakeStats.flatMap(([type, key, legacy]) => {
      const count = stats?.objectives[key] ?? stats?.objectives[legacy] ?? null;
      return count !== null && count > 0 ? [{ type, count }] : [];
    }),
  );
  /** Timed captures keep their order; otherwise the per-type totals stand in. */
  const drakes = teams.map(({ side }, index) => {
    const timed =
      detail?.telemetry?.events.flatMap((event) =>
        event.side === side && event.drake ? [{ type: event.drake, count: 1 }] : [],
      ) ?? [];
    return timed.length ? timed : drakeCounts[index]!;
  });
  const playersBySlot = new Map(
    detail?.participants
      .filter((entry) => entry.player)
      .map((entry) => [entry.slot, entry.statistics]),
  );
  const playerColumns = hidden
    ? []
    : playerMetrics.filter(({ read }) =>
        game.participants.some((p) => p.player && read(playersBySlot.get(p.slot)) != null),
      );
  const metrics = [
    "Kills",
    "Gold",
    "Towers",
    "Tower Plates",
    "Dragons",
    "Void Grubs",
    "Rift Herald",
    "Barons",
  ].flatMap((label, index) =>
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
        const builds = detail?.telemetry?.builds;
        const hasBuilds =
          !hidden &&
          players.some(
            (p) => builds?.[p.slot]?.inventory.length || builds?.[p.slot]?.purchases?.length,
          );
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
                      <dd>
                        {label === "Dragons" && value && drakes[index]!.length ? (
                          <DragonIcons drakes={drakes[index]!} />
                        ) : label === "Void Grubs" && value ? (
                          <IconRow
                            label="Captured Void Grubs"
                            entries={[
                              {
                                key: "grub",
                                count: value,
                                icon: <ObjectiveIcon objective="grub" />,
                              },
                            ]}
                          />
                        ) : label === "Barons" && value ? (
                          <IconRow
                            label="Captured Barons"
                            entries={[
                              {
                                key: "baron",
                                count: value,
                                icon: <ObjectiveIcon objective="baron" />,
                              },
                            ]}
                          />
                        ) : (
                          formatMetric(value)
                        )}
                      </dd>
                    </div>
                  );
                })}
              </dl>
            ) : null}
            <Table
              className={
                hasBuilds
                  ? "ev-lineup-card__equipment"
                  : playerColumns.length
                    ? "ev-lineup-card__player-stats"
                    : ""
              }
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
                  id: "player",
                  header: "Player",
                  render: (p) => {
                    if (!p.player) return "—";
                    const build = !hidden ? builds?.[p.slot] : undefined;
                    return (
                      <>
                        <TextLink
                          className="ev-lineup-player"
                          href={identityHref(p.player)}
                          title={p.player.name}
                        >
                          {p.player.name}
                        </TextLink>
                        {build ? (
                          <PlayerBuild build={build} items={items} player={p.player.name} />
                        ) : null}
                      </>
                    );
                  },
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
                ...playerColumns.map(({ id, header, width, read }) => ({
                  id,
                  header,
                  width,
                  align: "center" as const,
                  render: (player: Game["participants"][number]) =>
                    formatMetric(read(playersBySlot.get(player.slot))),
                })),
              ]}
            />
          </div>
        );
      })}
    </section>
  );
}
