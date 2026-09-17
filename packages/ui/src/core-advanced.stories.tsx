import {
  Activity,
  CalendarDays,
  Database,
  FileCheck2,
  Gauge,
  Globe2,
  LayoutGrid,
  ListFilter,
  Radio as RadioIcon,
  Settings,
  ShieldCheck,
  Trash2,
  Users,
  Wrench,
} from "lucide-react";
import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";

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

function ReviewShell({
  children,
  index,
  title,
}: {
  children: React.ReactNode;
  index: string;
  title: string;
}) {
  return (
    <main className="np-review">
      <div className="np-review__inner">
        <header className="np-review__masthead">
          <div>
            <span className="np-eyebrow">Components / {index}</span>
            <h1>{title}</h1>
          </div>
          <p>
            Production states, keyboard behavior, responsive fallbacks, and analytics hooks for
            dense public and operations workflows.
          </p>
        </header>
        {children}
      </div>
    </main>
  );
}

function Section({
  children,
  description,
  eyebrow,
  title,
}: {
  children: React.ReactNode;
  description?: string;
  eyebrow: string;
  title: string;
}) {
  return (
    <section className="np-review__section">
      <header className="np-review__section-header">
        <span className="np-eyebrow">{eyebrow}</span>
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
      </header>
      <div className="np-review__content">{children}</div>
    </section>
  );
}

function AdvancedFormsGallery() {
  const [selected, setSelected] = useState<readonly string[]>(["lck", "international"]);
  const [secret, setSecret] = useState("np_live_•••••••••••");
  const [priority, setPriority] = useState<number | null>(80);
  const [resolution, setResolution] = useState("canonical");

  return (
    <ReviewShell index="10" title="Advanced forms">
      <Section
        description="Standalone composition for compact forms and partial selection."
        eyebrow="Radio + AdvancedCheckbox"
        title="Selection primitives"
      >
        <div className="np-review__grid">
          <Fieldset
            description="Only one provider can publish the canonical record."
            legend="Conflict resolution"
            required
          >
            <Radio
              checked={resolution === "canonical"}
              description="Trust the highest-ranked healthy source."
              name="resolution"
              onChange={() => setResolution("canonical")}
              value="canonical"
            >
              Canonical provider
            </Radio>
            <Radio
              checked={resolution === "manual"}
              description="Hold the record until an operator decides."
              name="resolution"
              onChange={() => setResolution("manual")}
              value="manual"
            >
              Manual review
            </Radio>
          </Fieldset>
          <Fieldset description="Selection state persists per operator." legend="Visible columns">
            <AdvancedCheckbox defaultSelected description="Always shown in compact mode.">
              Provider
            </AdvancedCheckbox>
            <AdvancedCheckbox indeterminate description="Some child metrics are visible.">
              Reliability metrics
            </AdvancedCheckbox>
            <AdvancedCheckbox disabled description="Required for traceability.">
              Last successful run
            </AdvancedCheckbox>
          </Fieldset>
        </div>
      </Section>

      <Section eyebrow="FormSection" title="Structured settings">
        <FormErrorSummary
          errors={[
            { fieldId: "provider-secret", message: "Replace the expired provider secret" },
            { fieldId: "effective-at", message: "Choose an effective time" },
          ]}
        />
        <FormSection
          actions={<Button size="small">Test Credentials</Button>}
          description="Credentials remain masked by default and never appear in analytics payloads."
          title="Provider authentication"
        >
          <div className="np-review__grid np-review__grid--form">
            <SecretInput
              description="Last rotated 84 days ago."
              id="provider-secret"
              label="API secret"
              onChange={(event) => setSecret(event.currentTarget.value)}
              onCopy={noop}
              value={secret}
            />
            <NumberInput
              description="Higher values win canonical conflicts."
              label="Provider priority"
              max={100}
              min={0}
              onValueChange={setPriority}
              value={priority ?? 0}
            />
            <DateTimeInput
              description="The change is audited in UTC."
              id="effective-at"
              label="Effective at"
              timezone="America/New_York"
            />
            <TimezoneSelect description="Used for operator-facing timestamps." />
          </div>
        </FormSection>
      </Section>

      <Section
        description="Multiple regions remain readable in a compact trigger."
        eyebrow="MultiSelect"
        title="Multi-value selection"
      >
        <MultiSelect
          description="Controls ingestion and public discovery scope."
          label="Enabled competitions"
          onSelectionChange={setSelected}
          options={[
            { description: "Korea", label: "LCK", value: "lck" },
            { description: "China", label: "LPL", value: "lpl" },
            { description: "EMEA", label: "LEC", value: "lec" },
            {
              description: "First Stand, MSI, and Worlds",
              label: "International",
              value: "international",
            },
            { disabled: true, label: "Archived events", value: "archived" },
          ]}
          selectedValues={selected}
        />
      </Section>

      <Section
        description="Drop, browse, validation, queued file state, and removal."
        eyebrow="FileUpload"
        title="Evidence upload"
      >
        <FileUpload
          accept=".json,.csv,.png"
          description="Attach provider responses or screenshots to the incident timeline."
          label="Supporting evidence"
          maxSizeBytes={10 * 1024 * 1024}
          multiple
        />
      </Section>
    </ReviewShell>
  );
}

