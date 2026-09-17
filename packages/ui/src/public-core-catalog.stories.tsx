import { Bell, Calendar, Search, Settings } from "lucide-react";
import type { ReactNode } from "react";
import type { Meta } from "@storybook/react-vite";

import {
  EmptyState,
  ErrorState,
  Skeleton,
  Sparkline,
  StaleState,
  StatePanel,
  StatBlock,
  StatTable,
  Table,
  TrendChartShell,
} from "./data-display.js";
import {
  Checkbox,
  Combobox,
  Field,
  Input,
  RadioGroup,
  SearchInput,
  Select,
  Switch,
  Textarea,
} from "./forms.js";
import { Avatar, Icon, Progress, Separator, Spinner, VisuallyHidden } from "./internal.js";
import {
  Breadcrumb,
  Footer,
  Header,
  Menu,
  Navigation,
  Pagination,
  SegmentedControl,
  Tabs,
} from "./navigation.js";
import {
  AdminNavigation,
  AdminShell,
  ApprovalDialog,
  AuditEventRow,
  DataFreshnessBanner,
  DestructiveActionDialog,
  IncidentSummary,
  IngestionRunRow,
  OperationTimeline,
  ProviderHealth,
} from "./operations.js";
import { Dialog, Drawer, Popover, Tooltip } from "./overlays.js";
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
import "./review.stories.css";

const noop = () => undefined;

