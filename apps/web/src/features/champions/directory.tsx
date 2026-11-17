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
      <nav aria-label="Champion Analytics" className="np-stack">
        <p>
          <TextLink href="/tier-list">Tier List</TextLink> ·{" "}
          <TextLink href="/trending">Trending Champions</TextLink> ·{" "}
          <TextLink href="/drafts/assistant">Draft Assistant</TextLink>
        </p>
        <h2>Matchups by Role</h2>
        <ul>
          {matchupRoles.map((r) => (
            <li key={r}>
              {roles[r]}: <TextLink href={`/matchups/${r}`}>Matchup Matrix</TextLink> ·{" "}
              <TextLink href={`/matchups/${r}/counter-picks`}>Counter-Pick Values</TextLink>
            </li>
          ))}
        </ul>
      </nav>
      {d.champions.length ? (
        <Table
          caption="Champions in the Catalog"
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
              header: "Lane Matchups",
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
          title="No Champion Catalog Yet"
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
