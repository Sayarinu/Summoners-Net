import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { EmptyState, ErrorState, Skeleton, StatePanel, Table } from "./data-display.js";

import { Button } from "./primitives.js";

describe("feedback and data display", () => {
  it("renders skeleton and state panel variations", async () => {
    const user = userEvent.setup();
    const retry = vi.fn();
    const { container } = render(
      <div>
        <Skeleton height={12} radius="full" width="50%" />
        <StatePanel action={<Button>Act</Button>} compact title="Notice" tone="warning">
          Details
        </StatePanel>
        <EmptyState action={<Button>Create</Button>} description="No records" />
        <ErrorState description="Provider failed" onRetry={retry} title="Failed" />
      </div>,
    );
    expect(container.querySelector(".np-skeleton")).toHaveAttribute("aria-hidden", "true");
    expect(container.querySelector(".np-state-panel__icon")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Notice" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Nothing here yet" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(retry).toHaveBeenCalledOnce();
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
});
