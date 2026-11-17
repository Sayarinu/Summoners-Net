"use client";
import { Button, Pagination, Select, Table, TextLink } from "@summonersnet/ui";
import {
  championPlayerMinimumGames,
  championPlayerSorts,
  type ChampionOverview,
} from "@summonersnet/data/contracts";
import { useRouter } from "next/navigation";
import { identityHref } from "../browse/presentation";
import { percent } from "./presentation";
export function PlayersSection({
  overview,
}: {
  overview: Pick<ChampionOverview, "players" | "query" | "champion">;
}) {
  const router = useRouter();
  const { players, query: q } = overview;
  if (!players) return null;
  return (
    <section className="np-stack" aria-labelledby="champion-players-heading">
      <h2 id="champion-players-heading">Top Sampled Ladder Players</h2>
      <p>
        At least {championPlayerMinimumGames} retained ranked solo games on this champion in the
        selected patch and role. Win rate needs {championPlayerMinimumGames} known results; its
        sample is shown separately. These samples do not cover every game played.
      </p>
      <p>
        Only players in the last successful apex ladder snapshot appear. Rank is from that snapshot,
        not the time of each game. The tier filter uses the player&apos;s ladder tier.
      </p>
      <form
        action={`/champions/${overview.champion.id}`}
        method="get"
        className="ev-filters"
        key={players.sort}
      >
        {Object.entries(q)
          .filter(
            ([key, value]) =>
              value !== undefined && !["champion", "playersSort", "playersPage"].includes(key),
          )
          .map(([key, value]) => (
            <input key={key} type="hidden" name={key} value={value} />
          ))}
        <Select
          label="Sort Players By"
          name="playersSort"
          defaultValue={players.sort}
          options={championPlayerSorts.map((value) => ({
            value,
            label: value === "games" ? "Games" : "Win Rate",
          }))}
        />
        <Button type="submit">Sort Players</Button>
      </form>
      <Table
        caption="Sampled Champion Players"
        rows={players.page.items}
        getRowKey={(r) => `${r.platform}:${r.puuid}`}
        emptyMessage="No current ladder players have enough sampled games for this selection."
        columns={[
          {
            id: "player",
            header: "Player",
            render: (r) => (
              <div className="np-stack">
                <TextLink href={`/summoners/${encodeURIComponent(r.puuid)}?platform=${r.platform}`}>
                  {r.gameName && r.tagLine ? `${r.gameName}#${r.tagLine}` : r.puuid}
                </TextLink>
                {r.pro ? <TextLink href={identityHref(r.pro)}>Pro: {r.pro.name}</TextLink> : null}
              </div>
            ),
          },
          { id: "games", header: "Sampled Games", render: (r) => r.games },
          {
            id: "win",
            header: "Win Rate",
            render: (r) => `${percent(r.winRate)} · n=${r.winRate.sampleCount} known results`,
          },
          {
            id: "rank",
            header: "Current Stored Rank",
            render: (r) => (
              <div className="np-stack">
                <span>
                  {r.platform.toUpperCase()} · {r.tier} · {r.leaguePoints} LP
                </span>
                <span className="np-meta">
                  Observed {new Date(r.ladderObservedAt).toISOString().slice(0, 10)}
                </span>
              </div>
            ),
          },
        ]}
      />
      <div className="ev-pagination">
        <span className="np-meta">
          {players.page.total} player accounts · Page {players.page.page}
        </span>
        <Pagination
          label="Champion Player Pages"
          currentPage={players.page.page}
          totalPages={Math.max(1, Math.ceil(players.page.total / players.page.pageSize))}
          onPageChange={(page) => {
            const params = new URLSearchParams(
              Object.entries(q)
                .filter(([key, value]) => value !== undefined && key !== "champion")
                .map(([key, value]) => [key, String(value)]),
            );
            params.set("playersPage", String(page));
            router.push(`/champions/${overview.champion.id}?${params}`);
          }}
        />
      </div>
    </section>
  );
}
