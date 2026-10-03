import { Bell, Calendar, Settings } from "lucide-react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import {
  Checkbox,
  Combobox,
  Input,
  RadioGroup,
  SearchInput,
  Select,
  Switch,
  Textarea,
} from "./forms.js";
import { Icon } from "./internal.js";
import {
  Breadcrumb,
  Footer,
  Header,
  Menu,
  Navigation,
  Pagination,
  SegmentedControl,
  Tabs,
  getPaginationRange,
} from "./navigation.js";

const options = [
  { description: "Korea", label: "LCK", value: "lck" },
  { description: "China", label: "LPL", value: "lpl" },
] as const;

describe("forms", () => {
  it("wires input labels, descriptions, errors, affixes, and search clearing", async () => {
    const user = userEvent.setup();
    const onClear = vi.fn();
    render(
      <div>
        <Input description="Public name" label="Team" prefix="#" required suffix="verified" />
        <Input error="Invalid URL" label="Website" value="bad" readOnly />
        <SearchInput label="Search" onClear={onClear} value="Gen.G" readOnly />
        <SearchInput label="Empty search" value="" readOnly />
        <Textarea description="Private note" label="Note" />
        <Textarea error="Required" label="Reason" />
      </div>,
    );

    expect(screen.getByRole("textbox", { name: "Team" })).toBeRequired();
    expect(screen.getByRole("textbox", { name: "Team" })).toHaveAccessibleDescription(
      "Public name",
    );
    expect(screen.getByRole("textbox", { name: "Website" })).toBeInvalid();
    expect(screen.getByRole("textbox", { name: "Website" })).toHaveAccessibleDescription(
      "Invalid URL",
    );
    await user.click(screen.getByRole("button", { name: "Clear search" }));
    expect(onClear).toHaveBeenCalledOnce();
    expect(screen.getAllByRole("textbox")).toHaveLength(4);
  });

  it("renders custom selects and comboboxes and reports selection/input changes", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const onInput = vi.fn();
    const onComboSelect = vi.fn();
    render(
      <div>
        <Select
          defaultValue="lck"
          description="Primary region"
          label="Region"
          onValueChange={onSelect}
          options={options}
        />
        <Select disabled error="Required" label="Disabled region" options={options} required />
        <Combobox
          label="Search region"
          onSelectionChange={onComboSelect}
          onValueChange={onInput}
          options={options}
        />
      </div>,
    );

    const regionButton = screen.getByRole("button", { name: /^LCK.*Region$/ });
    expect(regionButton).toHaveTextContent("LCK - Korea");
    await user.click(regionButton);
    const option = await screen.findByRole("option", { name: /^LPL/ });
    await user.click(option);
    expect(onSelect).toHaveBeenCalledWith("lpl");
    expect(regionButton).toHaveTextContent("LPL - China");

    const combo = screen.getByRole("combobox", { name: "Search region" });
    await user.type(combo, "LC");
    expect(onInput).toHaveBeenCalled();
    await user.click(await screen.findByRole("option", { name: /^LCK/ }));
    expect(onComboSelect).toHaveBeenCalledWith("lck");
    expect(screen.getByText("Required")).toBeVisible();
  });

  it("supports checkbox, radio, and switch input", async () => {
    const user = userEvent.setup();
    const onCheck = vi.fn();
    const onRadio = vi.fn();
    const onSwitch = vi.fn();
    render(
      <div>
        <Checkbox analyticsId="showmatches" onChange={onCheck}>
          Include showmatches
        </Checkbox>
        <Checkbox defaultSelected disabled>
          Locked
        </Checkbox>
        <RadioGroup
          defaultValue="canonical"
          label="Resolution"
          onChange={onRadio}
          options={[
            { label: "Canonical", value: "canonical" },
            { description: "Manual review", label: "Manual", value: "manual" },
          ]}
          orientation="horizontal"
        />
        <Switch analyticsId="spoilers" onChange={onSwitch}>
          Hide spoilers
        </Switch>
      </div>,
    );

    await user.click(screen.getByRole("checkbox", { name: "Include showmatches" }));
    expect(onCheck).toHaveBeenCalledWith(true);
    expect(screen.getByRole("checkbox", { name: "Locked" })).toBeDisabled();
    await user.click(screen.getByRole("radio", { name: /^Manual.*review$/ }));
    expect(onRadio).toHaveBeenCalledWith("manual");
    await user.click(screen.getByRole("switch", { name: "Hide spoilers" }));
    expect(onSwitch).toHaveBeenCalledWith(true);
  });
});

