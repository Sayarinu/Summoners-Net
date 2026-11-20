"use client";

import type { ReactNode } from "react";

import { ChampionIcon } from "./catalog-icons.js";
import { cx } from "./internal.js";

export interface ChampionIdentityProps {
  readonly className?: string;
  /** A short note under the name, such as a patch or a role share. */
  readonly detail?: ReactNode;
  readonly href?: string | undefined;
  readonly id: string;
  readonly imageUrl: string | null;
  readonly name: string;
  /** `display` is the page-heading size used on a champion's own profile. */
  readonly size?: "compact" | "display" | "large" | "medium";
}

/**
 * A champion portrait with its name, laid out like a team identity. The portrait carries the
 * accessible name, so a linked identity is announced once.
 */
export function ChampionIdentity({
  className: extra,
  detail,
  href,
  id,
  imageUrl,
  name,
  size = "medium",
}: ChampionIdentityProps) {
  const content = (
    <>
      <ChampionIcon
        id={id}
        name={name}
        imageUrl={imageUrl}
        size={size === "compact" ? "small" : size === "medium" ? "medium" : "large"}
      />
      <span className="np-identity__copy">
        <strong aria-hidden="true">{name}</strong>
        {detail ? <small>{detail}</small> : null}
      </span>
    </>
  );
  const className = cx("np-identity", `np-identity--${size}`, extra);
  return href ? (
    <a className={className} href={href}>
      {content}
    </a>
  ) : (
    <div className={className}>{content}</div>
  );
}
