import { Check, ChevronRight, Copy, ImageOff, MoonStar } from "lucide-react";
import type { ReactNode } from "react";
import {
  Button as AriaButton,
  Disclosure as AriaDisclosure,
  DisclosurePanel,
} from "react-aria-components";

import { Avatar, cx, Icon } from "./internal.js";
import { Button } from "./primitives.js";

export function BrandMark({ compact = false }: { readonly compact?: boolean }) {
  return (
    <span
      aria-label="Nexus Pulse"
      className={cx("np-brand-mark", compact && "np-brand-mark--compact")}
      role="img"
    >
      <span aria-hidden="true" className="np-brand-mark__signal">
        <MoonStar />
      </span>
      {compact ? null : <span>NEXUS PULSE</span>}
    </span>
  );
}

export function SkipLink({ href = "#main-content" }: { readonly href?: string }) {
  return (
    <a className="np-skip-link" href={href}>
      Skip to main content
    </a>
  );
}

export interface EntityImageProps {
  readonly alt: string;
  readonly fallback: string;
  readonly rightsState?: "approved" | "missing" | "restricted";
  readonly size?: "large" | "medium" | "small";
  readonly src?: string;
}

export function EntityImage({
  alt,
  fallback,
  rightsState = "approved",
  size = "medium",
  src,
}: EntityImageProps) {
  const available = Boolean(src) && rightsState === "approved";
  return (
    <span className={cx("np-entity-image", !available && "np-entity-image--fallback")}>
      <Avatar alt={alt} fallback={fallback} size={size} src={available ? src : undefined} />
      {rightsState !== "approved" ? (
        <span
          aria-label={rightsState === "restricted" ? "Image usage restricted" : "Image unavailable"}
          className="np-entity-image__state"
        >
          <Icon icon={ImageOff} size="small" />
        </span>
      ) : null}
    </span>
  );
}

export interface ChipProps {
  readonly children: ReactNode;
  readonly label?: string;
  readonly onRemove?: () => void;
  readonly selected?: boolean;
}

export function Chip({ children, label, onRemove, selected = false }: ChipProps) {
  return onRemove ? (
    <button
      aria-label={`Remove ${label ?? "filter"}`}
      className={cx("np-chip", selected && "np-chip--selected")}
      onClick={onRemove}
      type="button"
    >
      {children}
      <span aria-hidden="true">×</span>
    </button>
  ) : (
    <span className={cx("np-chip", selected && "np-chip--selected")}>{children}</span>
  );
}

export interface DisclosureProps {
  readonly children: ReactNode;
  readonly defaultExpanded?: boolean;
  readonly summary: ReactNode;
}

export function Disclosure({ children, defaultExpanded = false, summary }: DisclosureProps) {
  return (
    <AriaDisclosure className="np-disclosure" defaultExpanded={defaultExpanded}>
      <AriaButton className="np-disclosure__trigger" slot="trigger">
        <span>{summary}</span>
        <Icon icon={ChevronRight} size="small" />
      </AriaButton>
      <DisclosurePanel className="np-disclosure__panel">{children}</DisclosurePanel>
    </AriaDisclosure>
  );
}

export function DateTime({
  children,
  dateTime,
  relative,
}: {
  readonly children?: ReactNode;
  readonly dateTime: string;
  readonly relative?: string;
}) {
  return (
    <time dateTime={dateTime} title={dateTime}>
      {children ?? relative ?? dateTime}
    </time>
  );
}

export interface CopyButtonProps {
  readonly label?: string;
  readonly onCopy?: () => void;
  readonly value: string;
}

export function CopyButton({ label = "Copy", onCopy, value }: CopyButtonProps) {
  const handlePress = async () => {
    await navigator.clipboard.writeText(value);
    onCopy?.();
  };

  return (
    <Button
      onPress={() => void handlePress()}
      size="compact"
      startIcon={<Icon icon={Copy} size="small" />}
      variant="ghost"
    >
      {label}
    </Button>
  );
}

export function ToastRegion({
  children,
  label = "Notifications",
}: {
  readonly children: ReactNode;
  readonly label?: string;
}) {
  return (
    <section aria-label={label} aria-live="polite" className="np-toast-region">
      {children}
    </section>
  );
}

export function SelectionMark({ selected }: { readonly selected: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cx("np-selection-mark", selected && "np-selection-mark--selected")}
    >
      {selected ? <Icon icon={Check} size="small" /> : null}
    </span>
  );
}
