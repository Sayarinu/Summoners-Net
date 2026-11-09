import { Button as AriaButton } from "react-aria-components";
import type { ButtonProps as AriaButtonProps } from "react-aria-components";
import type { AnchorHTMLAttributes, ReactNode } from "react";

import { analyticsData, cx, Spinner } from "./internal.js";
import type { AnalyticsProps } from "./internal.js";

export type ControlSize = "compact" | "large" | "medium" | "small";
export type Intent = "danger" | "info" | "neutral" | "success" | "warning";

export interface ButtonProps
  extends
    Omit<AriaButtonProps, "children" | "className" | "isDisabled" | "isPending">,
    AnalyticsProps {
  readonly children: ReactNode;
  readonly className?: string;
  readonly disabled?: boolean;
  readonly endIcon?: ReactNode;
  readonly loading?: boolean;
  readonly size?: ControlSize;
  readonly startIcon?: ReactNode;
  readonly variant?: "danger" | "ghost" | "primary" | "secondary";
}

export function Button({
  analyticsId,
  children,
  className,
  disabled = false,
  endIcon,
  loading = false,
  size = "medium",
  startIcon,
  variant = "secondary",
  ...props
}: ButtonProps) {
  return (
    <AriaButton
      {...props}
      {...analyticsData(analyticsId)}
      className={cx("np-button", `np-button--${variant}`, `np-control--${size}`, className)}
      isDisabled={disabled}
      isPending={loading}
    >
      {loading ? <Spinner decorative /> : startIcon}
      <span>{children}</span>
      {endIcon}
    </AriaButton>
  );
}

export interface IconButtonProps extends Omit<ButtonProps, "children" | "endIcon" | "startIcon"> {
  readonly icon: ReactNode;
  readonly label: string;
}

export function IconButton({ icon, label, ...props }: IconButtonProps) {
  return (
    <Button {...props} aria-label={label} className={cx("np-icon-button", props.className)}>
      {icon}
    </Button>
  );
}

export interface TextLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement>, AnalyticsProps {
  readonly variant?: "accent" | "muted" | "primary";
}

export function TextLink({
  analyticsId,
  children,
  className,
  variant = "primary",
  ...props
}: TextLinkProps) {
  return (
    <a
      {...props}
      {...analyticsData(analyticsId)}
      className={cx("np-text-link", `np-text-link--${variant}`, className)}
    >
      {children}
    </a>
  );
}

export interface StatusIndicatorProps {
  readonly label: string;
  readonly tone?: Intent | "live";
}

export function StatusIndicator({ label, tone = "neutral" }: StatusIndicatorProps) {
  return <span className={cx("np-status", `np-status--${tone}`)}>{label}</span>;
}

export function LiveIndicator({ label = "Live" }: { readonly label?: string }) {
  return <StatusIndicator label={label} tone="live" />;
}
