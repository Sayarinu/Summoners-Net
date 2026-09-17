import {
  Activity,
  CalendarDays,
  Database,
  Radio as RadioIcon,
  Settings,
  Trash2,
} from "lucide-react";
import type { ReactNode } from "react";
import type { Meta } from "@storybook/react-vite";

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
} from "./core-advanced.js";
import { SearchInput } from "./forms.js";
import { Icon } from "./internal.js";
import { Breadcrumb } from "./navigation.js";
import { Button, MetaText, StatusIndicator } from "./primitives.js";
import "./core-advanced.css";
import "./review.stories.css";

const noop = () => undefined;
interface ProviderRow {
  readonly latency: number;
  readonly name: string;
  readonly state: "degraded" | "healthy";
}
const rows: readonly ProviderRow[] = [
  { latency: 184, name: "Canonical schedule", state: "healthy" },
  { latency: 486, name: "Live telemetry", state: "degraded" },
];
const columns = [
  {
    header: "Provider",
    id: "name",
    render: (row: ProviderRow) => <strong>{row.name}</strong>,
    sortable: true,
    sortValue: (row: ProviderRow) => row.name,
  },
  {
    header: "State",
    id: "state",
    render: (row: ProviderRow) => (
      <StatusIndicator label={row.state} tone={row.state === "healthy" ? "success" : "warning"} />
    ),
  },
  {
    align: "end" as const,
    header: "P95 latency",
    id: "latency",
    render: (row: ProviderRow) => <span className="np-mono">{row.latency}ms</span>,
    sortable: true,
    sortValue: (row: ProviderRow) => row.latency,
  },
] as const;
const actions = [
  { id: "inspect", label: "Inspect", onAction: noop },
  {
    destructive: true,
    icon: <Icon icon={Trash2} size="small" />,
    id: "remove",
    label: "Remove",
    onAction: noop,
  },
] as const;
const navItems = [
  { href: "/live", icon: <Icon icon={RadioIcon} size="small" />, label: "Live", meta: "2" },
  { href: "/schedule", icon: <Icon icon={CalendarDays} size="small" />, label: "Schedule" },
  { href: "/providers", icon: <Icon icon={Database} size="small" />, label: "Providers" },
  { href: "/settings", icon: <Icon icon={Settings} size="small" />, label: "Settings" },
  { href: "/runs", icon: <Icon icon={Activity} size="small" />, label: "Runs" },
] as const;

function ReviewStage({
  children,
  width = 900,
}: {
  readonly children: ReactNode;
  readonly width?: number;
}) {
  return (
    <main className="np-review">
      <div className="np-review__inner">
        <div className="np-review__stage" style={{ maxWidth: width }}>
          {children}
        </div>
      </div>
    </main>
  );
}
const meta = {
  parameters: { layout: "fullscreen" },
  title: "Component Inventory/03 Advanced Core",
} satisfies Meta;
export default meta;
interface ReviewStory {
  readonly name: string;
  readonly render: () => ReactNode;
}
// Inventory invariant: the first argument names exactly one public rendered export.
const review = (name: string, node: ReactNode, width?: number): ReviewStory => ({
  name,
  render: () => <ReviewStage {...(width === undefined ? {} : { width })}>{node}</ReviewStage>,
});

