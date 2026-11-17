"use client";
import { ChampionIcon, EmptyState, Table, TextLink } from "@summonersnet/ui";
import { matchupRoles, type ChampionDirectory } from "@summonersnet/data/contracts";

const roles = {
  TOP: "Top",
  JUNGLE: "Jungle",
  MIDDLE: "Mid",
  BOTTOM: "Bot",
  UTILITY: "Support",
} as const;

/** Every catalog champion, and the champion and matchup analytics reachable from here. */
export function ChampionsPage({ directory: d }: { directory: ChampionDirectory }) {
  return (
    <div className="np-stack">
      <header className="ev-title">
        <div>
          <span className="np-overline">{d.patch ? `Catalog patch ${d.patch}` : "Catalog"}</span>
          <h1>Champions</h1>
        </div>
      </header>
      <nav aria-label="Champion analytics" className="np-stack">
        <p>
          <TextLink href="/tier-list">Tier list</TextLink> ·{" "}
          <TextLink href="/trending">Trending champions</TextLink> ·{" "}
          <TextLink href="/drafts/assistant">Draft assistant</TextLink>
        </p>
        <h2>Matchups by role</h2>
        <ul>
          {matchupRoles.map((r) => (
            <li key={r}>
              {roles[r]}: <TextLink href={`/matchups/${r}`}>matchup matrix</TextLink> ·{" "}
              <TextLink href={`/matchups/${r}/counter-picks`}>counter-pick values</TextLink>
            </li>
          ))}
        </ul>
      </nav>
      {d.champions.length ? (
        <Table
          caption="Champions in the catalog"
          rows={d.champions}
          getRowKey={(c) => c.championId}
          columns={[
            {
              id: "champion",
              header: "Champion",
              render: (c) => (
                <span className="ev-champion">
                  <ChampionIcon
                    id={c.championId}
                    name={c.name}
                    imageUrl={c.imageUrl}
                    size="small"
                  />
                  <TextLink href={`/champions/${c.championId}`}>{c.name}</TextLink>
                </span>
              ),
            },
            {
              id: "matchups",
              header: "Lane matchups",
              render: (c) => (
                <TextLink
                  href={`/champions/${c.championId}/matchups`}
                  aria-label={`${c.name} lane matchups`}
                >
                  Matchups
                </TextLink>
              ),
            },
          ]}
        />
      ) : (
        <EmptyState
          title="No champion catalog yet"
          description={
            <span>
              The catalog arrives with the first metadata sync. See{" "}
              <TextLink href="/sources">Sources</TextLink>.
            </span>
          }
        />
      )}
    </div>
  );
}
