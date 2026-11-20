"use client";
import { ChampionPortrait, type ChampionPortraits } from "../browse/visuals";
import { ExportLink } from "../shell/export-link";
import {
  RoleIcon,
  Button,
  EmptyState,
  FilterBar,
  PageHeader,
  Pagination,
  Panel,
  Select,
  StatusIndicator,
  Table,
  TextLink,
} from "@summonersnet/ui";
import type { WpaLeaderboard, WpaLeaderboardRow } from "@summonersnet/data/contracts";

const kindLabels = { champion: "Champions", player: "Players", role: "Roles" } as const;
const sortLabels = { perGame: "Per Game", total: "Total", games: "Games" } as const;
const points = (value: number | null, digits = 2) =>
  value === null ? "Unknown" : `${value >= 0 ? "+" : ""}${value.toFixed(digits)} pts`;
function Subject({
  row,
  portraits,
}: {
  row: WpaLeaderboardRow;
  portraits?: ChampionPortraits | undefined;
}) {
  if (row.kind === "champion")
    return (
      <ChampionPortrait
        name={row.name ?? `Champion ${row.subject}`}
        portraits={portraits}
        championId={row.championId}
      />
    );
  if (row.kind === "player")
    return (
      <TextLink href={`/summoners/${encodeURIComponent(row.subject)}`}>
        {row.name ?? "Unresolved player"}
      </TextLink>
    );
  return <RoleIcon role={row.subject} />;
}
export function WpaLeaderboardPage({
  board,
  portraits,
  error,
}: {
  board: WpaLeaderboard | null;
  portraits?: ChampionPortraits;
  error: string | null;
}) {
  const q = board?.query;
  return (
    <div className="flex min-w-0 flex-col gap-6">
      <PageHeader
        breadcrumbs={[
          { label: "Leaderboards", href: "/leaderboards" },
          { label: "Win Probability Added" },
        ]}
        eyebrow={
          board?.model && board.patch ? (
            <span>
              Patch {board.patch} · model v{board.model.modelVersion} (#{board.model.id}
              {board.model.brier === null ? "" : `, Brier ${board.model.brier.toFixed(3)}`})
            </span>
          ) : undefined
        }
        title="Win Probability Added"
      />
      <FilterBar
        action="/leaderboards/wpa"
        method="get"
        className="border-y border-line py-3"
        key={JSON.stringify(q)}
      >
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
          label="Sort By"
          name="sort"
          defaultValue={q?.sort ?? "perGame"}
          options={Object.entries(sortLabels).map(([value, label]) => ({ label, value }))}
        />
        <Button type="submit">Apply Filters</Button>
      </FilterBar>
      {error ? (
        <p role="alert">{error}</p>
      ) : !board?.model ? (
        <EmptyState
          title="No Win Probability Model Yet"
          description="Leaderboards appear once a model is published from enough stored games."
        />
      ) : !board.patch ? (
        <EmptyState
          title="No Scored Games Yet"
          description="Games are scored with the active model as they are ingested."
        />
      ) : (
        <Panel
          aria-label="Win Probability Added Leaderboard"
          title={`${kindLabels[board.query.kind]} by Win Probability Added`}
          padding="none"
          actions={
            <ExportLink
              table="wpa"
              filters={{ kind: board.query.kind, patch: board.patch, sort: board.query.sort }}
            />
          }
        >
          <p className="border-b border-line px-4 py-3 text-sm text-fg-secondary">
            Values are percentage points of win probability; rows with fewer than 10 games show no
            value.
          </p>
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
                render: (r) => <Subject row={r} portraits={portraits} />,
              },
              { id: "games", header: "Games", align: "end", render: (r) => r.games },
              {
                id: "perGame",
                header: "Per Game",
                align: "end",
                render: (r) =>
                  r.perGame.value === null ? (
                    <StatusIndicator label="Too Few Games" tone="warning" />
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
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-line px-4 py-4">
            <span className="np-meta text-accent">
              {board.page.total} rows · Page {board.page.page}
            </span>
            <Pagination
              label="Leaderboard Pages"
              currentPage={board.page.page}
              totalPages={Math.max(1, Math.ceil(board.page.total / board.page.pageSize))}
              onPageChange={(page) => {
                const url = new URL(window.location.href);
                url.searchParams.set("page", String(page));
                window.location.assign(url.toString());
              }}
            />
          </div>
        </Panel>
      )}
    </div>
  );
}
