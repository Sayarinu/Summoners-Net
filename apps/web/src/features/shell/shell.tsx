"use client";
import { Footer, Navigation, SkipLink } from "@summonersnet/ui";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PreferencesControl } from "../preferences/controls";
import type { Preferences } from "../preferences/model";
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
  const current = path.startsWith("/matches")
    ? "/"
    : path.startsWith("/games")
      ? "/history"
      : "/" + (path.split("/")[1] ?? "");
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
    { href: "/history", label: "History" },
    { href: "/teams", label: "Teams" },
    { href: "/players", label: "Players" },
    { href: "/search", label: "Search" },
  ];
  return (
    <div className={`ev-shell${mobileOpen ? " ev-shell--mobile-open" : ""}`}>
      <SkipLink />
      {mobileOpen ? (
        <button
          aria-label="Close navigation"
          className="ev-mobile-menu-backdrop"
          onClick={() => setMobileOpen(false)}
          type="button"
        />
      ) : null}
      <aside aria-label="Application navigation" className="ev-sidebar" id="app-navigation">
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
        <div className="ev-sidebar__settings">
          <PreferencesControl
            autoDetectTimezone={autoDetectTimezone}
            initial={preferences}
            showLabel
          />
        </div>
      </aside>
      <header className="ev-mobile-header">
        <button
          aria-controls="app-navigation"
          aria-expanded={mobileOpen}
          aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
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
      <Footer copyright="SummonersNet · Local library" />
    </div>
  );
}
