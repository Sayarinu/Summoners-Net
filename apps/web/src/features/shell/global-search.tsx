"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { SearchSuggestion } from "../browse/presentation";

const suggestionKind = {
  team: "Team",
  player: "Player",
  match: "Series",
  game: "Game",
  champion: "Champion",
  summoner: "Summoner",
};

export function GlobalSearch() {
  const router = useRouter();
  const path = usePathname();
  const params = useSearchParams();
  const currentQuery = path === "/search" ? (params.get("q") ?? "") : "";
  const input = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(currentQuery);
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<{ query: string; suggestions: SearchSuggestion[] } | null>(
    null,
  );
  const query = value.trim();
  const suggestions = open && result?.query === query ? result.suggestions : [];

  useEffect(() => {
    setValue(currentQuery);
    setOpen(false);
  }, [path, currentQuery]);

  useEffect(() => {
    if (!open || query.length < 2) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      const search = new URLSearchParams({ q: query });
      void fetch(`/api/search/suggestions?${search}`, { signal: controller.signal })
        .then(async (response) => {
          if (!response.ok) return;
          const items = (await response.json()) as SearchSuggestion[];
          if (!controller.signal.aborted) setResult({ query, suggestions: items });
        })
        .catch(() => {
          if (!controller.signal.aborted) setResult({ query, suggestions: [] });
        });
    }, 250);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [open, query]);

  return (
    <form
      action="/search"
      className="relative w-[min(100%,26rem)] min-w-0 max-[850px]:flex-1"
      role="search"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          input.current?.focus();
          setOpen(false);
        } else if (
          event.key === "ArrowDown" &&
          suggestions.length &&
          event.target === input.current
        ) {
          event.preventDefault();
          event.currentTarget.querySelector("a")?.focus();
        }
      }}
      onSubmit={(event) => {
        event.preventDefault();
        setOpen(false);
        router.push(query ? `/search?${new URLSearchParams({ q: query })}` : "/search");
      }}
    >
      <div className="np-input-shell">
        <input
          aria-label="Search App"
          autoComplete="off"
          maxLength={100}
          name="q"
          onChange={(event) => {
            setValue(event.currentTarget.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search..."
          ref={input}
          type="search"
          value={value}
        />
      </div>
      {suggestions.length ? (
        <ul
          className="absolute inset-x-0 top-[calc(100%+var(--space-1))] z-10 list-none rounded-md border border-line-strong bg-raised p-1 max-[850px]:left-auto max-[850px]:w-[max(100%,min(22rem,calc(100vw-2*var(--space-3))))]"
          aria-label="Search Suggestions"
          role="list"
        >
          {suggestions.map(({ name, href, kind }) => (
            <li key={`${kind}:${href}:${name}`}>
              <a
                className="flex items-center justify-between gap-2 rounded-sm px-3 py-2 [overflow-wrap:anywhere] text-fg no-underline hover:bg-interactive focus-visible:bg-interactive"
                href={href}
                onClick={() => setOpen(false)}
              >
                <span>{name}</span>
                <span className="np-meta">{suggestionKind[kind]}</span>
              </a>
            </li>
          ))}
        </ul>
      ) : null}
    </form>
  );
}
