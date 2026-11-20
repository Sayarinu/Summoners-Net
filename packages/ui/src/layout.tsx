import { useId, useState } from "react";
import type { ComponentProps, HTMLAttributes, ReactNode } from "react";

import { cx } from "./internal.js";
import { Breadcrumb } from "./navigation.js";
import type { BreadcrumbItem } from "./navigation.js";

export type TeamSide = "blue" | "red";

export interface PageHeaderProps {
  readonly actions?: ReactNode;
  readonly breadcrumbs?: readonly BreadcrumbItem[];
  readonly children?: ReactNode;
  readonly className?: string;
  /** Short mono facts above the title: league, round, date, format. */
  readonly eyebrow?: ReactNode;
  readonly title: ReactNode;
}

/** The top of every page: where you are, what this is, and the page-level actions. */
export function PageHeader({
  actions,
  breadcrumbs,
  children,
  className,
  eyebrow,
  title,
}: PageHeaderProps) {
  return (
    <header className={cx("np-page-header", className)}>
      {breadcrumbs?.length ? <Breadcrumb items={[...breadcrumbs]} /> : null}
      {eyebrow ? <div className="np-page-header__eyebrow np-overline">{eyebrow}</div> : null}
      <div className="np-page-header__row">
        <h1 className="np-page-header__title">{title}</h1>
        {actions ? <div className="np-page-header__actions">{actions}</div> : null}
      </div>
      {children}
    </header>
  );
}

export interface PanelProps extends Omit<HTMLAttributes<HTMLElement>, "title"> {
  readonly actions?: ReactNode;
  readonly children?: ReactNode;
  readonly headingLevel?: 2 | 3;
  /** `none` lets tables, lists and charts run to the panel's edges. */
  readonly padding?: "default" | "none";
  /** Marks the panel as one team's, with that side's color along the top. */
  readonly side?: TeamSide | undefined;
  readonly title?: ReactNode;
}

/** The surface every section of a page sits on: a titled, bordered block. */
export function Panel({
  actions,
  children,
  className,
  headingLevel = 2,
  padding = "default",
  side,
  title,
  ...props
}: PanelProps) {
  const headingId = useId();
  const Heading = `h${headingLevel}` as const;
  return (
    <section
      aria-labelledby={title && !props["aria-label"] ? headingId : undefined}
      {...props}
      className={cx("np-panel", padding === "none" && "np-panel--flush", className)}
      data-side={side}
    >
      {title || actions ? (
        <div className="np-panel__header">
          {title ? (
            <Heading className="np-panel__title" id={headingId}>
              {title}
            </Heading>
          ) : null}
          {actions ? <div className="np-panel__actions">{actions}</div> : null}
        </div>
      ) : null}
      <div className="np-panel__body">{children}</div>
    </section>
  );
}

export interface DisclosurePanelProps {
  readonly children: ReactNode;
  readonly className?: string;
  readonly defaultOpen?: boolean;
  readonly title: ReactNode;
}

/** A panel whose body opens on demand. The body only renders while open. */
export function DisclosurePanel({
  children,
  className,
  defaultOpen = false,
  title,
}: DisclosurePanelProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <details
      className={cx("np-panel np-panel--disclosure", className)}
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary className="np-panel__header">
        <span className="np-panel__title">{title}</span>
      </summary>
      {open ? <div className="np-panel__body">{children}</div> : null}
    </details>
  );
}

export interface StatProps {
  /** A small note under the label, such as the sample size behind the value. */
  readonly detail?: ReactNode;
  readonly label: ReactNode;
  readonly size?: "lg" | "md" | "sm";
  readonly tone?: "accent" | "danger" | "default" | "success";
  readonly value: ReactNode;
}

/** One labelled figure. Unknown values stay as the caller's dash or note, never zero. */
export function Stat({ detail, label, size = "md", tone = "default", value }: StatProps) {
  return (
    <div className={cx("np-stat-item", `np-stat-item--${size}`)} data-tone={tone}>
      <dt>
        {label}
        {detail ? <small>{detail}</small> : null}
      </dt>
      <dd>{value}</dd>
    </div>
  );
}

export function StatGroup({
  children,
  className,
  label,
}: {
  readonly children: ReactNode;
  readonly className?: string;
  readonly label?: string;
}) {
  return (
    <dl aria-label={label} className={cx("np-stat-group", className)}>
      {children}
    </dl>
  );
}

export interface TabNavItem {
  readonly current?: boolean;
  readonly disabled?: boolean;
  readonly href: string;
  readonly label: ReactNode;
  /** A short mono note under the label, such as a duration. */
  readonly meta?: ReactNode;
}

export interface TabNavProps {
  readonly className?: string;
  readonly items: readonly TabNavItem[];
  readonly label: string;
  /** `underline` switches between pages of one subject; `segmented` switches a view in place. */
  readonly variant?: "segmented" | "underline";
}

/** Links that switch between views. Each view has its own URL, so tabs survive a refresh. */
export function TabNav({ className, items, label, variant = "underline" }: TabNavProps) {
  return (
    <nav aria-label={label} className={cx("np-tabs", `np-tabs--${variant}`, className)}>
      {items.map((item) =>
        item.disabled ? (
          <span aria-disabled="true" className="np-tab" key={item.href}>
            {item.label}
            {item.meta ? <small>{item.meta}</small> : null}
          </span>
        ) : (
          <a
            aria-current={item.current ? "page" : undefined}
            className="np-tab"
            data-keep-scroll=""
            href={item.href}
            key={item.href}
          >
            {item.label}
            {item.meta ? <small>{item.meta}</small> : null}
          </a>
        ),
      )}
    </nav>
  );
}

export interface CardProps {
  readonly children: ReactNode;
  readonly className?: string;
  /** Makes the whole card one link. */
  readonly href?: string;
}

/** A tile in a grid of like things: teams, players, champions. */
export function Card({ children, className, href }: CardProps) {
  return href ? (
    <a className={cx("np-card", "np-card--link", className)} href={href}>
      {children}
    </a>
  ) : (
    <div className={cx("np-card", className)}>{children}</div>
  );
}

/**
 * The card's main link. It covers the whole card, so a card can hold other links, such as a
 * player's team, without nesting them; those sit above it.
 */
export function CardLink({
  children,
  className,
  href,
}: {
  readonly children: ReactNode;
  readonly className?: string;
  readonly href: string;
}) {
  return (
    <a className={cx("np-card__link", className)} href={href}>
      {children}
    </a>
  );
}

/**
 * A row of filter fields over a list. The first field, usually the text filter, takes the spare
 * width; on narrow screens the fields fall into two columns.
 */
export function FilterBar({ className, ...props }: ComponentProps<"form">) {
  return <form {...props} className={cx("np-filter-bar", className)} />;
}
