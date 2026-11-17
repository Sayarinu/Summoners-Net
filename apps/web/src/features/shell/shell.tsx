"use client";
import { Footer, Navigation, SkipLink } from "@summonersnet/ui";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { TimezoneDetector } from "../preferences/controls";
import type { Preferences } from "../preferences/model";
/** Pages that live under a navigation entry without sharing its first path segment. */
const sections: Record<string, string> = {
  matches: "/",
  games: "/history",
  matchups: "/champions",
  trending: "/patches",
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
    { href: "/search", label: "Search" },
  ];
  return (
    <div className={`ev-shell${mobileOpen ? " ev-shell--mobile-open" : ""}`}>
      <SkipLink />
      {mobileOpen ? (
        <button
          aria-label="Close Navigation"
          className="ev-mobile-menu-backdrop"
          onClick={() => setMobileOpen(false)}
          type="button"
        />
      ) : null}
      <aside aria-label="Application Navigation" className="ev-sidebar" id="app-navigation">
        <a className="ev-brand" href="/" onClick={() => setMobileOpen(false)}>
          SummonersNet
        </a>
        <div className="ev-sidebar__nav" onClick={() => setMobileOpen(false)}>
          <Navigation
            currentHref={current}
            items={navigation}
            onNavigate={(href) => router.push(href)}
          />
        </div>
        <div className="ev-sidebar__settings" onClick={() => setMobileOpen(false)}>
          <Navigation
            currentHref={current}
            items={[{ href: "/settings", label: "Settings" }]}
            label="Settings Navigation"
            onNavigate={(href) => router.push(href)}
          />
        </div>
        {autoDetectTimezone ? <TimezoneDetector initial={preferences} /> : null}
      </aside>
      <header className="ev-mobile-header">
        <button
          aria-controls="app-navigation"
          aria-expanded={mobileOpen}
          aria-label={mobileOpen ? "Close Navigation" : "Open Navigation"}
          className="ev-mobile-menu-button"
          onClick={() => setMobileOpen(!mobileOpen)}
          type="button"
        >
          <span aria-hidden="true">☰</span>
        </button>
        <a className="ev-mobile-brand" href="/">
          SummonersNet
        </a>
      </header>
    </div>
  );
}
export function ShellFooter() {
  return (
    <div className="ev-shell-footer">
      <Footer copyright="SummonersNet" />
    </div>
  );
}
