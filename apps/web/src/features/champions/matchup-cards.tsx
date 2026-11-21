"use client";
import { Card, ChampionIcon, Panel, RoleIcon, TextLink } from "@summonersnet/ui";
import type { MatchupRow } from "@summonersnet/data/contracts";
import { appendPatches, signedPoints, type MatchupSummary } from "./presentation";

function OpponentCard({ row, tone }: { row: MatchupRow; tone: "good" | "bad" }) {
  const { opponent } = row;
  const estimate = row.metrics.winRate;
  const name = opponent.name ?? opponent.championId ?? `Champion ${opponent.championKey}`;
  const delta =
    estimate.shrunk !== null && estimate.baseline !== null
      ? estimate.shrunk - estimate.baseline
      : null;
  return (
    <li>
      <Card
        className="items-center gap-1 px-1 py-3 text-center"
        {...(opponent.championId
          ? { href: `/champions/${encodeURIComponent(opponent.championId)}` }
          : {})}
      >
        <ChampionIcon
          id={opponent.championId ?? String(opponent.championKey)}
          name={name}
          imageUrl={opponent.imageUrl}
          size="large"
        />
        <strong
          className={`font-mono font-medium ${tone === "good" ? "text-success" : "text-loss"}`}
        >
          {signedPoints(delta)}
        </strong>
        <small className="text-2xs text-fg-muted">{row.games.toLocaleString()} Games</small>
      </Card>
    </li>
  );
}

function Opponents({
  title,
  rows,
  tone,
  empty,
}: {
  title: string;
  rows: MatchupRow[];
  tone: "good" | "bad";
  empty: string;
}) {
  const id = `${tone}-against-heading`;
  return (
    <section aria-labelledby={id}>
      <h3
        id={id}
        className={`mb-3 text-xs font-semibold tracking-wide uppercase ${tone === "good" ? "text-success" : "text-loss"}`}
      >
        {title}
      </h3>
      {rows.length ? (
        <ul className="grid list-none grid-cols-5 gap-2 max-[420px]:grid-cols-3">
          {rows.map((row) => (
            <OpponentCard key={row.opponent.championKey} row={row} tone={tone} />
          ))}
        </ul>
      ) : (
        <p className="text-xs text-fg-muted">{empty}</p>
      )}
    </section>
  );
}

/**
 * The best and worst lane opponents as champion cards. The difference is the shrunk win rate
 * against that opponent minus the champion's own win rate in this role.
 */
export function MatchupCards({
  championId,
  summary,
}: {
  championId: string;
  summary: MatchupSummary | null;
}) {
  if (!summary || (!summary.best.length && !summary.worst.length)) return null;
  const fullList = `/champions/${encodeURIComponent(championId)}/matchups?${appendPatches(
    new URLSearchParams({ source: summary.source, role: summary.role }),
    summary.patches,
  )}`;
  return (
    <Panel
      title={
        <span className="inline-flex items-center gap-2">
          Matchups <RoleIcon role={summary.role} />
        </span>
      }
      actions={<TextLink href={fullList}>Full List ({summary.opponents})</TextLink>}
    >
      <div className="grid grid-cols-2 gap-6 max-[900px]:grid-cols-1">
        <Opponents
          title="Good Against"
          rows={summary.best}
          tone="good"
          empty="No Opponent Above Average Yet"
        />
        <Opponents
          title="Bad Against"
          rows={summary.worst}
          tone="bad"
          empty="No Opponent Below Average Yet"
        />
      </div>
    </Panel>
  );
}
