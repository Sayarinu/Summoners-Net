import { CalendarDays, Database, Gauge, Settings, Trash2 } from "lucide-react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { describe, expect, it, vi } from "vitest";

import {
  AdvancedCheckbox,
  CollapsedNavigation,
  CursorPagination,
  DataTable,
  DateTimeInput,
  DismissibleAlert,
  DismissibleToast,
  Fieldset,
  FileUpload,
  FormErrorSummary,
  FormSection,
  LoadMore,
  MobileAdminNavigation,
  MobileNavigation,
  MobileRowActionMenu,
  MultiSelect,
  NumberInput,
  OverflowTabs,
  PageHeader,
  Radio,
  SecretInput,
  SectionHeader,
  SplitPanel,
  TimezoneSelect,
  Toolbar,
  commonTimezones,
} from "./core-advanced.js";
import { Icon } from "./internal.js";
import { Button } from "./primitives.js";

describe("advanced form controls", () => {
  it("composes native radios, indeterminate checkboxes, and fieldset messaging", async () => {
    const user = userEvent.setup();
    const onRadio = vi.fn();
    const onCheck = vi.fn();
    render(
      <Fieldset description="Choose exactly one" legend="Resolution" required>
        <Radio
          description="Highest-ranked source"
          name="resolution"
          onChange={onRadio}
          value="canonical"
        >
          Canonical
        </Radio>
        <AdvancedCheckbox indeterminate onChange={onCheck}>
          Partial metrics
        </AdvancedCheckbox>
      </Fieldset>,
    );

    const group = screen.getByRole("group", { name: /Resolution/ });
    expect(group).toHaveAccessibleDescription("Choose exactly one");
    await user.click(screen.getByRole("radio", { name: /Canonical.*Highest-ranked source/ }));
    expect(onRadio).toHaveBeenCalledWith(true);
    const checkbox = screen.getByRole("checkbox", { name: "Partial metrics" });
    expect(checkbox).toBePartiallyChecked();
    await user.click(checkbox);
    expect(onCheck).toHaveBeenCalledWith(true);
  });

  it("renders semantic form sections and linked error summaries", () => {
    const { rerender } = render(
      <div>
        <FormErrorSummary errors={[{ fieldId: "secret", message: "Secret is required" }]} />
        <FormSection
          actions={<button>Save</button>}
          description="Credentials"
          title="Authentication"
        >
          <input id="secret" />
        </FormSection>
      </div>,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Secret is required");
    expect(screen.getByRole("link", { name: "Secret is required" })).toHaveAttribute(
      "href",
      "#secret",
    );
    expect(screen.getByRole("region", { name: "Authentication" })).toBeVisible();

    rerender(<FormErrorSummary errors={[]} />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("reveals and copies secrets while preserving the input label", async () => {
    const user = userEvent.setup();
    const onCopy = vi.fn();
    render(
      <SecretInput
        analyticsId="provider-secret"
        description="Encrypted at rest"
        label="API secret"
        onCopy={onCopy}
        value="secret-123"
        readOnly
      />,
    );

    const input = screen.getByLabelText("API secret");
    expect(input).toHaveAttribute("type", "password");
    expect(input).toHaveAccessibleDescription("Encrypted at rest");
    await user.click(screen.getByRole("button", { name: "Show secret" }));
    expect(input).toHaveAttribute("type", "text");
    await user.click(screen.getByRole("button", { name: "Copy secret" }));
    expect(onCopy).toHaveBeenCalledWith("secret-123");
    expect(screen.getByRole("button", { name: "Copied" })).toBeVisible();
    expect(input).toHaveAttribute("data-analytics-id", "provider-secret");
  });

  it("steps, clamps, and clears numeric values", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <NumberInput
        defaultValue={1}
        description="Zero to two"
        label="Priority"
        max={2}
        min={0}
        onValueChange={onChange}
      />,
    );

    const input = screen.getByRole("spinbutton", { name: "Priority" });
    await user.click(screen.getByRole("button", { name: "Increase Priority" }));
    expect(input).toHaveValue(2);
    expect(screen.getByRole("button", { name: "Increase Priority" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Decrease Priority" }));
    expect(input).toHaveValue(1);
    await user.clear(input);
    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  it("provides date-time and timezone controls with validation semantics", async () => {
    const user = userEvent.setup();
    const onTimezone = vi.fn();
    render(
      <div>
        <DateTimeInput error="Choose a future time" label="Effective at" timezone="UTC" />
        <TimezoneSelect onValueChange={onTimezone} />
      </div>,
    );

    expect(screen.getByLabelText("Effective at")).toBeInvalid();
    expect(commonTimezones).toHaveLength(6);
    const timezone = screen.getByRole("button", { name: /^UTC.*Timezone$/ });
    await user.click(timezone);
    await user.click(await screen.findByRole("option", { name: /^Korea Standard Time/ }));
    expect(onTimezone).toHaveBeenCalledWith("Asia/Seoul");
  });

  it("selects multiple options and reports the complete value set", async () => {
    const user = userEvent.setup();
    const onSelection = vi.fn();
    render(
      <MultiSelect
        defaultSelectedValues={["lck"]}
        label="Regions"
        onSelectionChange={onSelection}
        options={[
          { label: "LCK", value: "lck" },
          { label: "LPL", value: "lpl" },
          { disabled: true, label: "Archived", value: "archive" },
        ]}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Regions/ }));
    await user.click(await screen.findByRole("option", { name: "LPL" }));
    expect(onSelection).toHaveBeenCalledWith(expect.arrayContaining(["lck", "lpl"]));
    expect(screen.getByRole("option", { name: "Archived" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("accepts, validates, and removes uploaded files", async () => {
    const user = userEvent.setup();
    const onFiles = vi.fn();
    const { container } = render(
      <FileUpload accept=".json" label="Evidence" maxSizeBytes={8} onFilesChange={onFiles} />,
    );
    const input = container.querySelector('input[type="file"]');
    expect(input).toBeInstanceOf(HTMLInputElement);
    if (!(input instanceof HTMLInputElement)) throw new Error("File input missing");

    await user.upload(input, new File(["too-large"], "large.json", { type: "application/json" }));
    expect(screen.getByRole("alert")).toHaveTextContent("exceeds the file-size limit");

    const valid = new File(["{}"], "evidence.json", { type: "application/json" });
    await user.upload(input, valid);
    expect(onFiles).toHaveBeenLastCalledWith([valid]);
    expect(screen.getByRole("list", { name: "Selected files" })).toHaveTextContent("evidence.json");
    await user.click(screen.getByRole("button", { name: "Remove evidence.json" }));
    expect(onFiles).toHaveBeenLastCalledWith([]);
  });

  it("renders controlled, disabled, invalid, and minimal form variants", () => {
    const file = new File(["{}"], "locked.json", { type: "application/json" });
    render(
      <div>
        <Radio analyticsId="radio" defaultChecked disabled name="mode" value="locked">
          Locked mode
        </Radio>
        <AdvancedCheckbox
          analyticsId="checkbox"
          defaultSelected
          description="Managed upstream"
          disabled
          name="managed"
          value="yes"
        >
          Managed
        </AdvancedCheckbox>
        <Fieldset
          analyticsId="fieldset"
          className="custom"
          disabled
          error="Fix this"
          legend="Invalid group"
        >
          <input />
        </Fieldset>
        <FormSection analyticsId="section" className="custom" title="Minimal section">
          Content
        </FormSection>
        <SecretInput defaultValue="temporary" error="Expired" label="Expired secret" />
        <NumberInput
          disabled
          error="Unavailable"
          label="Disabled number"
          max={10}
          min={0}
          value={0}
        />
        <DateTimeInput analyticsId="datetime" description="Local time" label="Starts" />
        <TimezoneSelect
          analyticsId="timezone"
          description="Locked by policy"
          disabled
          error="Unsupported timezone"
          label="Policy timezone"
          options={[{ label: "Seoul", value: "Asia/Seoul" }]}
          value="Asia/Seoul"
        />
        <FileUpload
          disabled
          error="Uploads paused"
          label="Locked upload"
          uploading
          value={[file]}
        />
      </div>,
    );

    expect(screen.getByRole("radio", { name: "Locked mode" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: /Managed/ })).toBeDisabled();
    expect(screen.getByRole("group", { name: "Invalid group" })).toBeDisabled();
    expect(screen.getByLabelText("Expired secret")).toBeInvalid();
    expect(screen.queryByRole("button", { name: "Copy secret" })).not.toBeInTheDocument();
    expect(screen.getByRole("spinbutton", { name: "Disabled number" })).toBeDisabled();
    expect(screen.getByLabelText("Starts")).toHaveAccessibleDescription("Local time");
    expect(screen.getByRole("button", { name: /Seoul.*Policy timezone/ })).toBeDisabled();
    expect(screen.getByLabelText("Locked upload")).toBeDisabled();
    expect(screen.getByRole("status", { name: "Uploading files" })).toBeVisible();
  });

  it("summarizes long and empty multi-selection states", () => {
    render(
      <div>
        <MultiSelect
          error="Choose fewer regions"
          label="Many regions"
          options={[
            { description: "Korea", label: "LCK", value: "lck" },
            { label: "LPL", value: "lpl" },
            { label: "LEC", value: "lec" },
          ]}
          selectedValues={["lck", "lpl", "lec"]}
        />
        <MultiSelect
          description="No region selected"
          disabled
          label="Empty regions"
          options={[]}
          placeholder="Choose regions"
        />
      </div>,
    );
    expect(screen.getByText(", +1 more")).toBeVisible();
    expect(screen.getByText("Choose fewer regions")).toBeVisible();
    expect(screen.getByRole("button", { name: "Empty regions" })).toBeDisabled();
    expect(screen.getByText("Choose regions")).toBeVisible();
  });

  it("accepts dropped files in multiple mode and ignores drops while disabled", () => {
    const onFiles = vi.fn();
    const first = new File(["1"], "one.json");
    const second = new File(["2"], "two.json");
    const { container, rerender } = render(
      <FileUpload label="Drop evidence" multiple onFilesChange={onFiles} />,
    );
    const dropzone = container.querySelector(".np-file-upload__dropzone");
    expect(dropzone).not.toBeNull();
    if (!dropzone) throw new Error("Dropzone missing");
    fireEvent.dragOver(dropzone);
    fireEvent.drop(dropzone, { dataTransfer: { files: [first, second] } });
    expect(onFiles).toHaveBeenLastCalledWith([first, second]);

    rerender(<FileUpload disabled label="Drop evidence" multiple onFilesChange={onFiles} />);
    const disabledDropzone = container.querySelector(".np-file-upload__dropzone");
    if (!disabledDropzone) throw new Error("Dropzone missing");
    fireEvent.drop(disabledDropzone, { dataTransfer: { files: [first] } });
    expect(onFiles).toHaveBeenCalledTimes(1);
  });
});

interface Row {
  id: string;
  latency: number;
  name: string;
}

const rows: readonly Row[] = [
  { id: "b", latency: 400, name: "Beta" },
  { id: "a", latency: 120, name: "Alpha" },
];

const columns = [
  {
    header: "Provider",
    id: "name",
    render: (row: Row) => row.name,
    sortable: true,
    sortValue: (row: Row) => row.name,
  },
  {
    align: "end" as const,
    header: "Latency",
    id: "latency",
    render: (row: Row) => `${row.latency}ms`,
    sortable: true,
    sortValue: (row: Row) => row.latency,
  },
] as const;

describe("advanced data operations", () => {
  it("sorts rows, exposes aria-sort, selects rows, and runs desktop actions", async () => {
    const user = userEvent.setup();
    const onSelection = vi.fn();
    const onInspect = vi.fn();
    render(
      <DataTable
        actions={[{ id: "inspect", label: "Inspect", onAction: onInspect }]}
        caption="Providers"
        columns={columns}
        getRowKey={(row) => row.id}
        getRowLabel={(row) => row.name}
        onSelectionChange={onSelection}
        rows={rows}
        selectable
        stickyHeader
      />,
    );

    const table = screen.getByRole("table", { name: "Providers" });
    const body = within(table).getAllByRole("rowgroup")[1];
    expect(body).toBeDefined();
    if (!body) throw new Error("Table body missing");
    expect(within(body).getAllByRole("row")[0]).toHaveTextContent("Beta");

    await user.click(screen.getByRole("button", { name: /Provider/ }));
    expect(screen.getByRole("columnheader", { name: /Provider/ })).toHaveAttribute(
      "aria-sort",
      "ascending",
    );
    expect(within(body).getAllByRole("row")[0]).toHaveTextContent("Alpha");
    await user.click(screen.getByRole("button", { name: /Provider/ }));
    expect(screen.getByRole("columnheader", { name: /Provider/ })).toHaveAttribute(
      "aria-sort",
      "descending",
    );

    await user.click(screen.getByRole("checkbox", { name: "Select Alpha" }));
    expect(onSelection).toHaveBeenCalledWith(["a"]);
    await user.click(screen.getAllByRole("button", { name: "Inspect" })[0] as HTMLElement);
    expect(onInspect).toHaveBeenCalledWith(expect.objectContaining({ name: "Beta" }));
  });

  it("selects and clears all current-page rows", async () => {
    const user = userEvent.setup();
    const onSelection = vi.fn();
    render(
      <DataTable
        caption="Selectable"
        columns={columns}
        defaultSelectedKeys={["a"]}
        getRowKey={(row) => row.id}
        onSelectionChange={onSelection}
        rows={rows}
        selectable
      />,
    );
    const selectAll = screen.getByRole("checkbox", { name: "Select all rows" });
    expect(selectAll).toBePartiallyChecked();
    await user.click(selectAll);
    expect(onSelection).toHaveBeenLastCalledWith(expect.arrayContaining(["a", "b"]));
    await user.click(selectAll);
    expect(onSelection).toHaveBeenLastCalledWith([]);
  });

  it("supports controlled sorting and loading and empty states", async () => {
    const user = userEvent.setup();
    const onSort = vi.fn();
    const { rerender } = render(
      <DataTable
        caption="Controlled"
        columns={columns}
        getRowKey={(row) => row.id}
        onSortChange={onSort}
        rows={rows}
        sort={{ columnId: "latency", direction: "ascending" }}
      />,
    );
    expect(screen.getByRole("columnheader", { name: /Latency/ })).toHaveAttribute(
      "aria-sort",
      "ascending",
    );
    await user.click(screen.getByRole("button", { name: /Latency/ }));
    expect(onSort).toHaveBeenCalledWith({ columnId: "latency", direction: "descending" });

    rerender(
      <DataTable
        caption="Loading"
        columns={columns}
        getRowKey={(row) => row.id}
        loading
        rows={[]}
      />,
    );
    const tbody = screen.getByRole("table", { name: "Loading" }).querySelector("tbody");
    expect(tbody).toHaveAttribute("aria-busy", "true");
    expect(tbody?.querySelectorAll("tr")).toHaveLength(4);

    rerender(
      <DataTable
        caption="Empty"
        columns={columns}
        emptyMessage="No providers"
        getRowKey={(row) => row.id}
        rows={[]}
      />,
    );
    expect(screen.getByText("No providers")).toBeVisible();
  });

  it("moves row actions into an accessible menu", async () => {
    const user = userEvent.setup();
    const remove = vi.fn();
    render(
      <MobileRowActionMenu
        actions={[
          {
            destructive: true,
            icon: <Icon icon={Trash2} />,
            id: "remove",
            label: "Remove",
            onAction: remove,
          },
        ]}
        label="Actions for Alpha"
        row={rows[1]}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Actions for Alpha" }));
    await user.click(await screen.findByRole("menuitem", { name: "Remove" }));
    expect(remove).toHaveBeenCalledWith(rows[1]);
  });

  it("handles cursor and load-more actions and disabled states", async () => {
    const user = userEvent.setup();
    const previous = vi.fn();
    const next = vi.fn();
    const more = vi.fn();
    render(
      <div>
        <CursorPagination
          hasNextPage
          hasPreviousPage={false}
          onNextPage={next}
          onPreviousPage={previous}
          rangeLabel="1–20"
        />
        <LoadMore onLoadMore={more} remainingLabel="20 remaining" />
      </div>,
    );
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("button", { name: "Load more" }));
    expect(next).toHaveBeenCalledOnce();
    expect(more).toHaveBeenCalledOnce();
    expect(previous).not.toHaveBeenCalled();
  });

  it("sorts dates, booleans, and null values with stable fallbacks", async () => {
    const user = userEvent.setup();
    const typedRows = [
      { active: false, at: new Date("2026-01-02"), id: "two", score: null },
      { active: true, at: new Date("2026-01-01"), id: "one", score: 10 },
      { active: true, at: new Date("2026-01-01"), id: "three", score: 10 },
    ] as const;
    const typedColumns = [
      { header: "ID", id: "id", render: (row: (typeof typedRows)[number]) => row.id },
      {
        header: "Active",
        id: "active",
        render: (row: (typeof typedRows)[number]) => String(row.active),
        sortable: true,
        sortValue: (row: (typeof typedRows)[number]) => row.active,
      },
      {
        header: "Date",
        id: "at",
        render: (row: (typeof typedRows)[number]) => row.at.toISOString(),
        sortable: true,
        sortValue: (row: (typeof typedRows)[number]) => row.at,
      },
      {
        header: "Score",
        id: "score",
        render: (row: (typeof typedRows)[number]) => row.score ?? "none",
        sortable: true,
        sortValue: (row: (typeof typedRows)[number]) => row.score,
      },
      {
        header: "Missing accessor",
        id: "missing",
        render: () => "—",
        sortable: true,
      },
    ] as const;
    const { rerender } = render(
      <DataTable
        caption="Typed sorting"
        columns={typedColumns}
        defaultSort={{ columnId: "active", direction: "ascending" }}
        getRowKey={(row) => row.id}
        rows={typedRows}
      />,
    );
    await user.click(screen.getByRole("button", { name: /Date/ }));
    expect(screen.getByRole("columnheader", { name: /Date/ })).toHaveAttribute(
      "aria-sort",
      "ascending",
    );
    await user.click(screen.getByRole("button", { name: /Score/ }));
    expect(screen.getAllByRole("row")[1]).toHaveTextContent("one");
    await user.click(screen.getByRole("button", { name: /Missing accessor/ }));

    rerender(
      <DataTable
        caption="Unknown sort"
        columns={typedColumns}
        defaultSort={{ columnId: "unknown", direction: "ascending" }}
        getRowKey={(row) => row.id}
        rows={typedRows}
      />,
    );
    expect(screen.getAllByRole("row")[1]).toHaveTextContent("two");
  });

  it("covers loading pagination and disabled row-action variants", () => {
    render(
      <div>
        <CursorPagination
          hasNextPage={false}
          hasPreviousPage
          loading
          onNextPage={vi.fn()}
          onPreviousPage={vi.fn()}
        />
        <LoadMore disabled loading onLoadMore={vi.fn()} />
        <DataTable
          actions={[{ disabled: true, id: "locked", label: "Locked", onAction: vi.fn() }]}
          caption="Disabled actions"
          columns={columns}
          getRowKey={(row) => row.id}
          rows={rows.slice(0, 1)}
        />
      </div>,
    );
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Loading" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Load more" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Locked" })).toBeDisabled();
  });
});

describe("feedback and layout", () => {
  it("dismisses alerts and honors controlled visibility", async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    const { rerender } = render(
      <DismissibleAlert onDismiss={onDismiss} title="Delayed" tone="warning">
        Last packet is stale.
      </DismissibleAlert>,
    );
    await user.click(screen.getByRole("button", { name: "Dismiss Delayed" }));
    expect(onDismiss).toHaveBeenCalledOnce();
    expect(screen.queryByText("Last packet is stale.")).not.toBeInTheDocument();

    rerender(
      <DismissibleAlert title="Controlled" visible>
        Parent owns visibility.
      </DismissibleAlert>,
    );
    await user.click(screen.getByRole("button", { name: "Dismiss Controlled" }));
    expect(screen.getByText("Parent owns visibility.")).toBeVisible();
  });

  it("auto-dismisses transient toasts", () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    render(
      <DismissibleToast duration={500} onDismiss={onDismiss} title="Saved" tone="success">
        Provider updated.
      </DismissibleToast>,
    );
    expect(screen.getByRole("status")).toBeVisible();
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(screen.queryByText("Provider updated.")).not.toBeInTheDocument();
    expect(onDismiss).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });

  it("renders page and section hierarchy plus labelled toolbars", () => {
    render(
      <div>
        <PageHeader
          actions={<Button>Export</Button>}
          breadcrumb="Operations / Providers"
          description="Provider reliability"
          eyebrow="Operations"
          meta="Updated now"
          title="Provider health"
        />
        <SectionHeader
          description="Canonical source"
          level={3}
          meta="4 records"
          title="Schedule API"
        />
        <Toolbar label="Provider controls" secondary={<button>Reset</button>} sticky>
          <button>Filter</button>
        </Toolbar>
      </div>,
    );
    expect(screen.getByRole("heading", { level: 1, name: "Provider health" })).toBeVisible();
    expect(screen.getByRole("heading", { level: 3, name: "Schedule API" })).toBeVisible();
    expect(screen.getByRole("toolbar", { name: "Provider controls" })).toHaveAttribute(
      "aria-orientation",
      "horizontal",
    );
  });

  it("collapses and keyboard-resizes split panels", async () => {
    const user = userEvent.setup();
    const onSize = vi.fn();
    const onCollapse = vi.fn();
    render(
      <SplitPanel
        aside="Inspector"
        asideLabel="Record inspector"
        mainLabel="Records"
        onAsideSizeChange={onSize}
        onCollapsedChange={onCollapse}
      >
        Table
      </SplitPanel>,
    );
    const separator = screen.getByRole("separator", { name: "Resize Record inspector" });
    await user.click(separator);
    await user.keyboard("{ArrowLeft}");
    expect(onSize).toHaveBeenCalledWith(336);
    await user.keyboard("{Home}");
    expect(onSize).toHaveBeenLastCalledWith(240);
    await user.click(screen.getByRole("button", { name: "Collapse Record inspector" }));
    expect(onCollapse).toHaveBeenCalledWith(true);
    expect(screen.queryByText("Inspector")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Open Record inspector" }));
    expect(screen.getByText("Inspector")).toBeVisible();
  });

  it("covers minimal headers, vertical toolbars, and left controlled split panels", async () => {
    const user = userEvent.setup();
    const onSize = vi.fn();
    render(
      <div>
        <PageHeader title="Minimal page" />
        <SectionHeader actions="Action" eyebrow="Detail" title="Complete section" />
        <Toolbar label="Vertical controls" orientation="vertical">
          Control
        </Toolbar>
        <SplitPanel
          aside="Left inspector"
          asideLabel="Left inspector"
          asidePosition="left"
          asideSize={300}
          collapsible={false}
          mainLabel="Main"
          onAsideSizeChange={onSize}
        >
          Main content
        </SplitPanel>
      </div>,
    );
    expect(screen.getByRole("heading", { name: "Minimal page" })).toBeVisible();
    expect(screen.getByRole("toolbar", { name: "Vertical controls" })).toHaveAttribute(
      "aria-orientation",
      "vertical",
    );
    expect(
      screen.queryByRole("button", { name: /Collapse Left inspector/ }),
    ).not.toBeInTheDocument();
    const separator = screen.getByRole("separator", { name: "Resize Left inspector" });
    separator.focus();
    await user.keyboard("{ArrowRight}");
    expect(onSize).toHaveBeenLastCalledWith(316);
    await user.keyboard("{End}");
    expect(onSize).toHaveBeenLastCalledWith(520);
  });

  it("renders hidden and high-priority feedback variants", () => {
    render(
      <div>
        <DismissibleAlert action="Reconnect" title="Outage" tone="danger">
          Provider failed.
        </DismissibleAlert>
        <DismissibleAlert title="Hidden" visible={false}>
          Not rendered
        </DismissibleAlert>
        <DismissibleToast action="Details" duration={0} title="Persistent danger" tone="danger">
          Requires attention.
        </DismissibleToast>
        <DismissibleToast title="Hidden toast" visible={false}>
          Not rendered either
        </DismissibleToast>
      </div>,
    );
    expect(screen.getAllByRole("alert")).toHaveLength(2);
    expect(screen.queryByText("Not rendered")).not.toBeInTheDocument();
    expect(screen.queryByText("Not rendered either")).not.toBeInTheDocument();
  });
});

const navigationItems = [
  { href: "/overview", icon: <Icon icon={Gauge} />, label: "Overview" },
  { href: "/providers", icon: <Icon icon={Database} />, label: "Providers", meta: "2" },
  { href: "/schedule", icon: <Icon icon={CalendarDays} />, label: "Schedule" },
  { href: "/settings", icon: <Icon icon={Settings} />, label: "Settings" },
] as const;

describe("responsive navigation", () => {
  it("marks the current collapsed-navigation destination and expands", async () => {
    const user = userEvent.setup();
    const expand = vi.fn();
    render(
      <CollapsedNavigation currentHref="/providers" items={navigationItems} onExpand={expand} />,
    );
    expect(screen.getByRole("link", { name: "Providers" })).toHaveAttribute("aria-current", "page");
    await user.click(screen.getByRole("button", { name: "Expand navigation" }));
    expect(expand).toHaveBeenCalledOnce();
  });

  it("uses an overflow menu for mobile destinations", async () => {
    const user = userEvent.setup();
    const navigate = vi.fn();
    render(
      <MobileNavigation
        currentHref="/overview"
        items={navigationItems}
        maxVisible={2}
        onNavigate={navigate}
      />,
    );
    expect(screen.getByRole("link", { name: "Overview" })).toHaveAttribute("aria-current", "page");
    const providers = screen.getByRole("link", { name: /Providers/ });
    const providerVisual = providers.querySelector(".np-mobile-navigation__visual");
    expect(providerVisual).not.toBeNull();
    expect(within(providerVisual as HTMLElement).getByText("2")).toHaveClass(
      "np-mobile-navigation__meta",
    );
    await user.click(screen.getByRole("button", { name: "More navigation" }));
    await user.click(await screen.findByRole("menuitem", { name: "Settings" }));
    expect(navigate).toHaveBeenCalledWith("/settings");
  });

  it("switches mobile administration sections", async () => {
    const user = userEvent.setup();
    const navigate = vi.fn();
    render(
      <MobileAdminNavigation
        currentHref="/providers"
        items={navigationItems}
        onNavigate={navigate}
      />,
    );
    await user.click(screen.getByRole("button", { name: /Providers/ }));
    await user.click(await screen.findByRole("menuitemradio", { name: "Schedule" }));
    expect(navigate).toHaveBeenCalledWith("/schedule");
  });

  it("keeps overflow mobile navigation functional without a client router callback", async () => {
    const user = userEvent.setup();
    render(<MobileNavigation currentHref="/overview" items={navigationItems} maxVisible={2} />);
    await user.click(screen.getByRole("button", { name: "More navigation" }));
    const settings = await screen.findByRole("menuitem", { name: "Settings" });
    expect(settings).toHaveAttribute("href", "/settings");
  });

  it("moves an overflow selection into the roving tab set and supports arrow keys", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <OverflowTabs
        defaultSelectedId="overview"
        items={[
          { id: "overview", label: "Overview" },
          { id: "runs", label: "Runs" },
          { id: "records", label: "Records" },
          { id: "history", label: "History" },
        ]}
        label="Views"
        onSelectionChange={onChange}
        visibleCount={2}
      />,
    );
    const overview = screen.getByRole("tab", { name: "Overview" });
    expect(overview).toHaveAttribute("tabindex", "0");
    overview.focus();
    await user.keyboard("{ArrowRight}");
    expect(onChange).toHaveBeenCalledWith("runs");

    await user.click(screen.getByRole("button", { name: "More tabs" }));
    await user.click(await screen.findByRole("menuitemradio", { name: "History" }));
    expect(screen.getByRole("tab", { name: "History" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "History" })).toHaveAttribute("tabindex", "0");
  });

  it("covers icon fallbacks, overflow-current state, and link-based admin navigation", async () => {
    const user = userEvent.setup();
    const navigate = vi.fn();
    const bareItems = [
      { href: "/one", label: "One" },
      { href: "/two", label: "Two" },
      { href: "/three", label: "Three" },
    ] as const;
    render(
      <div>
        <CollapsedNavigation currentHref="/one" items={bareItems} />
        <MobileNavigation
          currentHref="/three"
          items={bareItems}
          maxVisible={2}
          onNavigate={navigate}
        />
        <MobileAdminNavigation currentHref="/missing" items={bareItems} />
      </div>,
    );
    expect(screen.queryByRole("button", { name: "Expand navigation" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "More navigation" })).toHaveAttribute(
      "data-current",
      "true",
    );
    await user.click(screen.getByRole("button", { name: "Choose section" }));
    const destination = await screen.findByRole("menuitemradio", { name: "Two" });
    expect(destination).toHaveAttribute("href", "/two");
  });

  it("handles controlled, disabled, and no-overflow tab states", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { rerender } = render(
      <OverflowTabs
        items={[
          { disabled: true, id: "disabled", label: "Disabled" },
          { id: "active", label: "Active", panelId: "active-panel" },
          { id: "last", label: "Last" },
        ]}
        label="Controlled views"
        onSelectionChange={onChange}
        selectedId="active"
        visibleCount={3}
      />,
    );
    expect(screen.queryByRole("button", { name: "More tabs" })).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Active" })).toHaveAttribute(
      "aria-controls",
      "active-panel",
    );
    const active = screen.getByRole("tab", { name: "Active" });
    active.focus();
    await user.keyboard("{ArrowLeft}");
    await user.keyboard("{Home}");
    await user.keyboard("{End}");
    expect(onChange).toHaveBeenCalledWith("last");

    rerender(<OverflowTabs items={[]} label="Empty views" />);
    expect(screen.getByRole("tablist", { name: "Empty views" })).toBeEmptyDOMElement();
  });
});

describe("advanced core accessibility", () => {
  it("has no serious or critical axe violations in the composed operating surface", async () => {
    render(
      <main>
        <PageHeader description="Canonical data sources" title="Providers" />
        <MultiSelect
          defaultSelectedValues={["lck"]}
          label="Regions"
          options={[
            { label: "LCK", value: "lck" },
            { label: "LPL", value: "lpl" },
          ]}
        />
        <FileUpload label="Evidence" />
        <DataTable
          caption="Providers"
          columns={columns}
          getRowKey={(row) => row.id}
          getRowLabel={(row) => row.name}
          rows={rows}
          selectable
        />
      </main>,
    );
    const results = await axe.run(document.body, {
      resultTypes: ["violations"],
      rules: { "color-contrast": { enabled: false } },
    });
    expect(
      results.violations.filter(
        (violation) => violation.impact === "serious" || violation.impact === "critical",
      ),
    ).toEqual([]);
  });
});
