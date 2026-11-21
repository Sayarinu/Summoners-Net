import {
  Activity,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  History,
  LayoutList,
  Menu,
  Search,
  ScrollText,
  Settings,
  Shield,
  Sparkles,
  Swords,
  Trophy,
  User,
  Columns3,
} from "lucide-react";
import type { MouseEvent, ReactNode } from "react";
import { Button as AriaButton } from "react-aria-components";

import { analyticsData, Icon } from "./internal.js";
import type { AnalyticsProps } from "./internal.js";
import { IconButton, TextLink } from "./primitives.js";

export interface BreadcrumbItem {
  readonly href?: string;
  readonly label: string;
}

export function Breadcrumb({
  items,
  label = "Breadcrumb",
}: {
  readonly items: readonly BreadcrumbItem[];
  readonly label?: string;
}) {
  return (
    <nav aria-label={label} className="np-breadcrumb">
      <ol>
        {items.map((item, index) => {
          const current = index === items.length - 1;
          return (
            <li key={`${item.label}-${index}`}>
              {current ? (
                <span aria-current="page">{item.label}</span>
              ) : item.href ? (
                <TextLink href={item.href} variant="muted">
                  {item.label}
                </TextLink>
              ) : (
                <span>{item.label}</span>
              )}
              {!current ? <ChevronRight aria-hidden="true" /> : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

type PageToken = "ellipsis" | number;

export function getPaginationRange(current: number, total: number): PageToken[] {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1);
  if (current <= 4) return [1, 2, 3, 4, 5, "ellipsis", total];
  if (current >= total - 3)
    return [1, "ellipsis", total - 4, total - 3, total - 2, total - 1, total];
  return [1, "ellipsis", current - 1, current, current + 1, "ellipsis", total];
}

export interface PaginationProps extends AnalyticsProps {
  readonly currentPage: number;
  readonly label?: string;
  readonly onPageChange: (page: number) => void;
  readonly totalPages: number;
}

export function Pagination({
  analyticsId,
  currentPage,
  label = "Pagination",
  onPageChange,
  totalPages,
}: PaginationProps) {
  return (
    <nav {...analyticsData(analyticsId)} aria-label={label} className="np-pagination">
      <IconButton
        disabled={currentPage <= 1}
        icon={<Icon icon={ChevronLeft} size="small" />}
        label="Previous Page"
        onPress={() => onPageChange(currentPage - 1)}
        size="compact"
        variant="ghost"
      />
      <div className="np-pagination__pages">
        {getPaginationRange(currentPage, totalPages).map((token, index) =>
          token === "ellipsis" ? (
            <span aria-hidden="true" className="np-pagination__ellipsis" key={`ellipsis-${index}`}>
              …
            </span>
          ) : (
            <AriaButton
              {...(token === currentPage ? { "aria-current": "page" as const } : {})}
              aria-label={`Page ${token}`}
              className="np-pagination__page"
              key={token}
              onPress={() => onPageChange(token)}
            >
              {token}
            </AriaButton>
          ),
        )}
      </div>
      <IconButton
        disabled={currentPage >= totalPages}
        icon={<Icon icon={ChevronRight} size="small" />}
        label="Next Page"
        onPress={() => onPageChange(currentPage + 1)}
        size="compact"
        variant="ghost"
      />
    </nav>
  );
}

export interface NavigationItem {
  readonly meta?: ReactNode;
  readonly href: string;
  readonly icon?: ReactNode;
  readonly label: string;
}

/** A titled set of entries, such as "Esports" or "Champions". */
export interface NavigationGroup {
  readonly label: string;
  readonly items: readonly NavigationItem[];
}

export interface NavigationProps {
  readonly currentHref: string;
  /** A flat list of entries; ignored when `groups` is given. */
  readonly items?: readonly NavigationItem[];
  /** Entries under group headings. */
  readonly groups?: readonly NavigationGroup[];
  readonly label?: string;
  readonly onNavigate?: (href: string) => void;
  /** `large` gives touch-sized entries for an application sidebar. */
  readonly size?: "large" | "medium";
  /** Shows icons only, as a narrow rail; each label stays the entry's accessible name and tooltip. */
  readonly collapsed?: boolean;
  /** Collapses to a rail on medium screens (851–1150px) only, without JavaScript. */
  readonly responsive?: boolean;
}

export function Navigation({
  currentHref,
  items = [],
  groups,
  label = "Primary",
  onNavigate,
  size = "medium",
  collapsed = false,
  responsive = false,
}: NavigationProps) {
  const entry = (item: NavigationItem) => (
    <li key={item.href}>
      <a
        aria-current={item.href === currentHref ? "page" : undefined}
        href={item.href}
        title={collapsed || responsive ? item.label : undefined}
        onClick={(event: MouseEvent<HTMLAnchorElement>) => {
          if (
            !onNavigate ||
            event.defaultPrevented ||
            event.button !== 0 ||
            event.metaKey ||
            event.ctrlKey ||
            event.shiftKey ||
            event.altKey
          )
            return;
          event.preventDefault();
          onNavigate(item.href);
        }}
      >
        {item.icon}
        <span className={collapsed ? "np-visually-hidden" : "np-navigation__label"}>
          {item.label}
        </span>
        {collapsed ? null : item.meta}
      </a>
    </li>
  );
  return (
    <nav
      aria-label={label}
      className={[
        "np-navigation",
        size === "large" && "np-navigation--large",
        collapsed && "np-navigation--collapsed",
        responsive && "np-navigation--responsive",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {groups ? (
        groups.map((group) => (
          <div className="np-navigation__group" key={group.label}>
            <p className={collapsed ? "np-visually-hidden" : "np-navigation__heading"}>
              {group.label}
            </p>
            <ul aria-label={group.label}>{group.items.map(entry)}</ul>
          </div>
        ))
      ) : (
        <ul>{items.map(entry)}</ul>
      )}
    </nav>
  );
}

const navGlyphs = {
  matches: Swords,
  history: History,
  teams: Shield,
  players: User,
  champions: Sparkles,
  tierList: LayoutList,
  patches: ScrollText,
  drafts: Columns3,
  leaderboards: Trophy,
  models: Activity,
  schedule: CalendarClock,
  settings: Settings,
  search: Search,
  menu: Menu,
} as const;
export type NavIconName = keyof typeof navGlyphs;

/** An application navigation icon, decorative unless given a label. */
export function NavIcon({ name, label }: { readonly name: NavIconName; readonly label?: string }) {
  return <Icon icon={navGlyphs[name]} {...(label ? { label } : {})} />;
}

/** Summoners Net's mark: two nested facets around a gold core. */
export function BrandMark({ size = 28 }: { readonly size?: number }) {
  return (
    <svg
      aria-hidden="true"
      className="np-brand__mark"
      height={size}
      viewBox="0 0 32 32"
      width={size}
    >
      <path d="M16 2 30 16 16 30 2 16Z" fill="none" stroke="currentColor" strokeWidth="2" />
      <path
        d="M16 8 24 16 16 24 8 16Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        opacity="0.55"
      />
      <path d="M16 12.5 19.5 16 16 19.5 12.5 16Z" fill="var(--color-text-accent)" />
    </svg>
  );
}

/** The mark and wordmark, linking home. `compact` keeps the mark only. */
export function Brand({
  href = "/",
  compact = false,
  responsive = false,
  onClick,
}: {
  readonly href?: string;
  readonly compact?: boolean;
  /** Keeps the mark only on medium screens (851–1150px), beside a navigation rail. */
  readonly responsive?: boolean;
  readonly onClick?: () => void;
}) {
  return (
    <a
      aria-label={compact ? "Summoners Net home" : undefined}
      className={responsive ? "np-brand np-brand--responsive" : "np-brand"}
      href={href}
      onClick={onClick}
    >
      <BrandMark />
      {compact ? null : (
        <span className="np-brand__name">
          Summoners <span className="np-brand__accent">Net</span>
        </span>
      )}
    </a>
  );
}

export interface FooterProps {
  readonly copyright?: string;
  readonly links?: readonly BreadcrumbItem[];
  readonly status?: ReactNode;
}

export function Footer({
  copyright = "© Nouvelle Lune Atelier. All rights reserved.",
  links = [],
  status,
}: FooterProps) {
  return (
    <footer className="np-footer">
      <span>{copyright}</span>
      {links.length > 0 ? (
        <nav aria-label="Footer">
          {links.map((link) => (
            <TextLink href={link.href ?? "#"} key={link.label} variant="muted">
              {link.label}
            </TextLink>
          ))}
        </nav>
      ) : null}
      {status}
    </footer>
  );
}
