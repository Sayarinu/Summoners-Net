"use client";
import { Card, CardLink, PageHeader, Panel } from "@summonersnet/ui";
import { riotPlatforms } from "@summonersnet/data/contracts";

const boards = [
  {
    href: "/leaderboards/wpa",
    title: "Win Probability Added",
    description: "Champions, players and roles ranked by the active model.",
  },
  {
    href: "/leaderboards/pros",
    title: "Pro Accounts",
    description: "Solo queue accounts linked to pro players.",
  },
];

/** The leaderboards: win probability added, linked pro accounts and each regional ladder. */
export function LeaderboardsPage() {
  return (
    <div className="flex min-w-0 flex-col gap-6">
      <PageHeader title="Leaderboards" />
      <ul className="grid list-none grid-cols-2 gap-3 max-[700px]:grid-cols-1">
        {boards.map((board) => (
          <li key={board.href}>
            <Card className="min-h-24 justify-center">
              <CardLink href={board.href} className="text-lg font-medium">
                {board.title}
              </CardLink>
              <p className="text-sm text-fg-secondary">{board.description}</p>
            </Card>
          </li>
        ))}
      </ul>
      <Panel title="Regional Solo Queue Ladders">
        <ul className="grid list-none grid-cols-[repeat(auto-fill,minmax(112px,1fr))] gap-3">
          {riotPlatforms.map((p) => (
            <li key={p}>
              <Card className="items-center justify-center py-3">
                <CardLink href={`/leaderboards/${p}`} className="font-mono font-medium">
                  {p.toUpperCase()}
                </CardLink>
              </Card>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
