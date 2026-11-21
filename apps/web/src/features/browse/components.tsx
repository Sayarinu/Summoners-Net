"use client";
import { useEffect, useRef, useState, useTransition, type FormEvent, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  FilterBar,
  Input,
  Select,
  Pagination,
  Table,
  TextLink,
  StatusIndicator,
  TeamIdentity,
  TeamVersus,
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
  teams = false,
  seasons,
  selectedYear,
  search = false,
  view,
  className,
  splits,
}: {
  query: BrowseQuery;
  history?: boolean;
  teams?: boolean;
  seasons?: number[];
  selectedYear?: string;
  search?: boolean;
  /** The past matches view; the games view is kept when the filters are submitted. */
  view?: "series" | "games";
  className?: string;
  /** Pro splits to filter by, with the regular season or playoffs; omit to hide both. */
  splits?: string[];
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const timeoutRef = useRef<number | undefined>(undefined);
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
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

  /** Applies the filters in place, so the field keeps focus and anything typed meanwhile. */
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const params = new URLSearchParams();
    for (const [name, value] of new FormData(event.currentTarget)) {
      if (typeof value === "string") params.append(name, value);
    }
    const search = params.toString();
    startTransition(() => {
      router.replace(`${pathname}${search ? `?${search}` : ""}`, { scroll: false });
    });
  }

  return (
    <FilterBar
      ref={formRef}
      className={className}
      method="get"
      onSubmit={submit}
      aria-busy={pending || undefined}
    >
      {view === "games" ? <input type="hidden" name="view" value="games" /> : null}
      <Input
        type="search"
        label={
          teams
            ? "Search Teams"
            : search
              ? "Search"
              : history && view !== "series"
                ? "Filter Games"
                : "Filter Matches"
        }
        name="q"
        defaultValue={query.q ?? ""}
        onChange={scheduleSubmit}
        placeholder={teams ? "Team name or alias" : search ? "Search..." : "Filter..."}
      />
      {!search && (
        <>
          <Select
            label="League"
            name="league"
            defaultValue={query.league ?? "all"}
            onValueChange={scheduleSubmit}
            options={[
              { value: "all", label: "All Leagues" },
              ...regions.map((r) => ({ value: r, label: r })),
            ]}
          />
          {seasons ? (
            <Select
              label="Season"
              name="year"
              defaultValue={selectedYear ?? "all"}
              onValueChange={scheduleSubmit}
              options={[
                ...seasons.map((year) => ({ label: String(year), value: String(year) })),
                { label: "All Years", value: "all" },
              ]}
            />
          ) : teams ? null : history ? (
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
                  { value: "all", label: "All Statuses" },
                  ...["scheduled", "live", "final", "postponed", "cancelled"].map((s) => ({
                    value: s,
                    label: s === "final" ? "Results" : s.charAt(0).toUpperCase() + s.slice(1),
                  })),
                ]}
              />
            </>
          )}
          {splits ? (
            <>
              <Select
                label="Split"
                name="split"
                defaultValue={query.split ?? "all"}
                onValueChange={scheduleSubmit}
                options={[
                  { label: "All Splits", value: "all" },
                  ...[...new Set([...splits, ...(query.split ? [query.split] : [])])].map(
                    (split) => ({ label: split, value: split }),
                  ),
                ]}
              />
              <Select
                label="Stage"
                name="stage"
                defaultValue={query.stage ?? "all"}
                onValueChange={scheduleSubmit}
                options={[
                  { label: "All Stages", value: "all" },
                  { label: "Regular Season", value: "regular" },
                  { label: "Playoffs", value: "playoffs" },
                ]}
              />
            </>
          ) : null}
        </>
      )}
    </FilterBar>
  );
}
export function Pages({ data, afterCount }: { data: Page<unknown>; afterCount?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-x-4 gap-y-2 py-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="np-meta text-accent">
          {data.total.toLocaleString()} {data.total === 1 ? "record" : "records"} · Page {data.page}
        </span>
        {afterCount}
      </div>
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
export function GamesTable({
  games,
  timezone,
  hideSpoilers,
  pastMatches = false,
}: {
  games: Game[];
  timezone: string;
  hideSpoilers: boolean;
  pastMatches?: boolean;
}) {
  return (
    <Table
      caption="Historical Games"
      rows={games}
      getRowKey={(g) => g.id}
      emptyMessage="No games match these filters."
      columns={[
        {
          id: "date",
          header: "Played",
          render: (g) => (
            <TextLink href={`/games/${encodeURIComponent(g.id)}`}>
              {dateTime(g.occurredAt, timezone, pastMatches)}
            </TextLink>
          ),
        },
        {
          id: "teams",
          header: "Teams",
          render: (g) => {
            const [first, second] = gameTeams(g).map((team) => ({
              name: team.name,
              side: team.side,
              shortName: team.name,
              size: "compact" as const,
              href: identityHref(team),
              winner: !hideSpoilers && team.won === true,
              ...(team.imageUrl ? { logo: team.imageUrl } : {}),
            }));
            return first && second ? (
              <TeamVersus teams={[first, second]} />
            ) : first ? (
              <TeamIdentity {...first} />
            ) : null;
          },
        },
        { id: "league", header: "League", render: (g) => g.league },
        { id: "game", header: "Game", render: (g) => g.number },
        { id: "patch", header: "Patch", render: (g) => g.patch ?? "—" },
        ...(pastMatches
          ? []
          : [
              {
                id: "coverage",
                header: "Statistics",
                render: (g: Game) => (
                  <StatusIndicator
                    label={g.complete ? "Eligible" : "Partial"}
                    tone={g.complete ? "neutral" : "warning"}
                  />
                ),
              },
            ]),
      ]}
    />
  );
}
