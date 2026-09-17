import { Bell, Check } from "lucide-react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import {
  Avatar,
  Icon,
  Progress,
  Separator,
  Spinner,
  VisuallyHidden,
  analyticsData,
  cx,
} from "./internal.js";
import {
  MetaText,
  Button,
  Callout,
  IconButton,
  LiveIndicator,
  StatusIndicator,
  TextLink,
  Toast,
} from "./primitives.js";
import {
  BrandMark,
  Chip,
  CopyButton,
  DateTime,
  Disclosure,
  EntityImage,
  SelectionMark,
  SkipLink,
  ToastRegion,
} from "./support.js";

describe("internal foundations", () => {
  it("composes classes and optional analytics data", () => {
    expect(cx("one", false, undefined, "two", null)).toBe("one two");
    expect(analyticsData()).toEqual({});
    expect(analyticsData("schedule.open")).toEqual({ "data-analytics-id": "schedule.open" });
  });

  it("renders icons, avatars, progress, and utility elements", () => {
    const { container, rerender } = render(
      <div>
        <Icon icon={Bell} label="Notifications" size="large" />
        <Icon icon={Check} size="small" />
        <Avatar alt="Gen.G logo" fallback="GEN" />
        <Avatar alt="T1 logo" fallback="T1" src="/t1.png" />
        <Spinner />
        <Progress label="Import" max={50} value={75} />
        <Separator />
        <VisuallyHidden>Hidden context</VisuallyHidden>
      </div>,
    );

    expect(screen.getByRole("img", { name: "Notifications" })).toBeVisible();
    expect(screen.getByRole("img", { name: "Gen.G logo" })).toHaveTextContent("GEN");
    expect(screen.getByRole("img", { name: "T1 logo" }).querySelector("img")).toBeTruthy();
    expect(screen.getByRole("status", { name: "Loading" })).toBeVisible();
    expect(screen.getByRole("progressbar", { name: "Import" })).toHaveValue(50);
    expect(container).toHaveTextContent("Hidden context");

    rerender(<Progress label="Empty" max={100} value={-20} />);
    expect(screen.getByText("0%")).toBeVisible();
  });
});

describe("actions and status", () => {
  it("supports press, loading, disabled, size, variant, icons, and analytics", async () => {
    const user = userEvent.setup();
    const onPress = vi.fn();
    render(
      <div>
        <Button
          analyticsId="match.watch"
          endIcon={<Icon icon={Check} size="small" />}
          onPress={onPress}
          size="large"
          startIcon={<Icon icon={Bell} size="small" />}
          variant="primary"
        >
          Watch
        </Button>
        <Button loading>Save</Button>
        <Button disabled>Delete</Button>
        <IconButton icon={<Icon icon={Bell} />} label="Alerts" variant="ghost" />
      </div>,
    );

    await user.click(screen.getByRole("button", { name: "Watch" }));
    expect(onPress).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Watch" })).toHaveAttribute(
      "data-analytics-id",
      "match.watch",
    );
    expect(screen.getByRole("button", { name: "Save" })).toHaveAttribute("data-pending", "true");
    expect(screen.getByRole("button", { name: "Save" })).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("button", { name: "Delete" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Alerts" })).toBeVisible();
  });

  it("renders links, metadata, text-only status, callouts, and toasts", () => {
    const { container } = render(
      <div>
        <TextLink analyticsId="nav.team" href="/teams" variant="accent">
          Teams
        </TextLink>
        <MetaText tone="success">Verified</MetaText>
        <MetaText tone="danger">Failed</MetaText>
        <StatusIndicator label="Delayed" tone="warning" />
        <LiveIndicator label="Match live" />
        <Callout actions={<Button>Retry</Button>} title="Provider delayed" tone="warning">
          Freshness target exceeded.
        </Callout>
        <Toast action={<Button>View</Button>} title="Complete" tone="success">
          Import finished.
        </Toast>
      </div>,
    );

    expect(screen.getByRole("link", { name: "Teams" })).toHaveAttribute(
      "data-analytics-id",
      "nav.team",
    );
    expect(screen.getByText("Verified")).toBeVisible();
    expect(screen.getByText("Verified")).toHaveClass("np-meta-text");
    expect(screen.getByText("Match live")).toBeVisible();
    expect(container.querySelector(".np-status__dot")).not.toBeInTheDocument();
    expect(container.querySelector(".np-badge")).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Provider delayed" })).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent("Complete");
  });
});

describe("supporting components", () => {
  it("renders brand, skip link, entity image states, chips, date time, and selection marks", async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();
    render(
      <div>
        <BrandMark />
        <BrandMark compact />
        <SkipLink href="#content" />
        <EntityImage alt="Team logo" fallback="NP" rightsState="restricted" src="/team.png" />
        <EntityImage alt="Player" fallback="P1" rightsState="missing" />
        <Chip label="LCK" onRemove={onRemove} selected>
          LCK
        </Chip>
        <Chip>Tier 1</Chip>
        <DateTime dateTime="2026-07-10T18:00:00-04:00" relative="2 minutes ago" />
        <DateTime dateTime="2026-07-10">July 10</DateTime>
        <DateTime dateTime="2026-07-11" />
        <SelectionMark selected />
        <SelectionMark selected={false} />
      </div>,
    );

    expect(screen.getAllByRole("img", { name: "Nexus Pulse" })).toHaveLength(2);
    expect(screen.getByRole("link", { name: "Skip to main content" })).toHaveAttribute(
      "href",
      "#content",
    );
    expect(screen.getByLabelText("Image usage restricted")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Remove LCK" }));
    expect(onRemove).toHaveBeenCalledOnce();
    expect(screen.getByText("2 minutes ago")).toBeVisible();
    expect(screen.getByText("2026-07-11")).toBeVisible();
  });

  it("opens disclosures, copies values, and renders a toast region", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    const onCopy = vi.fn();
    render(
      <div>
        <Disclosure summary="Provider details">Sanitized diagnostics</Disclosure>
        <Disclosure defaultExpanded summary="Expanded details">
          Visible diagnostics
        </Disclosure>
        <CopyButton label="Copy ID" onCopy={onCopy} value="provider_123" />
        <ToastRegion>
          <Toast title="Saved">Provider updated.</Toast>
        </ToastRegion>
      </div>,
    );

    await user.click(screen.getByRole("button", { name: "Provider details" }));
    expect(screen.getByText("Sanitized diagnostics")).toBeVisible();
    expect(screen.getByText("Visible diagnostics")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Copy ID" }));
    expect(writeText).toHaveBeenCalledWith("provider_123");
    expect(onCopy).toHaveBeenCalledOnce();
    expect(screen.getByRole("region", { name: "Notifications" })).toBeVisible();
  });
});
