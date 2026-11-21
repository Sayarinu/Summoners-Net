"use client";
import { Button, FilterBar, Panel, Select, Table, TextLink } from "@summonersnet/ui";
import { championPlayerSorts, type ChampionOverview } from "@summonersnet/data/contracts";
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
      title="Top Ladder Players"
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
        Players on the latest apex ladder with the most stored ranked games on this champion. Rank
        is from that ladder snapshot.
      </p>
      <Table
        caption="Champion Players"
        rows={players.page.items}
        getRowKey={(r) => `${r.platform}:${r.puuid}`}
        emptyMessage="No ladder players on this champion in this selection yet."
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
          { id: "games", header: "Games", render: (r) => r.games },
          {
            id: "win",
            header: "Win Rate",
            render: (r) => percent(r.winRate),
          },
          {
            id: "rank",
            header: "Rank",
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
