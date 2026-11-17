"use client";
import { ChampionIcon, RoleIcon, TextLink } from "@summonersnet/ui";
import type { MatchupRow } from "@summonersnet/data/contracts";
import { signedPoints, type MatchupSummary } from "./presentation";

function OpponentCard({ row, tone }: { row: MatchupRow; tone: "good" | "bad" }) {
  const { opponent } = row;
  const estimate = row.metrics.winRate;
  const name = opponent.name ?? opponent.championId ?? `Champion ${opponent.championKey}`;
  const delta =
    estimate.shrunk !== null && estimate.baseline !== null
      ? estimate.shrunk - estimate.baseline
      : null;
  const card = (
    <>
      <ChampionIcon
        id={opponent.championId ?? String(opponent.championKey)}
        name={name}
        imageUrl={opponent.imageUrl}
        size="large"
      />
      <strong className={`ev-opponent__delta ev-opponent__delta--${tone}`}>
        {signedPoints(delta)}
      </strong>
      <small>{row.games.toLocaleString()} Games</small>
    </>
  );
  return (
    <li className="ev-opponent">
      {opponent.championId ? (
        <a href={`/champions/${encodeURIComponent(opponent.championId)}`}>{card}</a>
      ) : (
        <div>{card}</div>
      )}
    </li>
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
  const fullList = `/champions/${encodeURIComponent(championId)}/matchups?${new URLSearchParams({
    source: summary.source,
    role: summary.role,
    patch: summary.patch,
  })}`;
  return (
    <section className="ev-card" aria-labelledby="matchup-cards-heading">
      <div className="ev-card__header">
        <h2 id="matchup-cards-heading">
          Matchups <RoleIcon role={summary.role} />
        </h2>
        <TextLink href={fullList}>Full List ({summary.opponents})</TextLink>
      </div>
      <div className="ev-matchup-columns">
        <section aria-labelledby="good-against-heading">
          <h3 id="good-against-heading" className="ev-matchup-label ev-matchup-label--good">
            Good Against
          </h3>
          {summary.best.length ? (
            <ul className="ev-opponents">
              {summary.best.map((row) => (
                <OpponentCard key={row.opponent.championKey} row={row} tone="good" />
              ))}
            </ul>
          ) : (
            <p className="ev-build-stat">No Opponent Above Average Yet</p>
          )}
        </section>
        <section aria-labelledby="bad-against-heading">
          <h3 id="bad-against-heading" className="ev-matchup-label ev-matchup-label--bad">
            Bad Against
          </h3>
          {summary.worst.length ? (
            <ul className="ev-opponents">
              {summary.worst.map((row) => (
                <OpponentCard key={row.opponent.championKey} row={row} tone="bad" />
              ))}
            </ul>
          ) : (
            <p className="ev-build-stat">No Opponent Below Average Yet</p>
          )}
        </section>
      </div>
    </section>
  );
}
