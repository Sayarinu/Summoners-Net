import { Plus, RefreshCw } from "lucide-react";
import type { Meta, StoryObj } from "@storybook/react-vite";

import {
  EmptyState,
  ErrorState,
  Skeleton,
  Sparkline,
  StatBlock,
  StatTable,
  StaleState,
  Table,
  TrendChartShell,
} from "./data-display.js";
import { Icon } from "./internal.js";
import { Button } from "./primitives.js";
import "./review.stories.css";

const noop = () => undefined;

const sampleRows = [
  { event: "Worlds 2026", freshness: "Just now", matches: 36, status: "Verified" },
  { event: "LEC Summer", freshness: "1 minute ago", matches: 18, status: "Current" },
  { event: "SOOP Invitational", freshness: "8 minutes ago", matches: 12, status: "Delayed" },
] as const;

function DataDisplayGallery() {
  return (
    <main className="np-review">
      <div className="np-review__inner">
        <header className="np-review__masthead">
          <div>
            <span className="np-eyebrow">Components / 05</span>
            <h1>Data & feedback</h1>
          </div>
          <p>Dense, readable data with honest loading, empty, stale, and failure states.</p>
        </header>

        <section className="np-review__section">
          <header className="np-review__section-header">
            <span className="np-eyebrow">Skeleton</span>
            <h2>Loading structure</h2>
          </header>
          <div className="np-review__grid">
            <div className="np-review__stage np-review__stack">
              <Skeleton height={12} width="32%" />
              <Skeleton height={28} width="72%" />
              <Skeleton height={12} width="90%" />
            </div>
            <div className="np-review__stage np-review__row">
              <Skeleton height={48} radius="md" width={48} />
              <div style={{ flex: 1 }}>
                <Skeleton height={12} width="56%" />
                <div style={{ height: 8 }} />
                <Skeleton height={10} width="36%" />
              </div>
            </div>
          </div>
        </section>

        <section className="np-review__section">
          <header className="np-review__section-header">
            <span className="np-eyebrow">State panels</span>
            <h2>Empty, error, stale</h2>
          </header>
          <div className="np-review__stack">
            <EmptyState
              action={<Button startIcon={<Icon icon={Plus} size="small" />}>Add Provider</Button>}
              description="Connect a canonical schedule provider to begin ingestion."
              title="No providers configured"
            />
            <ErrorState
              description="The schedule could not be loaded from the current provider."
              onRetry={noop}
            />
            <StaleState description="Last successful update was 18 minutes ago." onRefresh={noop} />
          </div>
        </section>

        <section className="np-review__section">
          <header className="np-review__section-header">
            <span className="np-eyebrow">Table</span>
            <h2>Native dense data</h2>
          </header>
          <Table
            caption="Provider event status"
            columns={[
              { header: "Event", id: "event", render: (row) => row.event },
              { align: "end", header: "Matches", id: "matches", render: (row) => row.matches },
              { header: "Freshness", id: "freshness", render: (row) => row.freshness },
              { header: "Status", id: "status", render: (row) => row.status },
            ]}
            getRowKey={(row) => row.event}
            rows={sampleRows}
          />
        </section>

        <section className="np-review__section">
          <header className="np-review__section-header">
            <span className="np-eyebrow">StatBlock + StatTable</span>
            <h2>Performance metrics</h2>
          </header>
          <div className="np-review__stack">
            <div className="np-review__metric-grid">
              <StatBlock
                change="increase 4.2%"
                changeTone="success"
                label="Win rate"
                value="67.4%"
              />
              <StatBlock detail="per minute" label="Gold diff @15" value="+412" />
              <StatBlock change="decrease 0.3" changeTone="danger" label="KDA" value="4.8" />
              <StatBlock detail="18 games" label="Sample" value="18" />
            </div>
            <StatTable
              caption="Series metrics"
              rows={[
                { label: "First tower", value: "61%" },
                { label: "First dragon", value: "72%" },
                { label: "Average game time", value: "31:42" },
              ]}
            />
          </div>
        </section>

        <section className="np-review__section">
          <header className="np-review__section-header">
            <span className="np-eyebrow">TrendChartShell</span>
            <h2>Chart framing</h2>
          </header>
          <TrendChartShell
            actions={
              <Button
                size="compact"
                startIcon={<Icon icon={RefreshCw} size="small" />}
                variant="ghost"
              >
                Refresh
              </Button>
            }
            description="Gold difference across the last eight sampled games."
            legend={
              <>
                <span>● Gen.G</span>
                <span>● Opponent baseline</span>
              </>
            }
            title="Early-game advantage"
          >
            <Sparkline
              label="Gen.G gold difference trend"
              tone={1}
              values={[8, 12, 10, 18, 22, 19, 28, 32]}
            />
          </TrendChartShell>
        </section>
      </div>
    </main>
  );
}

const meta = {
  component: DataDisplayGallery,
  parameters: { layout: "fullscreen" },
  title: "Components/05 Data and feedback",
} satisfies Meta<typeof DataDisplayGallery>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Overview: Story = {};
