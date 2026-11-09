import { Calendar } from "lucide-react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Combobox, Input, Select, Switch } from "./forms.js";
import { Icon } from "./internal.js";
import { Breadcrumb, Footer, Navigation, Pagination, getPaginationRange } from "./navigation.js";
import { SkipLink } from "./support.js";

const options = [
  { description: "Korea", label: "LCK", value: "lck" },
  { description: "China", label: "LPL", value: "lpl" },
] as const;

describe("forms", () => {
  it("wires input labels, descriptions, errors, and affixes", () => {
    render(
      <div>
        <Input description="Public name" label="Team" prefix="#" required suffix="verified" />
        <Input error="Invalid URL" label="Website" value="bad" readOnly />
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
    expect(screen.getAllByRole("textbox")).toHaveLength(2);
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

  it("supports switch input", async () => {
    const user = userEvent.setup();
    const onSwitch = vi.fn();
    render(
      <Switch analyticsId="spoilers" onChange={onSwitch}>
        Hide spoilers
      </Switch>,
    );

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

  it("renders navigation, breadcrumbs, skip link, footer, and pagination actions", async () => {
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
        <SkipLink />
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

  it("omits an empty footer navigation landmark", () => {
    render(<Footer />);

    expect(screen.getByRole("contentinfo")).toHaveTextContent("Nouvelle Lune Atelier");
    expect(screen.queryByRole("navigation", { name: "Footer" })).not.toBeInTheDocument();
  });
});
