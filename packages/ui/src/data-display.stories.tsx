import type { Meta, StoryObj } from "@storybook/react-vite";

import { Skeleton, Table } from "./data-display.js";

import "./review.stories.css";

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
