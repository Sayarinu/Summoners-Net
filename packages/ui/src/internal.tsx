import { UserRound, type LucideIcon } from "lucide-react";
import { useState } from "react";
import type { HTMLAttributes } from "react";

export interface AnalyticsProps {
  readonly analyticsId?: string;
}

export function cx(...values: Array<false | null | string | undefined>): string {
  return values.filter(Boolean).join(" ");
}

export function analyticsData(analyticsId?: string): Record<string, string> {
  return analyticsId ? { "data-analytics-id": analyticsId } : {};
}

export interface IconProps {
  readonly icon: LucideIcon;
  readonly label?: string;
  readonly size?: "large" | "medium" | "small";
}

export function Icon({ icon: Glyph, label, size = "medium" }: IconProps) {
  return (
    <Glyph
      aria-hidden={label ? undefined : true}
      aria-label={label}
      className={cx("np-icon", `np-icon--${size}`)}
      role={label ? "img" : undefined}
      strokeWidth={1.75}
    />
  );
}

export interface AvatarProps extends HTMLAttributes<HTMLSpanElement> {
  readonly alt: string;
  readonly entityKind?: "team" | "player" | undefined;
  readonly fallback: string;
  readonly size?: "large" | "medium" | "small";
  readonly src?: string | undefined;
}

export function Avatar({
  alt,
  className,
  entityKind,
  fallback,
  size = "medium",
  src,
  ...props
}: AvatarProps) {
  const [failedSrc, setFailedSrc] = useState<string>();
  return (
    <span
      {...props}
      aria-label={alt}
      className={cx("np-avatar", `np-avatar--${size}`, className)}
      data-entity-kind={entityKind}
      role="img"
    >
      {src && src !== failedSrc ? (
        <img
          alt=""
          src={src}
          ref={(image) => {
            // Decode also observes failures that happened before hydration, including
            // transport cancellation in browsers that do not replay the error event.
            let current = true;
            void image?.decode?.().catch(() => {
              if (current) setFailedSrc(src);
            });
            return () => {
              current = false;
            };
          }}
          onError={() => setFailedSrc(src)}
        />
      ) : entityKind === "player" ? (
        <Icon icon={UserRound} size="large" />
      ) : (
        <span aria-hidden="true">{fallback.slice(0, 3)}</span>
      )}
    </span>
  );
}

export interface SpinnerProps {
  /**
   * Hides the spinner from assistive technology when a parent control already
   * communicates the pending state. Standalone spinners remain announced.
   */
  readonly decorative?: boolean;
  readonly label?: string;
}

export function Spinner({ decorative = false, label = "Loading" }: SpinnerProps) {
  if (decorative) {
    return (
      <span aria-hidden="true" className="np-spinner">
        <span />
      </span>
    );
  }

  return (
    <span aria-label={label} className="np-spinner" role="status">
      <span aria-hidden="true" />
    </span>
  );
}
