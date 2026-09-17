import { Info } from "lucide-react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import {
  EmptyState,
  ErrorState,
  Skeleton,
  Sparkline,
  StatBlock,
  StatTable,
  StaleState,
  StatePanel,
  Table,
  TrendChartShell,
} from "./data-display.js";
import { Icon } from "./internal.js";
import { Dialog, Drawer, Popover, Tooltip } from "./overlays.js";
import { Button } from "./primitives.js";

describe("overlays", () => {
  it("shows a tooltip on focus", async () => {
    const user = userEvent.setup();
    render(
      <Tooltip content="Provider details" delay={0} placement="right">
        <Button aria-label="Info">
          <Icon icon={Info} />
        </Button>
      </Tooltip>,
    );
    await user.tab();
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Provider details");
  });

  it("opens and closes a popover", async () => {
    const user = userEvent.setup();
    render(
      <Popover
        footer={<Button>Apply</Button>}
        title="Filters"
        trigger={<Button>Open filters</Button>}
      >
        Filter content
      </Popover>,
    );
    await user.click(screen.getByRole("button", { name: "Open filters" }));
    expect(await screen.findByRole("dialog", { name: "Filters" })).toHaveTextContent(
      "Filter content",
    );
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog", { name: "Filters" })).not.toBeInTheDocument();
  });

  it("renders a popover without an optional footer", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <Popover title="Context" trigger={<Button>Open context</Button>}>
        Provider context
      </Popover>,
    );

    await user.click(screen.getByRole("button", { name: "Open context" }));
    expect(await screen.findByRole("dialog", { name: "Context" })).toHaveTextContent(
      "Provider context",
    );
    expect(container.querySelector(".np-overlay-panel__footer")).not.toBeInTheDocument();
  });

  it("focus-manages dialogs and supports cancel", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(
      <Dialog
        description="Review changes"
        footer={<Button>Approve</Button>}
        onOpenChange={onOpenChange}
        size="large"
        title="Approval"
        trigger={<Button>Open approval</Button>}
      >
        Summary
      </Dialog>,
    );
    await user.click(screen.getByRole("button", { name: "Open approval" }));
    expect(await screen.findByRole("dialog", { name: "Approval" })).toHaveTextContent(
      "Review changes",
    );
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
  });

  it("supports a default-open non-dismissible dialog without optional regions", () => {
    render(
      <Dialog
        defaultOpen
        dismissible={false}
        title="Required review"
        trigger={<Button>Open required review</Button>}
      >
        Review cannot be skipped.
      </Dialog>,
    );

    expect(screen.getByRole("dialog", { name: "Required review" })).toHaveTextContent(
      "Review cannot be skipped.",
    );
    expect(screen.queryByRole("button", { name: "Close dialog" })).not.toBeInTheDocument();
    expect(document.querySelector(".np-dialog--medium")).toBeInTheDocument();
    expect(document.querySelector(".np-dialog__header p")).not.toBeInTheDocument();
    expect(document.querySelector(".np-dialog__footer")).not.toBeInTheDocument();
  });

  it("honors controlled dialog state and reports close requests", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const { rerender } = render(
      <Dialog
        onOpenChange={onOpenChange}
        open
        size="small"
        title="Controlled dialog"
        trigger={<Button>Open controlled dialog</Button>}
      >
        Controlled content
      </Dialog>,
    );

    expect(screen.getByRole("dialog", { name: "Controlled dialog" })).toHaveTextContent(
      "Controlled content",
    );
    await user.click(screen.getByRole("button", { name: "Close dialog" }));
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
    expect(screen.getByRole("dialog", { name: "Controlled dialog" })).toBeInTheDocument();

    rerender(
      <Dialog
        onOpenChange={onOpenChange}
        open={false}
        size="small"
        title="Controlled dialog"
        trigger={<Button>Open controlled dialog</Button>}
      >
        Controlled content
      </Dialog>,
    );
    expect(screen.queryByRole("dialog", { name: "Controlled dialog" })).not.toBeInTheDocument();
  });

  it("supports a triggerless dialog controlled by its parent", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(
      <Dialog onOpenChange={onOpenChange} open title="Route dialog">
        Opened by route state
      </Dialog>,
    );

    expect(screen.getByRole("dialog", { name: "Route dialog" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Close dialog" }));
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
  });

  it("opens a drawer and dismisses it", async () => {
    const user = userEvent.setup();
    render(
      <Drawer
        description="Quick context"
        footer={<Button>Open full page</Button>}
        side="left"
        title="Match"
        trigger={<Button>Open drawer</Button>}
      >
        Drawer content
      </Drawer>,
    );
    await user.click(screen.getByRole("button", { name: "Open drawer" }));
    expect(await screen.findByRole("dialog", { name: "Match" })).toHaveTextContent(
      "Drawer content",
    );
    await user.click(screen.getByRole("button", { name: "Close drawer" }));
    expect(screen.queryByRole("dialog", { name: "Match" })).not.toBeInTheDocument();
  });

  it("supports a default-open drawer without optional regions", () => {
    render(
      <Drawer defaultOpen title="Provider details" trigger={<Button>Open provider details</Button>}>
        Raw provider payload
      </Drawer>,
    );

    expect(screen.getByRole("dialog", { name: "Provider details" })).toHaveTextContent(
      "Raw provider payload",
    );
    expect(document.querySelector(".np-drawer--right")).toBeInTheDocument();
    expect(document.querySelector(".np-drawer__header p")).not.toBeInTheDocument();
    expect(document.querySelector(".np-drawer__footer")).not.toBeInTheDocument();
  });

  it("honors controlled drawer state and reports close requests", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const { rerender } = render(
      <Drawer
        onOpenChange={onOpenChange}
        open
        title="Controlled drawer"
        trigger={<Button>Open controlled drawer</Button>}
      >
        Controlled context
      </Drawer>,
    );

    expect(screen.getByRole("dialog", { name: "Controlled drawer" })).toHaveTextContent(
      "Controlled context",
    );
    await user.click(screen.getByRole("button", { name: "Close drawer" }));
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
    expect(screen.getByRole("dialog", { name: "Controlled drawer" })).toBeInTheDocument();

    rerender(
      <Drawer
        onOpenChange={onOpenChange}
        open={false}
        title="Controlled drawer"
        trigger={<Button>Open controlled drawer</Button>}
      >
        Controlled context
      </Drawer>,
    );
    expect(screen.queryByRole("dialog", { name: "Controlled drawer" })).not.toBeInTheDocument();
  });

  it("supports a triggerless drawer controlled by its parent", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(
      <Drawer onOpenChange={onOpenChange} open title="Route drawer">
        Opened by route state
      </Drawer>,
    );

    expect(screen.getByRole("dialog", { name: "Route drawer" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Close drawer" }));
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
  });
});

describe("feedback and data display", () => {
  it("renders skeleton and state panel variations", async () => {
    const user = userEvent.setup();
    const retry = vi.fn();
    const refresh = vi.fn();
    const { container } = render(
      <div>
        <Skeleton height={12} radius="full" width="50%" />
        <StatePanel action={<Button>Act</Button>} compact title="Notice" tone="warning">
          Details
        </StatePanel>
        <EmptyState action={<Button>Create</Button>} description="No records" />
        <ErrorState description="Provider failed" onRetry={retry} title="Failed" />
        <StaleState description="18m old" onRefresh={refresh} />
      </div>,
    );
    expect(container.querySelector(".np-skeleton")).toHaveAttribute("aria-hidden", "true");
    expect(container.querySelector(".np-state-panel__icon")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Notice" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Nothing here yet" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Retry" }));
    await user.click(screen.getByRole("button", { name: "Refresh" }));
    expect(retry).toHaveBeenCalledOnce();
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("renders populated, loading, and empty table states", () => {
    const columns = [
      { header: "Name", id: "name", render: (row: { name: string; value: number }) => row.name },
      {
        align: "end" as const,
        header: "Value",
        id: "value",
        render: (row: { name: string; value: number }) => row.value,
        width: "80px",
      },
    ];
    const { rerender } = render(
      <Table
        caption="Metrics"
        columns={columns}
        compact
        getRowKey={(row) => row.name}
        rows={[{ name: "Win rate", value: 67 }]}
      />,
    );
    expect(screen.getByRole("table", { name: "Metrics" })).toHaveTextContent("Win rate");
    expect(screen.getByRole("region", { name: "Metrics" })).toHaveAttribute("tabindex", "0");
    rerender(
      <Table
        caption="Loading metrics"
        columns={columns}
        getRowKey={(row) => row.name}
        loading
        rows={[]}
      />,
    );
    const loadingTable = screen.getByRole("table", { name: "Loading metrics" });
    expect(loadingTable.querySelector("tbody")).toHaveAttribute("aria-busy", "true");
    rerender(
      <Table
        caption="Empty metrics"
        columns={columns}
        emptyMessage="No metrics"
        getRowKey={(row) => row.name}
        rows={[]}
      />,
    );
    expect(screen.getByText("No metrics")).toBeVisible();
  });

  it("renders statistic and trend chart primitives", () => {
    render(
      <div>
        <StatBlock
          change="increase 4%"
          changeTone="success"
          detail="18 games"
          label="Win rate"
          value="67%"
        />
        <StatBlock change="decrease 2%" changeTone="danger" label="KDA" value="4.8" />
        <StatTable caption="Summary" rows={[{ label: "First tower", value: "61%" }]} />
        <TrendChartShell
          actions={<Button>Refresh</Button>}
          description="Last eight games"
          legend="Gen.G"
          title="Gold difference"
        >
          <Sparkline label="Gold difference trend" tone={8} values={[1, 2, 4, 3]} />
        </TrendChartShell>
      </div>,
    );
    expect(screen.getByText("67%")).toBeVisible();
    expect(screen.getByRole("table", { name: "Summary" })).toBeVisible();
    expect(screen.getByRole("img", { name: "Gold difference trend" })).toBeVisible();
    expect(screen.getByRole("figure")).toHaveTextContent("Last eight games");
  });
});