describe("navigation", () => {
  it("calculates compact pagination ranges", () => {
    expect(getPaginationRange(2, 5)).toEqual([1, 2, 3, 4, 5]);
    expect(getPaginationRange(2, 18)).toEqual([1, 2, 3, 4, 5, "ellipsis", 18]);
    expect(getPaginationRange(17, 18)).toEqual([1, "ellipsis", 14, 15, 16, 17, 18]);
    expect(getPaginationRange(9, 18)).toEqual([1, "ellipsis", 8, 9, 10, "ellipsis", 18]);
  });

  it("switches tabs and segments", async () => {
    const user = userEvent.setup();
    const onTab = vi.fn();
    const onSegment = vi.fn();
    render(
      <div>
        <Tabs
          defaultSelectedKey="one"
          label="Sections"
          onSelectionChange={onTab}
          items={[
            { content: "Panel one", id: "one", label: "One" },
            {
              meta: "2",
              content: "Panel two",
              disabled: false,
              icon: <Icon icon={Bell} />,
              id: "two",
              label: "Two",
            },
          ]}
        />
        <SegmentedControl
          defaultValue="list"
          label="View"
          onChange={onSegment}
          options={[
            { icon: <Icon icon={Calendar} />, label: "List", value: "list" },
            { label: "Grid", value: "grid" },
          ]}
        />
      </div>,
    );

    await user.click(screen.getByRole("tab", { name: /^Two.*2$/ }));
    expect(onTab).toHaveBeenCalledWith("two");
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Panel two");
    await user.click(screen.getByRole("radio", { name: "Grid" }));
    expect(onSegment).toHaveBeenCalledWith("grid");
  });

  it("renders navigation, breadcrumbs, header, footer, and pagination actions", async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    const onPage = vi.fn();
    const { rerender } = render(
      <div>
        <Breadcrumb
          items={[{ href: "/events", label: "Events" }, { label: "Stage" }, { label: "Match" }]}
        />
        <Navigation
          currentHref="/schedule"
          onNavigate={onNavigate}
          items={[
            { href: "/schedule", icon: <Icon icon={Calendar} />, label: "Schedule" },
            { href: "/live", label: "Live", meta: "3" },
          ]}
        />
        <Header
          actions={<button>Profile</button>}
          brand="NP"
          navigation={<a href="/schedule">Schedule</a>}
          status="Healthy"
        />
        <Footer links={[{ href: "/privacy", label: "Privacy" }]} status="Operational" />
        <Pagination currentPage={2} onPageChange={onPage} totalPages={8} />
      </div>,
    );

    expect(screen.getByRole("link", { name: "Events" })).toBeVisible();
    expect(screen.getByText("Stage")).toBeVisible();
    expect(screen.getByText("Match")).toHaveAttribute("aria-current", "page");
    const primaryNavigation = screen.getByRole("navigation", { name: "Primary" });
    expect(within(primaryNavigation).getByRole("link", { name: "Schedule" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await user.click(within(primaryNavigation).getByRole("link", { name: /^Live/ }));
    expect(onNavigate).toHaveBeenCalledWith("/live");
    expect(screen.getByRole("link", { name: "Skip to main content" })).toBeVisible();
    expect(screen.getByRole("contentinfo")).toHaveTextContent("Operational");
    await user.click(screen.getByRole("button", { name: "Previous page" }));
    await user.click(screen.getByRole("button", { name: "Next page" }));
    await user.click(screen.getByRole("button", { name: "Page 4" }));
    expect(onPage).toHaveBeenNthCalledWith(1, 1);
    expect(onPage).toHaveBeenNthCalledWith(2, 3);
    expect(onPage).toHaveBeenNthCalledWith(3, 4);

    rerender(<Pagination currentPage={1} onPageChange={onPage} totalPages={1} />);
    expect(screen.getByRole("button", { name: "Previous page" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next page" })).toBeDisabled();
  });

  it("opens a menu and dispatches the selected action", async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    render(
      <Menu
        analyticsId="provider.menu"
        items={[
          {
            description: "Edit settings",
            icon: <Icon icon={Settings} />,
            id: "edit",
            label: "Edit",
          },
          { disabled: true, id: "delete", label: "Delete" },
        ]}
        onAction={onAction}
      />,
    );
    const trigger = screen.getByRole("button", { name: "More actions" });
    expect(trigger).toHaveAttribute("data-analytics-id", "provider.menu");
    expect(trigger.querySelectorAll("svg")).toHaveLength(1);
    await user.click(trigger);
    const menu = await screen.findByRole("menu", { name: "More actions" });
    await user.click(within(menu).getByRole("menuitem", { name: /^Edit.*settings$/ }));
    expect(onAction).toHaveBeenCalledWith("edit");
  });

  it("omits an empty footer navigation landmark", () => {
    render(<Footer />);

    expect(screen.getByRole("contentinfo")).toHaveTextContent("Nouvelle Lune Atelier");
    expect(screen.queryByRole("navigation", { name: "Footer" })).not.toBeInTheDocument();
  });

  it("supports a brandless header without an empty grid slot", () => {
    render(<Header brand={null} navigation={<a href="/schedule">Schedule</a>} />);

    expect(screen.getByRole("banner")).toHaveClass("np-header--brandless");
    expect(screen.queryByText("NEXUS PULSE")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Schedule" })).toBeVisible();
  });
});
