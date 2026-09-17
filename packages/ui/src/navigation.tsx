import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react";
import type { ReactNode } from "react";
import {
  Button as AriaButton,
  Menu as AriaMenu,
  MenuItem as AriaMenuItem,
  MenuTrigger,
  Popover as AriaPopover,
  Tab as AriaTab,
  TabList as AriaTabList,
  TabPanel as AriaTabPanel,
  Tabs as AriaTabs,
  ToggleButton,
  ToggleButtonGroup,
} from "react-aria-components";

import { analyticsData, cx, Icon } from "./internal.js";
import type { AnalyticsProps } from "./internal.js";
import { IconButton, TextLink } from "./primitives.js";

export interface TabItem {
  readonly meta?: ReactNode;
  readonly content: ReactNode;
  readonly disabled?: boolean;
  readonly icon?: ReactNode;
  readonly id: string;
  readonly label: string;
}

export interface TabsProps extends AnalyticsProps {
  readonly defaultSelectedKey?: string;
  readonly items: readonly TabItem[];
  readonly label: string;
  readonly onSelectionChange?: (key: string) => void;
  readonly orientation?: "horizontal" | "vertical";
  readonly selectedKey?: string;
}

export function Tabs({
  analyticsId,
  defaultSelectedKey,
  items,
  label,
  onSelectionChange,
  orientation = "horizontal",
  selectedKey,
}: TabsProps) {
  const selection =
    selectedKey !== undefined
      ? { selectedKey }
      : defaultSelectedKey !== undefined
        ? { defaultSelectedKey }
        : {};

  return (
    <AriaTabs
      {...selection}
      {...analyticsData(analyticsId)}
      className={cx("np-tabs", `np-tabs--${orientation}`)}
      onSelectionChange={(key) => onSelectionChange?.(String(key))}
      orientation={orientation}
    >
      <AriaTabList aria-label={label} className="np-tabs__list" items={items}>
        {(item) => (
          <AriaTab
            {...(item.disabled !== undefined ? { isDisabled: item.disabled } : {})}
            className="np-tabs__tab"
            id={item.id}
          >
            {item.icon}
            <span>{item.label}</span>
            {item.meta}
          </AriaTab>
        )}
      </AriaTabList>
      {items.map((item) => (
        <AriaTabPanel className="np-tabs__panel" id={item.id} key={item.id}>
          {item.content}
        </AriaTabPanel>
      ))}
    </AriaTabs>
  );
}

export interface SegmentOption {
  readonly icon?: ReactNode;
  readonly label: string;
  readonly value: string;
}

export interface SegmentedControlProps extends AnalyticsProps {
  readonly defaultValue?: string;
  readonly label: string;
  readonly onChange?: (value: string) => void;
  readonly options: readonly SegmentOption[];
  readonly value?: string;
}

export function SegmentedControl({
  analyticsId,
  defaultValue,
  label,
  onChange,
  options,
  value,
}: SegmentedControlProps) {
  const selection =
    value !== undefined
      ? { selectedKeys: new Set([value]) }
      : defaultValue !== undefined
        ? { defaultSelectedKeys: new Set([defaultValue]) }
        : {};

  return (
    <ToggleButtonGroup
      {...selection}
      {...analyticsData(analyticsId)}
      aria-label={label}
      className="np-segmented"
      onSelectionChange={(keys) => {
        const selected = [...keys][0];
        if (selected !== undefined) onChange?.(String(selected));
      }}
      selectionMode="single"
    >
      {options.map((option) => (
        <ToggleButton className="np-segmented__item" id={option.value} key={option.value}>
          {option.icon}
          <span>{option.label}</span>
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
}

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
}

export function Navigation({ currentHref, items, label = "Primary" }: NavigationProps) {
  return (
    <nav aria-label={label} className="np-navigation">
      <ul>
        {items.map((item) => (
          <li key={item.href}>
            <a aria-current={item.href === currentHref ? "page" : undefined} href={item.href}>
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

export interface HeaderProps {
  readonly actions?: ReactNode;
  readonly brand?: ReactNode;
  readonly navigation?: ReactNode;
  readonly status?: ReactNode;
}

export function Header({ actions, brand = "NEXUS PULSE", navigation, status }: HeaderProps) {
  const hasBrand = brand !== null;
  return (
    <header className={cx("np-header", !hasBrand && "np-header--brandless")}>
      <a className="np-skip-link" href="#main-content">
        Skip to main content
      </a>
      {hasBrand ? <div className="np-header__brand">{brand}</div> : null}
      {navigation ? <div className="np-header__navigation">{navigation}</div> : null}
      <div className="np-header__context">{status}</div>
      <div className="np-header__actions">{actions}</div>
    </header>
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

export interface MenuItem {
  readonly description?: string;
  readonly disabled?: boolean;
  readonly icon?: ReactNode;
  readonly id: string;
  readonly label: string;
}

export interface MenuProps extends AnalyticsProps {
  readonly items: readonly MenuItem[];
  readonly label?: string;
  readonly onAction: (id: string) => void;
  readonly trigger?: ReactNode;
}

export function Menu({ analyticsId, items, label = "More actions", onAction, trigger }: MenuProps) {
  return (
    <MenuTrigger>
      <AriaButton
        {...analyticsData(analyticsId)}
        aria-label={label}
        className="np-button np-button--ghost np-icon-button np-control--compact"
      >
        {trigger ?? <Icon icon={MoreHorizontal} size="small" />}
      </AriaButton>
      <AriaPopover className="np-popover np-menu__popover" placement="bottom end">
        <AriaMenu
          aria-label={label}
          className="np-menu"
          items={items}
          onAction={(key) => onAction(String(key))}
        >
          {(item) => (
            <AriaMenuItem
              {...(item.disabled !== undefined ? { isDisabled: item.disabled } : {})}
              className={cx("np-menu__item", item.icon ? "np-menu__item--with-icon" : false)}
              id={item.id}
            >
              {item.icon ? <span className="np-menu__icon">{item.icon}</span> : null}
              <span>
                <strong>{item.label}</strong>
                {item.description ? <small>{item.description}</small> : null}
              </span>
            </AriaMenuItem>
          )}
        </AriaMenu>
      </AriaPopover>
    </MenuTrigger>
  );
}
