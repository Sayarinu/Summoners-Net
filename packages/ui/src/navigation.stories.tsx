import { Calendar, LayoutList, Radio, Search, Settings, Shield, Users } from "lucide-react";
import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";

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
} from "./navigation.js";
import { Button, LiveIndicator, MetaText } from "./primitives.js";
import "./review.stories.css";
import { BrandMark } from "./support.js";

const noop = () => undefined;

function NavigationGallery() {
  const [page, setPage] = useState(6);

  return (
    <main className="np-review">
      <div className="np-review__inner">
        <header className="np-review__masthead">
          <div>
            <span className="np-eyebrow">Components / 03</span>
            <h1>Navigation & structure</h1>
          </div>
          <p>Quiet orientation that recedes once the working surface is understood.</p>
        </header>

        <section className="np-review__section">
          <header className="np-review__section-header">
            <span className="np-eyebrow">Header</span>
            <h2>Public shell</h2>
          </header>
          <div className="np-review__frame">
            <Header
              actions={<Button size="compact">Methodology</Button>}
              brand={<BrandMark />}
              navigation={
                <div className="np-review__row">
                  <a href="#">Schedule</a>
                  <a href="#">Teams</a>
                  <a href="#">Players</a>
                </div>
              }
              status={<LiveIndicator label="3 live" />}
            />
          </div>
        </section>

        <section className="np-review__section">
          <header className="np-review__section-header">
            <span className="np-eyebrow">Navigation</span>
            <h2>Sidebar list</h2>
          </header>
          <div className="np-review__stage" style={{ maxWidth: 280 }}>
            <Navigation
              currentHref="/schedule"
              items={[
                {
                  href: "/schedule",
                  icon: <Icon icon={Calendar} size="small" />,
                  label: "Schedule",
                },
                {
                  meta: <MetaText tone="live">3</MetaText>,
                  href: "/live",
                  icon: <Icon icon={Radio} size="small" />,
                  label: "Live",
                },
                { href: "/teams", icon: <Icon icon={Users} size="small" />, label: "Teams" },
                { href: "/search", icon: <Icon icon={Search} size="small" />, label: "Search" },
              ]}
            />
          </div>
        </section>

        <section className="np-review__section">
          <header className="np-review__section-header">
            <span className="np-eyebrow">Tabs</span>
            <h2>Section switching</h2>
          </header>
          <Tabs
            defaultSelectedKey="overview"
            items={[
              {
                content: (
                  <div className="np-review__stage">Event summary and current standing.</div>
                ),
                id: "overview",
                label: "Overview",
              },
              {
                meta: <MetaText>24</MetaText>,
                content: <div className="np-review__stage">Complete event schedule.</div>,
                id: "matches",
                label: "Matches",
              },
              {
                content: <div className="np-review__stage">Group and bracket standings.</div>,
                id: "standings",
                label: "Standings",
              },
              {
                content: <div className="np-review__stage">Team and player performance.</div>,
                id: "stats",
                label: "Statistics",
              },
            ]}
            label="Event sections"
          />
        </section>

        <section className="np-review__section">
          <header className="np-review__section-header">
            <span className="np-eyebrow">SegmentedControl</span>
            <h2>View mode</h2>
          </header>
          <SegmentedControl
            defaultValue="list"
            label="Schedule layout"
            options={[
              { icon: <Icon icon={LayoutList} size="small" />, label: "List", value: "list" },
              { icon: <Icon icon={Calendar} size="small" />, label: "Calendar", value: "calendar" },
            ]}
          />
        </section>

        <section className="np-review__section">
          <header className="np-review__section-header">
            <span className="np-eyebrow">Breadcrumb + Pagination</span>
            <h2>Position and traversal</h2>
          </header>
          <div className="np-review__stack">
            <Breadcrumb
              items={[
                { href: "/events", label: "Events" },
                { href: "/events/worlds", label: "Worlds 2026" },
                { label: "Swiss stage" },
              ]}
            />
            <Pagination currentPage={page} onPageChange={setPage} totalPages={18} />
          </div>
        </section>

        <section className="np-review__section">
          <header className="np-review__section-header">
            <span className="np-eyebrow">Menu</span>
            <h2>Contextual actions</h2>
          </header>
          <Menu
            items={[
              {
                description: "Open provider configuration.",
                icon: <Icon icon={Settings} size="small" />,
                id: "configure",
                label: "Configure",
              },
              {
                description: "Inspect the immutable audit history.",
                icon: <Icon icon={Shield} size="small" />,
                id: "audit",
                label: "View audit log",
              },
              { disabled: true, id: "delete", label: "Delete protected provider" },
            ]}
            onAction={noop}
          />
        </section>

        <section className="np-review__section">
          <header className="np-review__section-header">
            <span className="np-eyebrow">Footer</span>
            <h2>Legal and service context</h2>
          </header>
          <div className="np-review__frame">
            <Footer
              links={[
                { href: "#", label: "Privacy" },
                { href: "#", label: "Terms" },
                { href: "#", label: "Status" },
              ]}
              status={<span>All systems operational</span>}
            />
          </div>
        </section>
      </div>
    </main>
  );
}

const meta = {
  component: NavigationGallery,
  parameters: { layout: "fullscreen" },
  title: "Components/03 Navigation and structure",
} satisfies Meta<typeof NavigationGallery>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Overview: Story = {};
