"use client";
import {
  ChampionIcon,
  EmptyState,
  PageHeader,
  Pagination,
  Panel,
  TabNav,
  Table,
  TextLink,
} from "@summonersnet/ui";
import { riotPlatforms, type Leaderboard } from "@summonersnet/data/contracts";
import { useRouter } from "next/navigation";
import { dateTime } from "../browse/presentation";
export function LeaderboardPage({
  list,
  error,
  region,
  timezone,
}: {
  list: Leaderboard | null;
  error: string | null;
  region: string;
  timezone: string;
}) {
  const router = useRouter();
  return (
    <div className="flex min-w-0 flex-col gap-6">
      <PageHeader
        breadcrumbs={[
          { label: "Leaderboards", href: "/leaderboards" },
          { label: region.toUpperCase() },
        ]}
        eyebrow={
          list?.lastSuccess ? `Last Refreshed ${dateTime(list.lastSuccess, timezone)}` : undefined
        }
        title={`${region.toUpperCase()} Leaderboard`}
      >
        <TabNav
          label="Ladder Regions"
          items={riotPlatforms.map((r) => ({
            href: `/leaderboards/${r}`,
            label: r.toUpperCase(),
            current: r === region,
          }))}
        />
      </PageHeader>
      {error ? (
        <p role="alert">{error}</p>
      ) : !list?.lastSuccess ? (
        <EmptyState
          title="No Ladder Stored for This Region"
          description="The ladder appears once the worker synchronizes this region."
        />
      ) : (
        <>
          {list.refreshFailed ? (
            <p role="status" className="text-sm text-warning">
              The last refresh failed
              {list.lastAttempt ? ` at ${dateTime(list.lastAttempt, timezone)}` : ""}. Showing the
              previous successful ladder.
            </p>
          ) : null}
          <Panel title="Regional Ladder" padding="none">
            <Table
              caption={`${region.toUpperCase()} solo queue ladder`}
              rows={list.page.items}
              getRowKey={(r) => r.puuid}
              emptyMessage="No ladder entries on this page."
              columns={[
                { id: "rank", header: "Rank", align: "end", render: (r) => r.rank },
                {
                  id: "name",
                  header: "Riot ID",
                  render: (r) => (
                    <TextLink href={`/summoners/${encodeURIComponent(r.puuid)}`}>
                      {r.gameName && r.tagLine
                        ? `${r.gameName}#${r.tagLine}`
                        : "Riot ID not resolved"}
                    </TextLink>
                  ),
                },
                { id: "tier", header: "Tier", render: (r) => r.tier },
                { id: "lp", header: "LP", align: "end", render: (r) => r.leaguePoints },
                { id: "wins", header: "Wins", align: "end", render: (r) => r.wins },
                { id: "losses", header: "Losses", align: "end", render: (r) => r.losses },
                {
                  id: "rate",
                  header: "Win Rate",
                  align: "end",
                  render: (r) => (
                    <span>
                      {r.winRate.value === null
                        ? "Unknown"
                        : `${(100 * r.winRate.value).toFixed(1)}%`}{" "}
                      · {r.winRate.sampleCount} games
                    </span>
                  ),
                },
                {
                  id: "champions",
                  header: "Most Played",
                  render: (r) =>
                    r.champions.length ? (
                      <div className="grid gap-1">
                        {r.champions.map((c) => (
                          <span key={c.championKey} className="inline-flex items-center gap-2">
                            <ChampionIcon
                              id={c.championId ?? String(c.championKey)}
                              name={c.name ?? `Champion ${c.championKey}`}
                              imageUrl={c.imageUrl}
                              size="small"
                            />
                            {c.games} {c.games === 1 ? "game" : "games"}
                          </span>
                        ))}
                        <span className="np-meta">{r.sampledGames} sampled games</span>
                      </div>
                    ) : (
                      "No sampled games"
                    ),
                },
              ]}
            />
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-line px-4 py-4">
              <span className="np-meta text-accent">
                {list.page.total} players · Page {list.page.page}
              </span>
              <Pagination
                label="Ladder Pages"
                currentPage={list.page.page}
                totalPages={Math.max(1, Math.ceil(list.page.total / list.page.pageSize))}
                onPageChange={(page) =>
                  router.push(`/leaderboards/${region}?page=${page}&pageSize=${list.page.pageSize}`)
                }
              />
            </div>
          </Panel>
        </>
      )}
    </div>
  );
}
