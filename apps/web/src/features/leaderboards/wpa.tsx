"use client";
import { ExportLink } from "../shell/export-link";
import {
  Button,
  EmptyState,
  Pagination,
  Select,
  StatusIndicator,
  Table,
  TextLink,
} from "@summonersnet/ui";
import type { WpaLeaderboard, WpaLeaderboardRow } from "@summonersnet/data/contracts";

const kindLabels = { champion: "Champions", player: "Players", role: "Roles" } as const;
const sortLabels = { perGame: "Per game", total: "Total", games: "Games" } as const;
const roleLabels: Record<string, string> = {
  TOP: "Top",
  JUNGLE: "Jungle",
  MIDDLE: "Mid",
  BOTTOM: "Bot",
  UTILITY: "Support",
  UNKNOWN: "Unknown role",
};
const points = (value: number | null, digits = 2) =>
  value === null ? "Unknown" : `${value >= 0 ? "+" : ""}${value.toFixed(digits)} pts`;
function Subject({ row }: { row: WpaLeaderboardRow }) {
  if (row.kind === "champion")
    return row.championId ? (
      <TextLink href={`/champions/${row.championId}`}>{row.name ?? row.subject}</TextLink>
    ) : (
      <>{row.name ?? `Champion ${row.subject}`}</>
    );
  if (row.kind === "player")
    return (
      <TextLink href={`/summoners/${encodeURIComponent(row.subject)}`}>
        {row.name ?? "Unresolved player"}
      </TextLink>
    );
  return <>{roleLabels[row.subject] ?? row.subject}</>;
}
export function WpaLeaderboardPage({
  board,
  error,
}: {
  board: WpaLeaderboard | null;
  error: string | null;
}) {
  const q = board?.query;
  return (
    <div className="np-stack">
      <header className="ev-title">
        <div>
          <span className="np-overline">Solo queue</span>
          <h1>Win probability added</h1>
          <p>
            Who moved games: each kill and objective&apos;s change in win probability, shared by the
            players involved and summed per game.
          </p>
        </div>
      </header>
      <form action="/leaderboards/wpa" method="get" className="ev-filters" key={JSON.stringify(q)}>
        <Select
          label="Board"
          name="kind"
          defaultValue={q?.kind ?? "champion"}
          options={Object.entries(kindLabels).map(([value, label]) => ({ label, value }))}
        />
        <Select
          label="Patch"
          name="patch"
          defaultValue={q?.patch ?? "all"}
          options={[
            { label: "Newest", value: "all" },
            ...(board?.patches ?? []).map((p) => ({ label: p, value: p })),
          ]}
        />
        <Select
          label="Sort by"
          name="sort"
          defaultValue={q?.sort ?? "perGame"}
          options={Object.entries(sortLabels).map(([value, label]) => ({ label, value }))}
        />
        <Button type="submit">Apply filters</Button>
      </form>
      {error ? (
        <p role="alert">{error}</p>
      ) : !board?.model ? (
        <EmptyState
          title="No win probability model yet"
          description="Leaderboards appear once a model is published from enough stored games."
        />
      ) : !board.patch ? (
        <EmptyState
          title="No scored games yet"
          description="Games are scored with the active model as they are ingested."
        />
      ) : (
        <section className="np-stack" aria-label="Win probability added leaderboard">
          <p className="np-meta">
            Patch {board.patch} · model v{board.model.modelVersion} (#{board.model.id}
            {board.model.brier === null ? "" : `, Brier ${board.model.brier.toFixed(3)}`}). Values
            are percentage points of win probability; rows with fewer than 10 games show no value.
          </p>
          <ExportLink
            table="wpa"
            filters={{ kind: board.query.kind, patch: board.patch, sort: board.query.sort }}
          />
          <Table
            caption={`${kindLabels[board.query.kind]} by win probability added`}
            rows={board.page.items}
            getRowKey={(r) => r.subject}
            emptyMessage="No rows for this patch."
            columns={[
              {
                id: "rank",
                header: "#",
                align: "end",
                render: (r) =>
                  (board.page.page - 1) * board.page.pageSize + board.page.items.indexOf(r) + 1,
              },
              {
                id: "subject",
                header: kindLabels[board.query.kind],
                render: (r) => <Subject row={r} />,
              },
              { id: "games", header: "Games", align: "end", render: (r) => r.games },
              {
                id: "perGame",
                header: "Per game",
                align: "end",
                render: (r) =>
                  r.perGame.value === null ? (
                    <StatusIndicator label="Too few games" tone="warning" />
                  ) : (
                    points(r.perGame.value)
                  ),
              },
              {
                id: "total",
                header: "Total",
                align: "end",
                render: (r) => points(r.total.value, 1),
              },
            ]}
          />
          <div className="ev-pagination">
            <span className="np-meta">
              {board.page.total} rows · Page {board.page.page}
            </span>
            <Pagination
              label="Leaderboard pages"
              currentPage={board.page.page}
              totalPages={Math.max(1, Math.ceil(board.page.total / board.page.pageSize))}
              onPageChange={(page) => {
                const url = new URL(window.location.href);
                url.searchParams.set("page", String(page));
                window.location.assign(url.toString());
              }}
            />
          </div>
        </section>
      )}
    </div>
  );
}
