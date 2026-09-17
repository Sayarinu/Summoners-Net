import { Info, MoreHorizontal, PanelRight, Settings, Trash2 } from "lucide-react";
import type { Meta, StoryObj } from "@storybook/react-vite";

import { Input, Switch } from "./forms.js";
import { Icon } from "./internal.js";
import { Dialog, Drawer, Popover, Tooltip } from "./overlays.js";
import { Button, IconButton } from "./primitives.js";
import "./review.stories.css";
import { Disclosure } from "./support.js";

const noop = () => undefined;

function OverlaysGallery() {
  return (
    <main className="np-review">
      <div className="np-review__inner">
        <header className="np-review__masthead">
          <div>
            <span className="np-eyebrow">Components / 04</span>
            <h1>Overlays & disclosure</h1>
          </div>
          <p>
            Focus-managed layers for contextual help, review, configuration, and high-impact
            decisions.
          </p>
        </header>

        <section className="np-review__section">
          <header className="np-review__section-header">
            <span className="np-eyebrow">Tooltip</span>
            <h2>Short descriptions</h2>
          </header>
          <div className="np-review__row">
            <Tooltip content="Provider health details">
              <IconButton
                icon={<Icon icon={Info} />}
                label="Provider health details"
                variant="ghost"
              />
            </Tooltip>
            <Tooltip content="Actions remain available through keyboard focus and do not depend on hover.">
              <IconButton icon={<Icon icon={MoreHorizontal} />} label="More actions" />
            </Tooltip>
          </div>
        </section>

        <section className="np-review__section">
          <header className="np-review__section-header">
            <span className="np-eyebrow">Popover</span>
            <h2>Context without navigation</h2>
          </header>
          <Popover
            footer={
              <Button size="small" variant="primary">
                Apply Filters
              </Button>
            }
            title="Quick filters"
            trigger={
              <Button startIcon={<Icon icon={Settings} size="small" />}>Open Popover</Button>
            }
          >
            <div className="np-review__stack">
              <Switch defaultSelected>Tier-1 only</Switch>
              <Switch>Show completed events</Switch>
              <Switch defaultSelected>Include showmatches</Switch>
            </div>
          </Popover>
        </section>

        <section className="np-review__section">
          <header className="np-review__section-header">
            <span className="np-eyebrow">Dialog</span>
            <h2>Focused review</h2>
          </header>
          <Dialog
            description="Review the proposed canonical value before publishing it to the public site."
            footer={<Button variant="primary">Approve Correction</Button>}
            title="Approve provider correction"
            trigger={<Button variant="primary">Open Dialog</Button>}
          >
            <div className="np-review__stack">
              <Input label="Current value" readOnly value="GenG Esports" />
              <Input label="Proposed value" readOnly value="Gen.G" />
            </div>
          </Dialog>
        </section>

        <section className="np-review__section">
          <header className="np-review__section-header">
            <span className="np-eyebrow">Drawer</span>
            <h2>Secondary context</h2>
          </header>
          <Drawer
            description="Inspect match metadata without leaving the schedule."
            footer={
              <Button onPress={noop} variant="primary">
                Open Full Match
              </Button>
            }
            title="Match quick look"
            trigger={
              <Button startIcon={<Icon icon={PanelRight} size="small" />}>Open Drawer</Button>
            }
          >
            <dl className="np-review__stack">
              <div>
                <dt className="np-eyebrow">Event</dt>
                <dd>Worlds 2026 · Swiss stage</dd>
              </div>
              <div>
                <dt className="np-eyebrow">Series</dt>
                <dd>Gen.G vs T1 · Best of 3</dd>
              </div>
              <div>
                <dt className="np-eyebrow">Provider</dt>
                <dd>Canonical schedule feed</dd>
              </div>
            </dl>
          </Drawer>
        </section>

        <section className="np-review__section">
          <header className="np-review__section-header">
            <span className="np-eyebrow">Disclosure</span>
            <h2>Inline detail</h2>
          </header>
          <div className="np-review__stack">
            <Disclosure defaultExpanded summary="Why is this match marked stale?">
              The schedule provider has not returned a successful update within the configured
              freshness target.
            </Disclosure>
            <Disclosure summary="Provider diagnostics">
              Request correlation IDs and sanitized response metadata appear here for authorized
              operators.
            </Disclosure>
          </div>
        </section>

        <section className="np-review__section">
          <header className="np-review__section-header">
            <span className="np-eyebrow">Destructive treatment</span>
            <h2>Danger remains unmistakable</h2>
          </header>
          <Button startIcon={<Icon icon={Trash2} size="small" />} variant="danger">
            Remove Provider
          </Button>
        </section>
      </div>
    </main>
  );
}

const meta = {
  component: OverlaysGallery,
  parameters: { layout: "fullscreen" },
  title: "Components/04 Overlays and disclosure",
} satisfies Meta<typeof OverlaysGallery>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Overview: Story = {};