interface ProviderRow {
  latency: number;
  name: string;
  state: "degraded" | "healthy" | "outage";
  success: number;
}

const providers: readonly ProviderRow[] = [
  { latency: 184, name: "Canonical schedule", state: "healthy", success: 99.99 },
  { latency: 486, name: "Live telemetry", state: "degraded", success: 98.72 },
  { latency: 1280, name: "Roster feed", state: "outage", success: 91.42 },
  { latency: 242, name: "Tournament metadata", state: "healthy", success: 99.94 },
];

const providerColumns = [
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
      <StatusIndicator
        label={row.state}
        tone={row.state === "healthy" ? "success" : row.state === "degraded" ? "warning" : "danger"}
      />
    ),
    sortable: true,
    sortValue: (row: ProviderRow) => row.state,
  },
  {
    align: "end" as const,
    header: "Success",
    id: "success",
    render: (row: ProviderRow) => <span className="np-mono">{row.success.toFixed(2)}%</span>,
    sortable: true,
    sortValue: (row: ProviderRow) => row.success,
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

function DataOperationsGallery() {
  const [selection, setSelection] = useState<readonly string[]>(["Live telemetry"]);
  return (
    <ReviewShell index="11" title="Data operations">
      <Section
        description="Sticky headers, stable local sorting, selection, and row actions that collapse into a menu."
        eyebrow="DataTable"
        title="Provider inventory"
      >
        <DataTable
          actions={[
            { id: "inspect", label: "Inspect", onAction: noop },
            {
              destructive: true,
              icon: <Icon icon={Trash2} size="small" />,
              id: "remove",
              label: "Remove",
              onAction: noop,
            },
          ]}
          caption="Provider reliability"
          columns={providerColumns}
          compact
          defaultSort={{ columnId: "success", direction: "descending" }}
          getRowKey={(row) => row.name}
          getRowLabel={(row) => row.name}
          onSelectionChange={setSelection}
          rows={providers}
          selectable
          selectedKeys={selection}
          stickyHeader
        />
        <CursorPagination
          hasNextPage
          hasPreviousPage={false}
          onNextPage={noop}
          onPreviousPage={noop}
          rangeLabel="Providers 1–4"
        />
      </Section>

      <Section eyebrow="Loading + empty" title="Lifecycle states">
        <div className="np-review__grid np-review__grid--wide">
          <div className="np-review__stage">
            <span className="np-review__label">Loading rows</span>
            <DataTable
              caption="Loading providers"
              columns={providerColumns.slice(0, 3)}
              getRowKey={(row) => row.name}
              loading
              rows={[]}
            />
          </div>
          <div className="np-review__stage">
            <span className="np-review__label">Empty result</span>
            <DataTable
              caption="Filtered providers"
              columns={providerColumns.slice(0, 3)}
              emptyMessage="No providers match these filters"
              getRowKey={(row) => row.name}
              rows={[]}
            />
          </div>
        </div>
      </Section>

      <Section eyebrow="CursorPagination + LoadMore" title="Incremental navigation">
        <div className="np-review__stack">
          <CursorPagination
            hasNextPage
            hasPreviousPage
            onNextPage={noop}
            onPreviousPage={noop}
            rangeLabel="Events 41–60"
          />
          <LoadMore onLoadMore={noop} remainingLabel="28 more audit events" />
          <LoadMore loading onLoadMore={noop} remainingLabel="Fetching match history" />
        </div>
      </Section>
    </ReviewShell>
  );
}

const publicNavigation = [
  { href: "/live", icon: <Icon icon={RadioIcon} size="small" />, label: "Live", meta: "2" },
  { href: "/schedule", icon: <Icon icon={CalendarDays} size="small" />, label: "Schedule" },
  { href: "/events", icon: <Icon icon={Globe2} size="small" />, label: "Events" },
  { href: "/teams", icon: <Icon icon={Users} size="small" />, label: "Teams" },
  { href: "/settings", icon: <Icon icon={Settings} size="small" />, label: "Settings" },
] as const;

const adminNavigation = [
  { href: "/overview", icon: <Icon icon={Gauge} size="small" />, label: "Overview" },
  { href: "/providers", icon: <Icon icon={Database} size="small" />, label: "Providers" },
  {
    href: "/ingestion",
    icon: <Icon icon={Activity} size="small" />,
    label: "Ingestion",
    meta: "3",
  },
  { href: "/audit", icon: <Icon icon={FileCheck2} size="small" />, label: "Audit log" },
  { href: "/settings", icon: <Icon icon={Wrench} size="small" />, label: "Settings" },
] as const;

function LayoutNavigationGallery() {
  const [tab, setTab] = useState("overview");
  const [adminHref, setAdminHref] = useState("/providers");
  return (
    <ReviewShell index="12" title="Layout & navigation">
      <Section eyebrow="PageHeader + SectionHeader" title="Hierarchy">
        <div className="np-review__stage">
          <PageHeader
            actions={
              <>
                <Button>Export</Button>
                <Button variant="primary">Add Provider</Button>
              </>
            }
            breadcrumb={
              <Breadcrumb
                items={[{ href: "/operations", label: "Operations" }, { label: "Providers" }]}
              />
            }
            description="Monitor source reliability and decide which records reach the public product."
            eyebrow="Operations"
            meta={
              <>
                <span>4 configured</span>
                <span>Updated 12 seconds ago</span>
              </>
            }
            title="Provider health"
          />
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
          />
        </div>
      </Section>

      <Section eyebrow="Toolbar + OverflowTabs" title="Dense commands">
        <Toolbar
          label="Provider controls"
          secondary={
            <>
              <Button size="compact" variant="ghost">
                Reset
              </Button>
              <Button size="compact" variant="primary">
                Apply
              </Button>
            </>
          }
        >
          <SearchInput label="Search providers" placeholder="Search" />
          <Button size="compact" startIcon={<Icon icon={ListFilter} size="small" />}>
            Filter
          </Button>
          <Button size="compact" startIcon={<Icon icon={LayoutGrid} size="small" />}>
            Columns
          </Button>
        </Toolbar>
        <OverflowTabs
          items={[
            { id: "overview", label: "Overview" },
            { id: "runs", label: "Runs", meta: <MetaText>8</MetaText> },
            { id: "records", label: "Records" },
            { id: "credentials", label: "Credentials" },
            { id: "mapping", label: "Field mapping" },
            { id: "history", label: "Change history" },
            { disabled: true, id: "advanced", label: "Advanced" },
          ]}
          label="Provider views"
          onSelectionChange={setTab}
          selectedId={tab}
          visibleCount={4}
        />
      </Section>

      <Section eyebrow="SplitPanel" title="Primary surface + inspector">
        <SplitPanel
          aside={
            <div className="np-review__stack">
              <span className="np-eyebrow">Record inspector</span>
              <h3>Match · 0194</h3>
              <p className="np-advanced-demo__muted">
                Compare provider values before publishing the canonical correction.
              </p>
              <AdvancedCheckbox defaultSelected>Publish immediately</AdvancedCheckbox>
              <Button size="small" variant="primary">
                Approve Correction
              </Button>
            </div>
          }
          asideLabel="Record inspector"
          mainLabel="Provider records"
        >
          <SectionHeader
            description="12 fields differ from the canonical record."
            title="Pending reconciliation"
          />
          <DataTable
            caption="Record differences"
            columns={providerColumns.slice(0, 3)}
            getRowKey={(row) => row.name}
            rows={providers.slice(0, 3)}
          />
        </SplitPanel>
      </Section>

      <Section eyebrow="Responsive navigation" title="Collapsed and mobile treatments">
        <div className="np-review__grid np-review__grid--wide">
          <div className="np-review__frame np-advanced-demo__navigation-frame">
            <CollapsedNavigation currentHref="/live" items={publicNavigation} onExpand={noop} />
            <div className="np-advanced-demo__navigation-canvas">
              <span className="np-eyebrow">Collapsed rail</span>
              <strong>More workspace. Same orientation.</strong>
            </div>
          </div>
          <div className="np-review__frame np-advanced-demo__phone-frame">
            <MobileAdminNavigation
              currentHref={adminHref}
              items={adminNavigation}
              onNavigate={setAdminHref}
            />
            <div className="np-advanced-demo__phone-canvas">
              <Icon icon={ShieldCheck} size="large" />
              <strong>Provider workspace</strong>
              <span>Compact administration context</span>
            </div>
            <MobileNavigation currentHref="/live" items={publicNavigation} maxVisible={4} />
          </div>
        </div>
      </Section>
    </ReviewShell>
  );
}

function FeedbackGallery() {
  return (
    <ReviewShell index="13" title="Feedback & recovery">
      <Section eyebrow="DismissibleAlert" title="Inline status">
        <div className="np-review__stack">
          <DismissibleAlert
            action={<Button size="compact">Retry Sync</Button>}
            title="Live telemetry is delayed"
            tone="warning"
          >
            The most recent provider packet is 74 seconds old. Public pages show the last verified
            state.
          </DismissibleAlert>
          <DismissibleAlert title="Credentials saved" tone="success">
            The provider connection test passed and the new secret is active.
          </DismissibleAlert>
          <DismissibleAlert title="Provider unavailable" tone="danger">
            Automatic retries have been paused after twelve consecutive failures.
          </DismissibleAlert>
        </div>
      </Section>

      <Section eyebrow="DismissibleToast" title="Transient confirmation">
        <div className="np-review__grid">
          <DismissibleToast
            action={
              <Button size="compact" variant="ghost">
                Undo
              </Button>
            }
            title="Correction published"
            tone="success"
          >
            Match 0194 now uses the canonical tournament record.
          </DismissibleToast>
          <DismissibleToast title="Export queued" tone="info">
            We will keep this available in the audit log.
          </DismissibleToast>
        </div>
      </Section>
    </ReviewShell>
  );
}

function AdvancedCore() {
  return <AdvancedFormsGallery />;
}

const meta = {
  component: AdvancedCore,
  parameters: { layout: "fullscreen" },
  title: "Components/10 Advanced core",
} satisfies Meta<typeof AdvancedCore>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Forms: Story = { render: () => <AdvancedFormsGallery /> };
export const DataOperations: Story = { render: () => <DataOperationsGallery /> };
export const LayoutNavigation: Story = { render: () => <LayoutNavigationGallery /> };
export const Feedback: Story = { render: () => <FeedbackGallery /> };
