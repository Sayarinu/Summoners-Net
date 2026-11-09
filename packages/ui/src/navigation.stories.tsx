import { Calendar, Radio, Search, Users } from "lucide-react";
import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";

import { Icon } from "./internal.js";
import { Breadcrumb, Footer, Navigation, Pagination } from "./navigation.js";

import "./review.stories.css";

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
                  meta: "3",
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
