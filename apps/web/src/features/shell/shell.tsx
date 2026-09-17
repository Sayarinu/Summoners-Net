"use client";
import { Header, Navigation, Footer, TextLink } from "@esportsviewer/ui";
import { usePathname } from "next/navigation";
import { PreferencesControl } from "../preferences/controls";
import type { Preferences } from "../preferences/model";
export function ShellHeader({ preferences }: { preferences: Preferences }) {
  const path = usePathname();
  const current = path.startsWith("/matches")
    ? "/"
    : path.startsWith("/games")
      ? "/history"
      : "/" + (path.split("/")[1] ?? "");
  return (
    <div className="ev-header">
      <Header
        brand={
          <a className="ev-brand" href="/">
            <span aria-hidden="true">EV</span> EsportsViewer
          </a>
        }
        navigation={
          <Navigation
            currentHref={current}
            items={[
              { href: "/", label: "Matches" },
              { href: "/history", label: "History" },
              { href: "/teams", label: "Teams" },
              { href: "/players", label: "Players" },
              { href: "/search", label: "Search" },
              { href: "/sources", label: "Sources" },
            ]}
          />
        }
        actions={<PreferencesControl initial={preferences} />}
      />
    </div>
  );
}
export function ShellFooter() {
  return (
    <Footer
      copyright="EsportsViewer · Local library"
      status={
        <TextLink href="/sources" variant="muted">
          Sources & coverage
        </TextLink>
      }
    />
  );
}