function ReviewStage({
  children,
  width = 760,
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

const options = [
  { description: "League of Legends Champions Korea", label: "LCK", value: "lck" },
  { description: "League of Legends EMEA Championship", label: "LEC", value: "lec" },
] as const;

const navigationItems = [
  { href: "/schedule", icon: <Icon icon={Calendar} size="small" />, label: "Schedule" },
  { href: "/teams", icon: <Icon icon={Search} size="small" />, label: "Teams" },
] as const;

const tableRows = [
  { id: "t1", name: "T1", record: "8–2" },
  { id: "geng", name: "Gen.G", record: "9–1" },
] as const;

const meta = {
  parameters: { layout: "fullscreen" },
  title: "Component Inventory/01 V1 Core",
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

// Internal visual utilities
export const IconReview = review("Icon", <Icon icon={Bell} label="Notifications" />);
export const VisuallyHiddenReview = review(
  "VisuallyHidden",
  <Button>
    <VisuallyHidden>Open </VisuallyHidden>Details
  </Button>,
);
export const AvatarReview = review("Avatar", <Avatar alt="T1" fallback="T1" size="large" />);
export const SeparatorReview = review(
  "Separator",
  <div>
    Schedule
    <Separator />
    Live matches
  </div>,
);
export const SpinnerReview = review("Spinner", <Spinner label="Loading schedule" />);
export const ProgressReview = review(
  "Progress",
  <Progress label="Ingestion progress" value={72} />,
);

// Support
export const BrandMarkReview = review("BrandMark", <BrandMark />);
export const SkipLinkReview = review("SkipLink", <SkipLink />);
export const EntityImageReview = review(
  "EntityImage",
  <EntityImage alt="Gen.G" fallback="GEN" rightsState="restricted" size="large" />,
);
export const ChipReview = review(
  "Chip",
  <div className="np-review__row">
    <Chip selected>Tier 1</Chip>
    <Chip label="LCK" onRemove={noop}>
      LCK
    </Chip>
  </div>,
);
export const DisclosureReview = review(
  "Disclosure",
  <Disclosure defaultExpanded summary="Provider diagnostics">
    Last verified response: 200 OK · 18 seconds ago.
  </Disclosure>,
);
export const DateTimeReview = review(
  "DateTime",
  <DateTime dateTime="2026-07-11T20:00:00-04:00" relative="Today at 20:00 EDT" />,
);
export const CopyButtonReview = review("CopyButton", <CopyButton value="match_7F2A19" />);
export const ToastRegionReview = review(
  "ToastRegion",
  <ToastRegion>
    <Toast title="Schedule synchronized" tone="success">
      36 matches updated.
    </Toast>
  </ToastRegion>,
);
export const SelectionMarkReview = review(
  "SelectionMark",
  <div className="np-review__row">
    <SelectionMark selected />
    <SelectionMark selected={false} />
  </div>,
);

// Primitives
export const ButtonReview = review(
  "Button",
  <div className="np-review__row">
    <Button variant="primary">Watch Live</Button>
    <Button>Details</Button>
    <Button variant="ghost">Dismiss</Button>
    <Button variant="danger">Delete</Button>
  </div>,
);
export const IconButtonReview = review(
  "IconButton",
  <IconButton icon={<Icon icon={Settings} />} label="Settings" />,
);
export const TextLinkReview = review(
  "TextLink",
  <TextLink href="#" variant="accent">
    Official source
  </TextLink>,
);
export const MetaTextReview = review(
  "MetaText",
  <div className="np-review__row">
    <MetaText tone="accent">Tier 1</MetaText>
    <MetaText tone="success">Verified</MetaText>
    <MetaText tone="warning">Delayed</MetaText>
  </div>,
);
export const StatusIndicatorReview = review(
  "StatusIndicator",
  <div className="np-review__row">
    <StatusIndicator label="Healthy" tone="success" />
    <StatusIndicator label="Delayed" tone="warning" />
  </div>,
);
export const LiveIndicatorReview = review("LiveIndicator", <LiveIndicator label="Live · Game 2" />);
export const CalloutReview = review(
  "Callout",
  <Callout actions={<Button size="small">Inspect</Button>} title="Provider delayed" tone="warning">
    Live telemetry is 42 seconds behind target.
  </Callout>,
);
export const ToastReview = review(
  "Toast",
  <Toast action={<Button size="compact">View</Button>} title="Import completed" tone="success">
    The event roster is ready.
  </Toast>,
);

// Forms
export const FieldReview = review(
  "Field",
  <Field description="Shown publicly." htmlFor="catalog-field" label="Display name">
    <input className="np-input-shell" id="catalog-field" defaultValue="Gen.G" />
  </Field>,
);
export const InputReview = review(
  "Input",
  <Input description="Shown on the team page." label="Display name" defaultValue="Gen.G" />,
);
export const SearchInputReview = review(
  "SearchInput",
  <SearchInput
    label="Search teams, players, events, and matches"
    onClear={noop}
    value="Gen.G"
    readOnly
  />,
);
export const TextareaReview = review(
  "Textarea",
  <Textarea
    description="Visible to operators."
    label="Correction note"
    defaultValue="Official roster feed confirmed the substitution."
  />,
);
export const SelectReview = review(
  "Select",
  <Select defaultValue="lck" label="Primary region" options={options} />,
);
export const ComboboxReview = review("Combobox", <Combobox label="Add region" options={options} />);
export const CheckboxReview = review(
  "Checkbox",
  <Checkbox defaultSelected>Include showmatches</Checkbox>,
);
export const RadioGroupReview = review(
  "RadioGroup",
  <RadioGroup
    defaultValue="official"
    label="Canonical source"
    options={[
      { label: "Official feed", value: "official" },
      { label: "Organizer", value: "organizer" },
    ]}
  />,
);
export const SwitchReview = review(
  "Switch",
  <Switch defaultSelected>Hide match-result spoilers</Switch>,
);

// Navigation
export const TabsReview = review(
  "Tabs",
  <Tabs
    defaultSelectedKey="overview"
    items={[
      { content: <p>Event summary.</p>, id: "overview", label: "Overview" },
      { content: <p>Complete schedule.</p>, id: "matches", label: "Matches" },
    ]}
    label="Event sections"
  />,
);
export const SegmentedControlReview = review(
  "SegmentedControl",
  <SegmentedControl
    defaultValue="list"
    label="Schedule layout"
    options={[
      { label: "List", value: "list" },
      { label: "Calendar", value: "calendar" },
    ]}
  />,
);
export const BreadcrumbReview = review(
  "Breadcrumb",
  <Breadcrumb
    items={[
      { href: "/events", label: "Events" },
      { href: "/events/worlds", label: "Worlds 2026" },
      { label: "Swiss stage" },
    ]}
  />,
);
export const PaginationReview = review(
  "Pagination",
  <Pagination currentPage={6} onPageChange={noop} totalPages={18} />,
);
export const NavigationReview = review(
  "Navigation",
  <Navigation currentHref="/schedule" items={navigationItems} />,
  300,
);
export const HeaderReview = review(
  "Header",
  <Header
    actions={<Button size="compact">Methodology</Button>}
    brand={<BrandMark />}
    navigation={
      <div className="np-review__row">
        <a href="#">Schedule</a>
        <a href="#">Teams</a>
      </div>
    }
    status={<LiveIndicator label="3 live" />}
  />,
  1100,
);
export const FooterReview = review(
  "Footer",
  <Footer
    links={[
      { href: "#", label: "Privacy" },
      { href: "#", label: "Status" },
    ]}
    status="All systems operational"
  />,
  1100,
);
export const MenuReview = review(
  "Menu",
  <Menu
    items={[
      {
        description: "Open provider configuration.",
        icon: <Icon icon={Settings} size="small" />,
        id: "configure",
        label: "Configure",
      },
      { id: "audit", label: "View audit log" },
    ]}
    onAction={noop}
  />,
);

// Overlays
export const TooltipReview = review(
  "Tooltip",
  <Tooltip content="Provider health details">
    <IconButton icon={<Icon icon={Bell} />} label="Provider health details" />
  </Tooltip>,
);
export const PopoverReview = review(
  "Popover",
  <Popover
    footer={
      <Button size="small" variant="primary">
        Apply
      </Button>
    }
    title="Quick filters"
    trigger={<Button>Open Filters</Button>}
  >
    <div className="np-review__stack">
      <Switch defaultSelected>Tier-1 only</Switch>
      <Switch>Show completed</Switch>
    </div>
  </Popover>,
);
export const DialogReview = review(
  "Dialog",
  <Dialog
    description="Review the proposed canonical value."
    footer={<Button variant="primary">Approve</Button>}
    title="Approve correction"
    trigger={<Button>Open Dialog</Button>}
  >
    <Input label="Proposed value" readOnly value="Gen.G" />
  </Dialog>,
);
export const DrawerReview = review(
  "Drawer",
  <Drawer
    description="Inspect metadata without leaving the schedule."
    footer={<Button>Open Full Match</Button>}
    title="Match quick look"
    trigger={<Button>Open Drawer</Button>}
  >
    <p>Gen.G vs T1 · Best of 3</p>
  </Drawer>,
);

// Data display
export const SkeletonReview = review(
  "Skeleton",
  <div className="np-review__stack">
    <Skeleton height={14} width="72%" />
    <Skeleton height={14} width="48%" />
  </div>,
);
export const StatePanelReview = review(
  "StatePanel",
  <StatePanel
    action={<Button size="small">Review</Button>}
    title="Pending verification"
    tone="warning"
  >
    Two sources disagree on the start time.
  </StatePanel>,
);
export const EmptyStateReview = review(
  "EmptyState",
  <EmptyState
    action={<Button>Clear Filters</Button>}
    description="No Tier-1 matches match the current filters."
    title="No matches found"
  />,
);
export const ErrorStateReview = review(
  "ErrorState",
  <ErrorState description="The schedule provider did not respond." onRetry={noop} />,
);
export const StaleStateReview = review(
  "StaleState",
  <StaleState description="Last verified update was 18 minutes ago." onRefresh={noop} />,
);
export const TableReview = review(
  "Table",
  <Table
    caption="Team records"
    columns={[
      { header: "Team", id: "team", render: (row: (typeof tableRows)[number]) => row.name },
      {
        align: "end",
        header: "Record",
        id: "record",
        render: (row: (typeof tableRows)[number]) => row.record,
      },
    ]}
    getRowKey={(row) => row.id}
    rows={tableRows}
  />,
);
export const StatBlockReview = review(
  "StatBlock",
  <StatBlock
    change="+4.2%"
    changeTone="success"
    detail="vs last 10 games"
    label="Win rate"
    value="68%"
  />,
);
export const StatTableReview = review(
  "StatTable",
  <StatTable
    caption="Player statistics"
    rows={[
      { label: "KDA", value: "4.8" },
      { label: "CS/min", value: "9.3" },
    ]}
  />,
);
export const SparklineReview = review(
  "Sparkline",
  <Sparkline label="Gold differential trend" values={[2, 4, 3, 8, 12, 11, 18]} />,
  420,
);
export const TrendChartShellReview = review(
  "TrendChartShell",
  <TrendChartShell
    description="Last seven matches"
    legend={<span>Gold differential</span>}
    title="Recent form"
  >
    <Sparkline label="Recent form" values={[2, 4, 3, 8, 12, 11, 18]} />
  </TrendChartShell>,
);

// Operations
export const AdminNavigationReview = review(
  "AdminNavigation",
  <AdminNavigation
    currentHref="/admin/providers"
    items={[
      { href: "/admin/providers", label: "Providers" },
      { href: "/admin/runs", label: "Ingestion runs" },
    ]}
  />,
  320,
);
export const AdminShellReview = review(
  "AdminShell",
  <AdminShell
    actions={<Button>New Provider</Button>}
    navigation={
      <AdminNavigation
        currentHref="/admin/providers"
        items={[{ href: "/admin/providers", label: "Providers" }]}
      />
    }
    title="Providers"
  >
    <ProviderHealth name="Official schedule" state="healthy" />
  </AdminShell>,
  1100,
);
export const DataFreshnessBannerReview = review(
  "DataFreshnessBanner",
  <DataFreshnessBanner
    ageLabel="Updated 18 seconds ago"
    lastUpdated="2026-07-11T18:42:12-04:00"
    onRefresh={noop}
    provider="Official schedule"
    state="fresh"
  />,
);
export const ProviderHealthReview = review(
  "ProviderHealth",
  <ProviderHealth
    details={[{ label: "Latency", value: "184 ms" }]}
    lastSuccess="18 seconds ago"
    name="Official schedule"
    onOpen={noop}
    state="healthy"
  />,
);
export const IngestionRunRowReview = review(
  "IngestionRunRow",
  <IngestionRunRow
    id="run_7F2A"
    onCancel={noop}
    onOpen={noop}
    progress={76}
    provider="Official schedule API"
    startedAt="18:58:12"
    state="running"
  />,
  1000,
);
export const OperationTimelineReview = review(
  "OperationTimeline",
  <OperationTimeline
    events={[
      {
        description: "Manual run requested.",
        id: "queued",
        label: "Queued",
        state: "info",
        timestamp: "18:58:12",
      },
      {
        description: "36 matches normalized.",
        id: "complete",
        label: "Normalization complete",
        state: "success",
        timestamp: "18:58:17",
      },
    ]}
  />,
);
export const ApprovalDialogReview = review(
  "ApprovalDialog",
  <ApprovalDialog
    description="Publish this correction to public surfaces?"
    onApprove={noop}
    title="Approve correction"
    trigger={<Button>Open Approval</Button>}
  >
    Start time changes from 20:00 to 20:30 EDT.
  </ApprovalDialog>,
);
export const DestructiveActionDialogReview = review(
  "DestructiveActionDialog",
  <DestructiveActionDialog
    description="This provider will stop ingesting immediately."
    onConfirm={noop}
    title="Remove provider"
    trigger={<Button variant="danger">Remove Provider</Button>}
  >
    Historical audit records will be retained.
  </DestructiveActionDialog>,
);
export const AuditEventRowReview = review(
  "AuditEventRow",
  <AuditEventRow
    action="Published canonical override"
    actor="Carter"
    detail="Start time · 20:00 → 20:30"
    target="match_7F2A"
    timestamp="18:52:07"
  />,
);
export const IncidentSummaryReview = review(
  "IncidentSummary",
  <IncidentSummary
    affected={["Live telemetry", "Draft insights"]}
    id="INC-042"
    severity="major"
    startedAt="18:08 EDT"
    status="monitoring"
    title="Live telemetry delayed"
  >
    Traffic is using the verified fallback.
  </IncidentSummary>,
);
