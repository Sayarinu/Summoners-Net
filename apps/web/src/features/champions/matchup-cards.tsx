"use client";
import { Card, ChampionIcon, ChampionIdentity, Panel, RoleIcon, Table } from "@summonersnet/ui";
import type { MatchupRow, MatchupMetric } from "@summonersnet/data/contracts";
import { signedPoints, type MatchupSummary } from "./presentation";

const opponentName = (row: MatchupRow) =>
  row.opponent.name ?? row.opponent.championId ?? `Champion ${row.opponent.championKey}`;
const rate = (value: number | null) => (value === null ? "—" : `${(value * 100).toFixed(1)}%`);
const difference = (value: number | null) =>
  value === null ? "—" : `${value > 0 ? "+" : ""}${Math.round(value).toLocaleString()}`;
const championHref = (row: MatchupRow) =>
  row.opponent.championId ? `/champions/${encodeURIComponent(row.opponent.championId)}` : undefined;

function OpponentCard({ row, tone }: { row: MatchupRow; tone: "good" | "bad" }) {
  const estimate = row.metrics.winRate;
  const delta =
    estimate.shrunk !== null && estimate.baseline !== null
      ? estimate.shrunk - estimate.baseline
      : null;
  const href = championHref(row);
  return (
    <li>
      <Card className="items-center gap-1 px-1 py-3 text-center" {...(href ? { href } : {})}>
        <ChampionIcon
          id={row.opponent.championId ?? String(row.opponent.championKey)}
          name={opponentName(row)}
          imageUrl={row.opponent.imageUrl}
          size="large"
        />
        <strong
          className={`font-mono font-medium ${tone === "good" ? "text-success" : "text-loss"}`}
        >
          {signedPoints(delta)}
        </strong>
        <small className="font-mono text-2xs text-fg-muted">
          {rate(estimate.raw)} WR · {row.games.toLocaleString()} Games
        </small>
      </Card>
    </li>
  );
}

function Opponents({
  title,
  rows,
  tone,
}: {
  title: string;
  rows: MatchupRow[];
  tone: "good" | "bad";
}) {
  const id = `${tone}-against-heading`;
  if (!rows.length) return null;
  return (
    <section aria-labelledby={id}>
      <h3
        id={id}
        className={`mb-3 text-xs font-semibold tracking-wide uppercase ${tone === "good" ? "text-success" : "text-loss"}`}
      >
        {title}
      </h3>
      <ul className="grid list-none grid-cols-[repeat(auto-fill,minmax(104px,1fr))] gap-2">
        {rows.map((row) => (
          <OpponentCard key={row.opponent.championKey} row={row} tone={tone} />
        ))}
      </ul>
    </section>
  );
}

const lane = (metric: MatchupMetric) => (row: MatchupRow) => difference(row.metrics[metric].raw);

/**
 * The best and worst lane opponents as champion cards, one row each, then every opponent met
 * on request. A card's difference is the shrunk win rate against that opponent minus the
 * champion's own win rate in this role.
 */
export function MatchupCards({ summary }: { summary: MatchupSummary | null }) {
  if (!summary || !summary.all.length) return null;
  return (
    <Panel
      title={
        <span className="inline-flex items-center gap-2">
          Matchups <RoleIcon role={summary.role} />
        </span>
      }
    >
      <div className="flex flex-col gap-5">
        <Opponents title="Good Against" rows={summary.best} tone="good" />
        <Opponents title="Bad Against" rows={summary.worst} tone="bad" />
        <details className="border-t border-line pt-3">
          <summary className="cursor-pointer text-sm text-accent">
            Show All {summary.opponents.toLocaleString()} Opponents
          </summary>
          <Table
            className="mt-3"
            caption="All Lane Opponents"
            compact
            rows={summary.all}
            getRowKey={(row) => String(row.opponent.championKey)}
            columns={[
              {
                id: "opponent",
                header: "Opponent",
                render: (row) => {
                  const href = championHref(row);
                  return (
                    <ChampionIdentity
                      id={row.opponent.championId ?? String(row.opponent.championKey)}
                      name={opponentName(row)}
                      imageUrl={row.opponent.imageUrl}
                      size="compact"
                      {...(href ? { href } : {})}
                    />
                  );
                },
              },
              {
                id: "games",
                header: "Games",
                align: "end",
                render: (row) => row.games.toLocaleString(),
              },
              {
                id: "winRate",
                header: "Win Rate",
                align: "end",
                render: (row) => rate(row.metrics.winRate.raw),
              },
              { id: "gold15", header: "Gold at 15", align: "end", render: lane("gold15") },
              { id: "cs15", header: "CS at 15", align: "end", render: lane("cs15") },
              { id: "xp15", header: "XP at 15", align: "end", render: lane("xp15") },
            ]}
          />
        </details>
      </div>
    </Panel>
  );
}