export const RadioReview = review(
  "Radio",
  <Radio
    defaultChecked
    description="Trust the highest-ranked healthy source."
    name="resolution"
    value="canonical"
  >
    Canonical provider
  </Radio>,
);
export const AdvancedCheckboxReview = review(
  "AdvancedCheckbox",
  <AdvancedCheckbox defaultSelected description="Required for the public schedule.">
    Official matches
  </AdvancedCheckbox>,
);
export const FieldsetReview = review(
  "Fieldset",
  <Fieldset description="Only one provider can publish." legend="Conflict resolution" required>
    <Radio defaultChecked name="catalog-resolution" value="canonical">
      Canonical provider
    </Radio>
    <Radio name="catalog-resolution" value="manual">
      Manual review
    </Radio>
  </Fieldset>,
);
export const FormSectionReview = review(
  "FormSection",
  <FormSection
    actions={<Button size="small">Test Credentials</Button>}
    description="Credentials remain masked by default."
    title="Provider authentication"
  >
    <SecretInput defaultValue="np_live_example" label="API secret" onCopy={noop} />
  </FormSection>,
);
export const FormErrorSummaryReview = review(
  "FormErrorSummary",
  <FormErrorSummary
    errors={[
      { fieldId: "provider-secret", message: "Replace the expired provider secret" },
      { fieldId: "effective-at", message: "Choose an effective time" },
    ]}
  />,
);
export const SecretInputReview = review(
  "SecretInput",
  <SecretInput
    description="Last rotated 84 days ago."
    label="API secret"
    defaultValue="np_live_example"
    onCopy={noop}
  />,
);
export const NumberInputReview = review(
  "NumberInput",
  <NumberInput
    defaultValue={80}
    description="Higher values win canonical conflicts."
    label="Provider priority"
    max={100}
    min={0}
  />,
);
export const DateTimeInputReview = review(
  "DateTimeInput",
  <DateTimeInput
    defaultValue="2026-07-11T20:00"
    description="The change is audited in UTC."
    label="Effective at"
    timezone="America/New_York"
  />,
);
export const TimezoneSelectReview = review(
  "TimezoneSelect",
  <TimezoneSelect
    defaultValue="America/New_York"
    description="Used for operator-facing timestamps."
  />,
);
export const MultiSelectReview = review(
  "MultiSelect",
  <MultiSelect
    defaultSelectedValues={["lck", "international"]}
    description="Controls ingestion and public discovery scope."
    label="Enabled competitions"
    options={[
      { description: "Korea", label: "LCK", value: "lck" },
      { description: "China", label: "LPL", value: "lpl" },
      {
        description: "First Stand, MSI, and Worlds",
        label: "International",
        value: "international",
      },
    ]}
  />,
);
export const FileUploadReview = review(
  "FileUpload",
  <FileUpload
    accept=".json,.csv,.png"
    description="Attach provider responses or screenshots."
    label="Supporting evidence"
    maxSizeBytes={10485760}
    multiple
  />,
);
export const MobileRowActionMenuReview = review(
  "MobileRowActionMenu",
  <MobileRowActionMenu actions={actions} label="Actions for Canonical schedule" row={rows[0]!} />,
);
export const DataTableReview = review(
  "DataTable",
  <DataTable
    actions={actions}
    caption="Provider reliability"
    columns={columns}
    compact
    defaultSort={{ columnId: "latency", direction: "ascending" }}
    getRowKey={(row) => row.name}
    getRowLabel={(row) => row.name}
    rows={rows}
    selectable
    stickyHeader
  />,
  1100,
);
export const CursorPaginationReview = review(
  "CursorPagination",
  <CursorPagination
    hasNextPage
    hasPreviousPage
    onNextPage={noop}
    onPreviousPage={noop}
    rangeLabel="Events 41–60"
  />,
);
export const LoadMoreReview = review(
  "LoadMore",
  <LoadMore onLoadMore={noop} remainingLabel="28 more audit events" />,
);
export const DismissibleAlertReview = review(
  "DismissibleAlert",
  <DismissibleAlert
    action={<Button size="compact">Retry Sync</Button>}
    title="Live telemetry is delayed"
    tone="warning"
  >
    The most recent provider packet is 74 seconds old.
  </DismissibleAlert>,
);
export const DismissibleToastReview = review(
  "DismissibleToast",
  <DismissibleToast
    action={
      <Button size="compact" variant="ghost">
        Undo
      </Button>
    }
    title="Correction published"
    tone="success"
  >
    Match 0194 now uses the canonical record.
  </DismissibleToast>,
);
export const PageHeaderReview = review(
  "PageHeader",
  <PageHeader
    actions={<Button variant="primary">Add Provider</Button>}
    breadcrumb={
      <Breadcrumb items={[{ href: "/operations", label: "Operations" }, { label: "Providers" }]} />
    }
    description="Monitor source reliability and decide which records reach the public product."
    eyebrow="Operations"
    meta={<span>4 configured · Updated 12 seconds ago</span>}
    title="Provider health"
  />,
  1100,
);
export const SectionHeaderReview = review(
  "SectionHeader",
  <SectionHeader
    actions={
      <Button size="small" variant="ghost">
        View History
      </Button>
    }
    description="Tier-1 schedule and tournament metadata."
    eyebrow="Canonical source"
    meta={<StatusIndicator label="healthy" tone="success" />}
    title="Schedule API"
  />,
);
export const ToolbarReview = review(
  "Toolbar",
  <Toolbar
    label="Provider controls"
    secondary={
      <Button size="compact" variant="primary">
        Apply
      </Button>
    }
  >
    <SearchInput label="Search providers" placeholder="Search" />
    <Button size="compact">Filter</Button>
  </Toolbar>,
  1100,
);
export const SplitPanelReview = review(
  "SplitPanel",
  <SplitPanel
    aside={
      <div className="np-review__stack">
        <strong>Record inspector</strong>
        <p>Compare provider values before publishing.</p>
        <Button size="small" variant="primary">
          Approve
        </Button>
      </div>
    }
    asideLabel="Record inspector"
    mainLabel="Provider records"
  >
    <DataTable
      caption="Record differences"
      columns={columns}
      getRowKey={(row) => row.name}
      rows={rows}
    />
  </SplitPanel>,
  1100,
);
export const CollapsedNavigationReview = review(
  "CollapsedNavigation",
  <CollapsedNavigation currentHref="/live" items={navItems} onExpand={noop} />,
  180,
);
export const MobileNavigationReview = review(
  "MobileNavigation",
  <MobileNavigation currentHref="/live" items={navItems} maxVisible={4} />,
  520,
);
export const MobileAdminNavigationReview = review(
  "MobileAdminNavigation",
  <MobileAdminNavigation currentHref="/providers" items={navItems} onNavigate={noop} />,
  520,
);
export const OverflowTabsReview = review(
  "OverflowTabs",
  <OverflowTabs
    defaultSelectedId="overview"
    items={[
      { id: "overview", label: "Overview" },
      { id: "runs", label: "Runs", meta: <MetaText>8</MetaText> },
      { id: "records", label: "Records" },
      { id: "credentials", label: "Credentials" },
      { id: "mapping", label: "Field mapping" },
      { id: "history", label: "Change history" },
    ]}
    label="Provider views"
    visibleCount={4}
  />,
);
