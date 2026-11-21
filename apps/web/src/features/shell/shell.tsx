"use client";
import { Brand, Navigation, NavIcon, SkipLink, type NavIconName } from "@summonersnet/ui";
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
  const entry = (href: string, label: string, icon: NavIconName) => ({
    href,
    label,
    icon: <NavIcon name={icon} />,
  });
  const groups = [
    {
      label: "Esports",
      items: [
        entry("/", "Matches", "matches"),
        entry("/history", "Past Matches", "history"),
        entry("/teams", "Teams", "teams"),
        entry("/players", "Players", "players"),
      ],
    },
    {
      label: "Champions",
      items: [
        entry("/champions", "Champions", "champions"),
        entry("/tier-list", "Tier List", "tierList"),
        entry("/patches", "Patches", "patches"),
        entry("/drafts", "Drafts", "drafts"),
      ],
    },
    {
      label: "Insights",
      items: [
        entry("/leaderboards", "Leaderboards", "leaderboards"),
        entry("/models", "Models", "models"),
      ],
    },
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
        className={`fixed inset-y-0 left-0 z-30 flex w-[240px] flex-col border-r border-line bg-canvas max-[1150px]:w-16 ${
          mobileOpen
            ? "max-[850px]:z-50 max-[850px]:w-[min(300px,calc(100vw-48px))]"
            : "max-[850px]:hidden"
        }`}
        id="app-navigation"
      >
        {/* The brand row shares the top bar's height and bottom border. */}
        <div className="flex h-14 flex-none items-center border-b border-line px-4 max-[1150px]:justify-center max-[1150px]:px-0 max-[850px]:justify-start max-[850px]:px-4">
          <Brand responsive onClick={() => setMobileOpen(false)} />
        </div>
        <div
          className="flex-1 overflow-y-auto px-3 py-5 max-[1150px]:px-2 max-[850px]:px-3"
          onClick={() => setMobileOpen(false)}
        >
          <Navigation
            currentHref={current}
            groups={groups}
            size="large"
            responsive
            onNavigate={(href) => router.push(href)}
          />
        </div>
        <div
          className="border-t border-line px-3 py-3 max-[1150px]:px-2 max-[850px]:px-3"
          onClick={() => setMobileOpen(false)}
        >
          <Navigation
            currentHref={current}
            items={[entry("/settings", "Settings", "settings")]}
            label="Settings Navigation"
            responsive
            onNavigate={(href) => router.push(href)}
          />
        </div>
        {autoDetectTimezone ? <TimezoneDetector initial={preferences} /> : null}
      </aside>
      <header className="sticky top-0 z-30 ml-[240px] flex h-14 items-center gap-3 border-b border-line bg-[color-mix(in_srgb,var(--color-bg-canvas)_94%,transparent)] px-[clamp(var(--space-4),2vw,var(--space-8))] backdrop-blur-[16px] max-[1150px]:ml-16 max-[850px]:ml-0 max-[850px]:px-3">
        <button
          aria-controls="app-navigation"
          aria-expanded={mobileOpen}
          aria-label={mobileOpen ? "Close Navigation" : "Open Navigation"}
          className="hidden size-11 flex-none cursor-pointer place-items-center rounded-md border border-line bg-transparent text-fg max-[850px]:inline-grid"
          onClick={() => setMobileOpen(!mobileOpen)}
          type="button"
        >
          <NavIcon name="menu" />
        </button>
        <span className="hidden max-[850px]:inline-flex">
          <Brand compact />
        </span>
        <GlobalSearch />
      </header>
    </div>
  );
}
