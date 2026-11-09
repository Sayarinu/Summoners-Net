import { Bell, Check } from "lucide-react";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Avatar, Icon, Spinner, analyticsData, cx } from "./internal.js";
import { Button, IconButton, LiveIndicator, StatusIndicator, TextLink } from "./primitives.js";

describe("internal foundations", () => {
  it("composes classes and optional analytics data", () => {
    expect(cx("one", false, undefined, "two", null)).toBe("one two");
    expect(analyticsData()).toEqual({});
    expect(analyticsData("schedule.open")).toEqual({ "data-analytics-id": "schedule.open" });
  });

  it("renders icons, avatars, and spinners", () => {
    render(
      <div>
        <Icon icon={Bell} label="Notifications" size="large" />
        <Icon icon={Check} size="small" />
        <Avatar alt="Gen.G logo" fallback="GEN" />
        <Avatar alt="T1 logo" fallback="T1" src="/t1.png" />
        <Spinner />
      </div>,
    );

    expect(screen.getByRole("img", { name: "Notifications" })).toBeVisible();
    expect(screen.getByRole("img", { name: "Gen.G logo" })).toHaveTextContent("GEN");
    expect(screen.getByRole("img", { name: "T1 logo" }).querySelector("img")).toBeTruthy();
    expect(screen.getByRole("status", { name: "Loading" })).toBeVisible();
  });

  it("shows a person for missing or failed portraits and can load a replacement image", () => {
    const view = render(<Avatar alt="Faker portrait" entityKind="player" fallback="Faker" />);
    const portrait = screen.getByRole("img", { name: "Faker portrait" });
    expect(portrait).not.toHaveTextContent("Fak");
    expect(portrait.querySelector("svg")).toBeInTheDocument();
    view.rerender(
      <Avatar alt="Faker portrait" entityKind="player" fallback="Faker" src="/portrait.png" />,
    );
    fireEvent.error(portrait.querySelector("img")!);
    expect(portrait.querySelector("img")).toBeNull();
    expect(portrait.querySelector("svg")).toBeInTheDocument();
    view.rerender(
      <Avatar alt="Faker portrait" entityKind="player" fallback="Faker" src="/replacement.png" />,
    );
    expect(portrait.querySelector("img")).toHaveAttribute("src", "/replacement.png");
    expect(portrait.querySelector("svg")).toBeNull();
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

  it("renders links, text-only status, and live indicators", () => {
    const { container } = render(
      <div>
        <TextLink analyticsId="nav.team" href="/teams" variant="accent">
          Teams
        </TextLink>
        <StatusIndicator label="Delayed" tone="warning" />
        <LiveIndicator label="Match live" />
      </div>,
    );

    expect(screen.getByRole("link", { name: "Teams" })).toHaveAttribute(
      "data-analytics-id",
      "nav.team",
    );
    expect(screen.getByText("Match live")).toBeVisible();
    expect(container.querySelector(".np-status__dot")).not.toBeInTheDocument();
    expect(container.querySelector(".np-badge")).not.toBeInTheDocument();
    expect(screen.getByText("Delayed")).toBeVisible();
  });
});
