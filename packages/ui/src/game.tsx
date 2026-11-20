import type { ReactNode } from "react";

import { cx } from "./internal.js";
import type { TeamSide } from "./layout.js";

export interface SideNameProps {
  readonly children: ReactNode;
  readonly className?: string | undefined;
  /** The side the team played, underlined in that side's color. Omit while it is unknown. */
  readonly side?: TeamSide | null | undefined;
}

/** A team's name marked with the side it played on. */
export function SideName({ children, className, side }: SideNameProps) {
  return (
    <span
      className={cx("np-side-name", className)}
      data-side={side ?? undefined}
      title={side ? `${side} side` : undefined}
    >
      {children}
    </span>
  );
}

export interface TeamSideHeaderProps {
  /** The team's identity, usually a `TeamIdentity`. */
  readonly children: ReactNode;
  readonly className?: string | undefined;
  /** Replaces the default "Blue Side" or "Red Side" label. */
  readonly label?: ReactNode;
  readonly side: TeamSide;
}

/** The top of one team's half of a game: which side it played, then who it is. */
export function TeamSideHeader({ children, className, label, side }: TeamSideHeaderProps) {
  return (
    <header className={cx("np-team-side-header", className)} data-side={side}>
      <span className="np-team-side-header__side">
        {label ?? (side === "blue" ? "Blue Side" : "Red Side")}
      </span>
      {children}
    </header>
  );
}

export interface SidePairProps {
  /** One block per side, each marked with `data-side`, such as a `Panel` with `side`. */
  readonly children: ReactNode;
  readonly className?: string | undefined;
  /** Names the pair as a region. */
  readonly label?: string;
  /**
   * Once both sides sit next to each other, the red side's `TeamSideHeader` mirrors the blue
   * side's so the two teams face each other. On by default.
   */
  readonly mirrored?: boolean;
}

/** The blue and red halves of a game side by side, stacking when there is no room for both. */
export function SidePair({ children, className, label, mirrored = true }: SidePairProps) {
  const props = {
    className: cx("np-side-pair", className),
    "data-mirrored": mirrored || undefined,
  };
  return label ? (
    <section aria-label={label} {...props}>
      {children}
    </section>
  ) : (
    <div {...props}>{children}</div>
  );
}

export interface ShareBarProps {
  readonly className?: string | undefined;
  /** Which end the bar grows from. `end` suits a left-hand side that reads toward the middle. */
  readonly from?: "end" | "start";
  /** The side whose color fills the bar. Omit for the accent color. */
  readonly side?: TeamSide | undefined;
  /** The filled share, from 0 to 1. Values outside that range are clamped. */
  readonly value: number;
}

/**
 * A horizontal bar showing one share of a whole. It is decorative: always show the value as text
 * beside it.
 */
export function ShareBar({ className, from = "start", side, value }: ShareBarProps) {
  const share = Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
  return (
    <span
      aria-hidden="true"
      className={cx("np-share-bar", className)}
      data-from={from}
      data-side={side}
    >
      <span style={{ inlineSize: `${share * 100}%` }} />
    </span>
  );
}
