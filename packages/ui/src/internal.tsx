import type { LucideIcon } from "lucide-react";
import type { CSSProperties, HTMLAttributes, ReactNode } from "react";

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

export function VisuallyHidden({ children }: { readonly children: ReactNode }) {
  return <span className="np-visually-hidden">{children}</span>;
}

export interface AvatarProps extends HTMLAttributes<HTMLSpanElement> {
  readonly alt: string;
  readonly fallback: string;
  readonly size?: "large" | "medium" | "small";
  readonly src?: string | undefined;
}

export function Avatar({ alt, className, fallback, size = "medium", src, ...props }: AvatarProps) {
  return (
    <span
      {...props}
      aria-label={alt}
      className={cx("np-avatar", `np-avatar--${size}`, className)}
      role="img"
    >
      {src ? <img alt="" src={src} /> : <span aria-hidden="true">{fallback.slice(0, 3)}</span>}
    </span>
  );
}

export function Separator({ className }: { readonly className?: string }) {
  return <hr className={cx("np-separator", className)} />;
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

export interface ProgressProps {
  readonly label: string;
  readonly max?: number;
  readonly value: number;
}

export function Progress({ label, max = 100, value }: ProgressProps) {
  const safeMax = Number.isFinite(max) && max > 0 ? max : 100;
  const safeValue = Number.isFinite(value) ? Math.min(safeMax, Math.max(0, value)) : 0;
  const percentage = (safeValue / safeMax) * 100;
  const style = { "--np-progress": `${percentage}%` } as CSSProperties;

  return (
    <div className="np-progress">
      <div className="np-progress__meta">
        <span>{label}</span>
        <span className="np-mono">{Math.round(percentage)}%</span>
      </div>
      <progress aria-label={label} max={safeMax} style={style} value={safeValue} />
    </div>
  );
}
