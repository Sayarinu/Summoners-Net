"use client";
import { TextLink } from "@summonersnet/ui";
import { riotPlatforms } from "@summonersnet/data/contracts";

/** The leaderboards: win probability added, linked pro accounts and each regional ladder. */
export function LeaderboardsPage() {
  return (
    <div className="np-stack">
      <header className="ev-title">
        <div>
          <h1>Leaderboards</h1>
        </div>
      </header>
      <ul>
        <li>
          <TextLink href="/leaderboards/wpa">Win Probability Added</TextLink>: champions, players
          and roles ranked by the active model.
        </li>
        <li>
          <TextLink href="/leaderboards/pros">Pro Accounts</TextLink>: solo-queue accounts linked to
          pro players.
        </li>
      </ul>
      <section className="np-stack" aria-labelledby="ladders">
        <h2 id="ladders">Regional Solo-Queue Ladders</h2>
        <ul>
          {riotPlatforms.map((p) => (
            <li key={p}>
              <TextLink href={`/leaderboards/${p}`}>{p.toUpperCase()}</TextLink>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
