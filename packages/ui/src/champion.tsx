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

const abilityKeys = ["Q", "W", "E", "R"] as const;
export interface SkillOrderGridProps {
  /** A caption naming the order, read by screen readers. */
  readonly caption: string;
  readonly className?: string;
  /** The ability ranked at each level, from level 1: 1 Q, 2 W, 3 E, 4 R. */
  readonly path: readonly number[];
}

/** Which ability was ranked at each level, as a grid of abilities by level. */
export function SkillOrderGrid({ caption, className, path }: SkillOrderGridProps) {
  return (
    <table className={cx("np-skill-grid", className)}>
      <caption className="np-visually-hidden">{caption}</caption>
      <thead>
        <tr>
          <th scope="col">
            <span className="np-visually-hidden">Ability</span>
          </th>
          {path.map((_, level) => (
            <th key={level} scope="col">
              {level + 1}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {abilityKeys.map((key, slot) => (
          <tr key={key} data-ability={key}>
            <th scope="row">{key}</th>
            {path.map((ranked, level) => (
              <td key={level} data-ranked={ranked === slot + 1 ? "" : undefined}>
                {ranked === slot + 1 ? key : ""}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
