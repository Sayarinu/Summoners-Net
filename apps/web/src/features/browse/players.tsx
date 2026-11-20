"use client";
import "./directory.css";
import { useEffect, useRef, useTransition, type FormEvent } from "react";
import { usePathname, useRouter } from "next/navigation";
import { EmptyState, Input, PlayerIdentity, Select, TeamIdentity } from "@summonersnet/ui";
import type { BrowseQuery, Page, PlayerDirectoryEntry } from "@summonersnet/data";
import { regions } from "@summonersnet/data/contracts";
import { Pages } from "./components";
import { FillingGrid } from "./page-fill";
import { identityHref } from "./presentation";

function PlayerFilters({ query, pageSize }: { query: BrowseQuery; pageSize: number }) {
  const form = useRef<HTMLFormElement>(null);
  const timeout = useRef<number | undefined>(undefined);
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  function schedule() {
    window.clearTimeout(timeout.current);
    timeout.current = window.setTimeout(() => form.current?.requestSubmit(), 350);
  }
  useEffect(() => {
    // Typing before hydration fires no change handler, so submit text the server did not render.
    const field = form.current?.elements.namedItem("q");
    if (field instanceof HTMLInputElement && field.value !== field.defaultValue) schedule();
    return () => window.clearTimeout(timeout.current);
  }, []);
  /** Applies the filters in place, so the field keeps focus and anything typed meanwhile. */
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const params = new URLSearchParams();
    for (const [name, value] of new FormData(event.currentTarget)) {
      if (typeof value === "string") params.append(name, value);
    }
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    });
  }
  return (
    <form
      ref={form}
      className="ev-filters"
      method="get"
      onSubmit={submit}
      aria-busy={pending || undefined}
    >
      <input type="hidden" name="pageSize" value={pageSize} />
      <Input
        type="search"
        label="Search Players"
        name="q"
        defaultValue={query.q ?? ""}
        onChange={schedule}
        placeholder="Player name or alias"
      />
      <Select
        label="League"
        name="league"
        defaultValue={query.league ?? "all"}
        onValueChange={schedule}
        options={[
          { value: "all", label: "All Leagues" },
          ...regions.map((r) => ({ value: r, label: r })),
        ]}
      />
    </form>
  );
}

export function PlayerFinder({
  data,
  query,
}: {
  data: Page<PlayerDirectoryEntry>;
  query: BrowseQuery;
}) {
  return (
    <div className="np-stack">
      <header className="ev-title">
        <div>
          <h1>Players</h1>
        </div>
      </header>
      <div className="ev-browse-toolbar">
        <PlayerFilters query={query} pageSize={data.pageSize} />
      </div>
      {data.items.length ? (
        <FillingGrid
          className="ev-directory-grid"
          label="Players"
          page={data.page}
          pageSize={data.pageSize}
          total={data.total}
        >
          {data.items.map((p) => (
            <li key={p.id} className="ev-player-card">
              <PlayerIdentity
                handle={p.name}
                href={identityHref(p)}
                role={p.role}
                {...(p.imageUrl ? { portrait: p.imageUrl } : {})}
              />
              <div className="ev-player-card__team">
                {p.team ? (
                  <TeamIdentity
                    name={p.team.name}
                    shortName={p.team.name}
                    href={identityHref(p.team)}
                    size="compact"
                    {...(p.team.imageUrl ? { logo: p.team.imageUrl } : {})}
                  />
                ) : (
                  <span>No current team</span>
                )}
              </div>
            </li>
          ))}
        </FillingGrid>
      ) : (
        <EmptyState title="No Players Found" />
      )}
      <Pages data={data} />
    </div>
  );
}
