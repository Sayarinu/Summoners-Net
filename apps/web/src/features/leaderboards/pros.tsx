"use client";
import { ChampionIcon, EmptyState, Pagination, Select, Table, TextLink } from "@summonersnet/ui";
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
    <div className="np-stack">
      <header className="ev-title">
        <div>
          <span className="np-overline">Linked pro accounts</span>
          <h1>Pros in Solo Queue</h1>
          <p>Recent retained ranked solo games on accounts with imported evidence links.</p>
        </div>
      </header>
      <p className="np-meta">
        Team and league come from each player’s last stored complete pro appearance. They do not
        establish current roster membership. Conflicting observations remain unknown.
      </p>
      {error ? (
        <p role="alert">{error}</p>
      ) : feed ? (
        <>
          <div className="ev-filters">
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
            <TextLink href="/leaderboards/pros">Clear Filters</TextLink>
          </div>
          {feed.page.total === 0 ? (
            <EmptyState
              title="No Linked Solo Queue Games"
              description="No pro account links or matching ranked solo games are stored for these filters yet. Try clearing the filters."
            />
          ) : (
            <>
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
                      <div className="np-stack">
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
                      <span className="ev-champion">
                        <ChampionIcon
                          id={r.championId ?? String(r.championKey)}
                          name={r.championName ?? `Champion ${r.championKey}`}
                          imageUrl={r.imageUrl}
                          size="small"
                        />
                        {r.championName ?? `Champion ${r.championKey}`}
                      </span>
                    ),
                  },
                  {
                    id: "result",
                    header: "Result",
                    render: (r) => (r.win === null ? "Unknown" : r.win ? "Win" : "Loss"),
                  },
                  {
                    id: "time",
                    header: "Game Time",
                    render: (r) => dateTime(r.occurredAt, timezone),
                  },
                ]}
              />
              <div className="ev-pagination">
                <span className="np-meta">
                  {feed.page.total} player games · Page {feed.page.page}
                </span>
                <Pagination
                  label="Pro Solo Queue Pages"
                  currentPage={feed.page.page}
                  totalPages={Math.max(1, Math.ceil(feed.page.total / feed.page.pageSize))}
                  onPageChange={(page) => navigate({ page: String(page) })}
                />
              </div>
            </>
          )}
        </>
      ) : null}
    </div>
  );
}
