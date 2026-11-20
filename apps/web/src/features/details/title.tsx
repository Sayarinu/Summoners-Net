import type { ReactNode } from "react";

/** The root of a series or game page; draft and lineup layouts respond to its width. */
export const detailPageClass = "@container/page flex min-w-0 flex-col gap-4";

/** The page header's spacing, kept as it was before the shared header. */
export const detailHeaderClass = "pt-1 pb-3";

/** Each team in the title keeps body line height, so logos and scores sit as before. */
export const titlePart = "leading-body";

/** Text colors for a won or lost score. */
export const outcomeClass = {
  win: "text-success",
  loss: "text-[color-mix(in_srgb,var(--color-status-danger)_84%,var(--color-text-primary))]",
} as const;

/** Mono facts above the title, with an optional status label beside them in normal case. */
export function TitleFacts({ children, label }: { children: ReactNode; label?: ReactNode }) {
  return (
    <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <span>{children}</span>
      {label ? (
        <span className="font-regular tracking-normal normal-case leading-body">{label}</span>
      ) : null}
    </span>
  );
}

/** One team in the title: its score beside its name and logo, linked to the team when known. */
export function TitleTeam({
  href,
  children,
  before,
  after,
}: {
  href?: string | undefined;
  children: ReactNode;
  before?: ReactNode;
  after?: ReactNode;
}) {
  return (
    <span className="inline-flex max-w-full items-center gap-2 align-middle">
      {before}
      {href ? (
        <a
          className="inline-flex min-w-0 items-center gap-2 align-middle text-inherit no-underline hover:underline"
          href={href}
        >
          {children}
        </a>
      ) : (
        children
      )}
      {after}
    </span>
  );
}
