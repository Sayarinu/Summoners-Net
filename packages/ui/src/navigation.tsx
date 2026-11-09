import { ChevronLeft, ChevronRight } from "lucide-react";
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
        label="Previous page"
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
        label="Next page"
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

export interface NavigationProps {
  readonly currentHref: string;
  readonly items: readonly NavigationItem[];
  readonly label?: string;
  readonly onNavigate?: (href: string) => void;
}

export function Navigation({ currentHref, items, label = "Primary", onNavigate }: NavigationProps) {
  return (
    <nav aria-label={label} className="np-navigation">
      <ul>
        {items.map((item) => (
          <li key={item.href}>
            <a
              aria-current={item.href === currentHref ? "page" : undefined}
              href={item.href}
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
              <span>{item.label}</span>
              {item.meta}
            </a>
          </li>
        ))}
      </ul>
    </nav>
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
