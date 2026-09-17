"use client";
import {
  Button,
  Input,
  Select,
  Pagination,
  Table,
  TextLink,
  StatusIndicator,
  TeamIdentity,
} from "@esportsviewer/ui";
import type { BrowseQuery, Game, Page } from "@esportsviewer/data";
import { regions } from "@esportsviewer/data/contracts";
import { dateTime, gameTeams, identityHref } from "./presentation";
export function Filters({
  query,
  history = false,
  search = false,
}: {
  query: BrowseQuery;
  history?: boolean;
  search?: boolean;
}) {
  return (
    <form className="ev-filters" method="get">
      <Input
        type="search"
        label={search ? "Search" : "Filter by name"}
        name="q"
        defaultValue={query.q ?? ""}
        placeholder={search ? "Team, player, match or game ID" : "Team, player or event"}
      />
      {!search && (
        <>
          <Select
            label="League"
            name="league"
            defaultValue={query.league ?? "all"}
            options={[
              { value: "all", label: "All leagues" },
              ...regions.map((r) => ({ value: r, label: r })),
            ]}
          />
          {history ? (
            <Input
              label="Year"
              type="number"
              name="year"
              min={2014}
              max={2100}
              defaultValue={
                typeof query.year === "number" || typeof query.year === "string" ? query.year : ""
              }
              placeholder="All years"
            />
          ) : (
            <>
              <Input label="Date" name="date" type="date" defaultValue={query.date ?? ""} />
              <Select
                label="Status"
                name="state"
                defaultValue={query.state ?? "all"}
                options={[
                  { value: "all", label: "All statuses" },
                  ...["scheduled", "live", "final", "postponed", "cancelled"].map((s) => ({
                    value: s,
                    label: s === "final" ? "Results" : s.charAt(0).toUpperCase() + s.slice(1),
                  })),
                ]}
              />
            </>
          )}
        </>
      )}
      <Button variant="primary" type="submit">
        Apply
      </Button>
    </form>
  );
}
export function Pages({ data }: { data: Page<unknown> }) {
  return (
    <div className="ev-pagination">
      <span className="np-meta">
        {data.total.toLocaleString()} records · Page {data.page}
      </span>
      <Pagination
        currentPage={data.page}
        totalPages={Math.max(1, Math.ceil(data.total / data.pageSize))}
        onPageChange={(page) => {
          const url = new URL(window.location.href);
          url.searchParams.set("page", String(page));
          window.location.assign(url.toString());
        }}
      />
    </div>
  );
}
export function GamesTable({ games, timezone }: { games: Game[]; timezone: string }) {
  return (
    <Table
      caption="Historical games"
      rows={games}
      getRowKey={(g) => g.id}
      emptyMessage="No games match these filters."
      columns={[
        {
          id: "date",
          header: "Played",
          render: (g) => (
            <TextLink href={`/games/${encodeURIComponent(g.id)}`}>
              {dateTime(g.occurredAt, timezone)}
            </TextLink>
          ),
        },
        {
          id: "teams",
          header: "Teams",
          render: (g) => (
            <div className="np-cluster">
              {gameTeams(g).map((t) => (
                <TeamIdentity
                  key={t.id}
                  name={t.name}
                  shortName={t.name}
                  size="compact"
                  href={identityHref(t)}
                  {...(t.imageUrl ? { logo: t.imageUrl } : {})}
                />
              ))}
            </div>
          ),
        },
        { id: "league", header: "League", render: (g) => g.league },
        { id: "game", header: "Game", render: (g) => g.number },
        { id: "patch", header: "Patch", render: (g) => g.patch ?? "—" },
        {
          id: "coverage",
          header: "Statistics",
          render: (g) => (
            <StatusIndicator
              label={g.complete ? "Eligible" : "Partial"}
              tone={g.complete ? "neutral" : "warning"}
            />
          ),
        },
      ]}
    />
  );
}
