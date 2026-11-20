"use client";
import { Button, FilterBar, Panel, Select, Table, TextLink } from "@summonersnet/ui";
import {
  championPlayerMinimumGames,
  championPlayerSorts,
  type ChampionOverview,
} from "@summonersnet/data/contracts";
import { useRouter } from "next/navigation";
import { identityHref } from "../browse/presentation";
import { PageFooter } from "./paging";
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
    <Panel
      title="Top Sampled Ladder Players"
      padding="none"
      actions={
        <FilterBar action={`/champions/${overview.champion.id}`} method="get" key={players.sort}>
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
            hideLabel
            name="playersSort"
            defaultValue={players.sort}
            options={championPlayerSorts.map((value) => ({
              value,
              label: value === "games" ? "Games" : "Win Rate",
            }))}
          />
          <Button type="submit">Sort Players</Button>
        </FilterBar>
      }
    >
      <p className="max-w-reading px-4 pt-3 text-sm text-fg-muted">
        At least {championPlayerMinimumGames} retained ranked solo games on this champion in the
        selected patch and role. Win rate needs {championPlayerMinimumGames} known results; its
        sample is shown separately. These samples do not cover every game played. Only players in
        the last successful apex ladder snapshot appear. Rank is from that snapshot, not the time of
        each game. The tier filter uses the player&apos;s ladder tier.
      </p>
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
              <div className="flex flex-col gap-1">
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
              <div className="flex flex-col gap-1">
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
      <PageFooter
        summary={`${players.page.total} player accounts · Page ${players.page.page}`}
        label="Champion Player Pages"
        page={players.page.page}
        total={players.page.total}
        pageSize={players.page.pageSize}
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
    </Panel>
  );
}
