"use client";
import { Navigation, SkipLink } from "@summonersnet/ui";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { TimezoneDetector } from "../preferences/controls";
import type { Preferences } from "../preferences/model";
import { GlobalSearch } from "./global-search";
/** Pages that live under a navigation entry without sharing its first path segment. */
const sections: Record<string, string> = {
  matches: "/",
  games: "/history",
  matchups: "/champions",
  trending: "/champions",
  summoners: "/leaderboards",
  "solo-games": "/leaderboards",
};
/** The navigation entry a path belongs to, so it can be marked as the current page. */
export function sectionOf(path: string) {
  const first = path.split("/")[1] ?? "";
  return sections[first] ?? `/${first}`;
}

export function ShellHeader({
  autoDetectTimezone = false,
  preferences,
}: {
  autoDetectTimezone?: boolean;
  preferences: Preferences;
}) {
  const path = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const current = sectionOf(path);
  useEffect(() => {
    if (!mobileOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [mobileOpen]);
  const navigation = [
    { href: "/", label: "Matches" },
    { href: "/history", label: "Past Matches" },
    { href: "/teams", label: "Teams" },
    { href: "/players", label: "Players" },
    { href: "/champions", label: "Champions" },
    { href: "/tier-list", label: "Tier List" },
    { href: "/leaderboards", label: "Leaderboards" },
    { href: "/patches", label: "Patches" },
    { href: "/drafts", label: "Drafts" },
    { href: "/models", label: "Models" },
  ];
  return (
    <div className="contents">
      <SkipLink />
      {mobileOpen ? (
        <button
          aria-label="Close Navigation"
          className="fixed inset-0 z-40 cursor-default border-0 bg-overlay p-0 min-[851px]:hidden"
          onClick={() => setMobileOpen(false)}
          type="button"
        />
      ) : null}
      <aside
        aria-label="Application Navigation"
        className={`fixed inset-y-0 left-0 z-30 flex w-[240px] flex-col border-r border-line bg-canvas px-4 py-6 ${
          mobileOpen
            ? "max-[850px]:z-50 max-[850px]:w-[min(320px,calc(100vw-48px))]"
            : "max-[850px]:hidden"
        }`}
        id="app-navigation"
      >
        <a
          className="flex min-h-11 items-center px-3 font-mono text-sm font-semibold tracking-[0.04em] whitespace-nowrap text-fg no-underline"
          href="/"
          onClick={() => setMobileOpen(false)}
        >
          Summoners Net
        </a>
        <div className="mt-8" onClick={() => setMobileOpen(false)}>
          <Navigation
            currentHref={current}
            items={navigation}
            size="large"
            onNavigate={(href) => router.push(href)}
          />
        </div>
        <div className="mt-auto border-t border-line pt-4" onClick={() => setMobileOpen(false)}>
          <Navigation
            currentHref={current}
            items={[{ href: "/settings", label: "Settings" }]}
            label="Settings Navigation"
            onNavigate={(href) => router.push(href)}
          />
        </div>
        {autoDetectTimezone ? <TimezoneDetector initial={preferences} /> : null}
      </aside>
      <header className="sticky top-0 z-30 ml-[240px] flex min-h-14 items-center gap-2 border-b border-line bg-[color-mix(in_srgb,var(--color-bg-canvas)_94%,transparent)] px-[clamp(var(--space-4),2vw,var(--space-8))] py-2 backdrop-blur-[16px] max-[850px]:ml-0 max-[850px]:px-3">
        <button
          aria-controls="app-navigation"
          aria-expanded={mobileOpen}
          aria-label={mobileOpen ? "Close Navigation" : "Open Navigation"}
          className="hidden size-11 flex-none cursor-pointer place-items-center rounded-md border border-line bg-transparent text-lg text-fg max-[850px]:inline-grid"
          onClick={() => setMobileOpen(!mobileOpen)}
          type="button"
        >
          <span aria-hidden="true">☰</span>
        </button>
        <a
          className="hidden font-mono text-sm font-semibold whitespace-nowrap text-fg no-underline max-[850px]:inline-block"
          href="/"
        >
          Summoners Net
        </a>
        <GlobalSearch />
      </header>
    </div>
  );
}
