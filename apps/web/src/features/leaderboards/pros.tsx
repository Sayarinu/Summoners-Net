"use client";
import { GameResult } from "../browse/visuals";
import {
  ChampionIcon,
  EmptyState,
  FilterBar,
  PageHeader,
  Pagination,
  Panel,
  Select,
  Table,
  TextLink,
} from "@summonersnet/ui";
import type { ProFeed } from "@summonersnet/data/contracts";
import { useRouter } from "next/navigation";
import { dateTime, identityHref } from "../browse/presentation";
export function ProFeedPage({
  feed,
  error,
  timezone,
}: {
  feed: ProFeed | null;
  error: string | null;
  timezone: string;
}) {
  const router = useRouter();
  function navigate(change: Record<string, string>) {
    const params = new URLSearchParams({
      team: feed?.query.team ?? "",
      league: feed?.query.league ?? "",
      page: "1",
      pageSize: String(feed?.query.pageSize ?? 25),
      ...change,
    });
    for (const [key, value] of [...params]) if (!value) params.delete(key);
    router.push(`/leaderboards/pros?${params}`);
  }
  return (
    <div className="flex min-w-0 flex-col gap-6">
      <PageHeader
        breadcrumbs={[{ label: "Leaderboards", href: "/leaderboards" }, { label: "Pro Accounts" }]}
        title="Pros in Solo Queue"
      />
      {error ? (
        <p role="alert">{error}</p>
      ) : feed ? (
        <>
          <FilterBar
            className="border-y border-line py-3"
            onSubmit={(event) => event.preventDefault()}
          >
            <Select
              label="Team"
              value={feed.query.team || "all"}
              options={[
                { value: "all", label: "All Teams" },
                ...feed.teams.map((t) => ({ value: t.id, label: t.name })),
                ...(feed.query.team && !feed.teams.some((t) => t.id === feed.query.team)
                  ? [{ value: feed.query.team, label: feed.query.team }]
                  : []),
              ]}
              onValueChange={(v) => navigate({ team: v === "all" ? "" : v })}
            />
            <Select
              label="League"
              value={feed.query.league || "all"}
              options={[
                { value: "all", label: "All Leagues" },
                ...feed.leagues.map((l) => ({ value: l, label: l })),
                ...(feed.query.league && !feed.leagues.includes(feed.query.league)
                  ? [{ value: feed.query.league, label: feed.query.league }]
                  : []),
              ]}
              onValueChange={(v) => navigate({ league: v === "all" ? "" : v })}
            />
            <TextLink className="self-end py-2.5" href="/leaderboards/pros">
              Clear Filters
            </TextLink>
          </FilterBar>
          {feed.page.total === 0 ? (
            <EmptyState
              title="No Linked Solo Queue Games"
              description="No pro account links or matching ranked solo games are stored for these filters yet. Try clearing the filters."
            />
          ) : (
            <Panel title="Recent Games" padding="none">
              <Table
                caption="Recent Pro Solo Queue Games"
                rows={feed.page.items}
                getRowKey={(r) => `${r.matchId}:${r.participantId}`}
                emptyMessage="No games on this page."
                columns={[
                  {
                    id: "player",
                    header: "Player",
                    render: (r) => (
                      <div className="grid gap-1">
                        <TextLink href={identityHref(r.player)}>{r.player.name}</TextLink>
                        <TextLink href={`/summoners/${encodeURIComponent(r.puuid)}`}>
                          Solo Queue Profile
                        </TextLink>
                      </div>
                    ),
                  },
                  {
                    id: "team",
                    header: "Last Pro Team",
                    render: (r) =>
                      r.team ? (
                        <TextLink href={identityHref(r.team)}>{r.team.name}</TextLink>
                      ) : (
                        "Unknown"
                      ),
                  },
                  { id: "league", header: "Last Pro League", render: (r) => r.league ?? "Unknown" },
                  {
                    id: "observed",
                    header: "Pro Appearance",
                    render: (r) =>
                      r.proObservedAt ? dateTime(r.proObservedAt, timezone) : "Unknown",
                  },
                  {
                    id: "champion",
                    header: "Champion",
                    render: (r) => (
                      <span className="inline-flex items-center gap-2">
                        <ChampionIcon
                          id={r.championId ?? String(r.championKey)}
                          name={r.championName ?? `Champion ${r.championKey}`}
                          imageUrl={r.imageUrl}
                          size="small"
                        />
                      </span>
                    ),
                  },
                  {
                    id: "result",
                    header: "Result",
                    render: (r) => <GameResult won={r.win} />,
                  },
                  {
                    id: "time",
                    header: "Game Time",
                    render: (r) => dateTime(r.occurredAt, timezone),
                  },
                ]}
              />
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-line px-4 py-4">
                <span className="np-meta text-accent">
                  {feed.page.total} player games · Page {feed.page.page}
                </span>
                <Pagination
                  label="Pro Solo Queue Pages"
                  currentPage={feed.page.page}
                  totalPages={Math.max(1, Math.ceil(feed.page.total / feed.page.pageSize))}
                  onPageChange={(page) => navigate({ page: String(page) })}
                />
              </div>
            </Panel>
          )}
        </>
      ) : null}
    </div>
  );
}
