"use client";
import { useEffect, useRef, useState } from "react";
import {
  Input,
  Select,
  Pagination,
  Table,
  TextLink,
  StatusIndicator,
  TeamIdentity,
} from "@summonersnet/ui";
import type { BrowseQuery, Game, Page } from "@summonersnet/data";
import { regions } from "@summonersnet/data/contracts";
import { dateTime, gameTeams, identityHref } from "./presentation";

function todayInputValue(timezone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const part = (type: "year" | "month" | "day") =>
    parts.find((entry) => entry.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function Filters({
  query,
  history = false,
  search = false,
}: {
  query: BrowseQuery;
  history?: boolean;
  search?: boolean;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const timeoutRef = useRef<number | undefined>(undefined);
  const defaultDate = todayInputValue(query.timezone ?? "UTC");
  const [dateValue, setDateValue] = useState(query.date ?? defaultDate);
  const [dateIsFilter, setDateIsFilter] = useState(Boolean(query.date));

  useEffect(() => {
    // Typing before hydration fires no change handler, so submit text the server did not render.
    const form = formRef.current;
    const typed = ["q", "year"].some((name) => {
      const field = form?.elements.namedItem(name);
      return field instanceof HTMLInputElement && field.value !== field.defaultValue;
    });
    if (typed) scheduleSubmit();
    return () => {
      if (timeoutRef.current !== undefined) window.clearTimeout(timeoutRef.current);
    };
  }, []);

  useEffect(() => {
    setDateValue(query.date ?? defaultDate);
    setDateIsFilter(Boolean(query.date));
  }, [defaultDate, query.date]);

  function scheduleSubmit() {
    if (timeoutRef.current !== undefined) window.clearTimeout(timeoutRef.current);
    timeoutRef.current = window.setTimeout(() => {
      formRef.current?.requestSubmit();
      timeoutRef.current = undefined;
    }, 350);
  }

  return (
    <form ref={formRef} className="ev-filters" method="get">
      <Input
        type="search"
        label={search ? "Search" : history ? "Filter Games" : "Filter Matches"}
        name="q"
        defaultValue={query.q ?? ""}
        onChange={scheduleSubmit}
        placeholder={search ? "Search..." : "Filter..."}
      />
      {!search && (
        <>
          <Select
            label="League"
            name="league"
            defaultValue={query.league ?? "all"}
            onValueChange={scheduleSubmit}
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
              onChange={scheduleSubmit}
              placeholder="All years"
            />
          ) : (
            <>
              <Input
                label="Date"
                name={dateIsFilter ? "date" : undefined}
                type="date"
                value={dateValue}
                onChange={(event) => {
                  setDateValue(event.currentTarget.value);
                  setDateIsFilter(true);
                  scheduleSubmit();
                }}
              />
              <Select
                label="Status"
                name="state"
                defaultValue={query.state ?? "all"}
                onValueChange={scheduleSubmit}
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
