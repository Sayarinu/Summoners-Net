import { Bell, ExternalLink, Play, Plus, Settings, Trash2 } from "lucide-react";
import type { Meta, StoryObj } from "@storybook/react-vite";

import { Icon } from "./internal.js";
import { Tooltip } from "./overlays.js";
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
import "./review.stories.css";

function ActionsGallery() {
  return (
    <main className="np-review">
      <div className="np-review__inner">
        <header className="np-review__masthead">
          <div>
            <span className="np-eyebrow">Components / 01</span>
            <h1>Actions & status</h1>
          </div>
          <p>
            Clear hierarchy for primary actions, quiet navigation, and trustworthy system state.
          </p>
        </header>

        <section className="np-review__section">
          <header className="np-review__section-header">
            <span className="np-eyebrow">Button</span>
            <h2>Four intents</h2>
            <p>Gold is reserved for the current primary action.</p>
          </header>
          <div className="np-review__content np-review__stack">
            <div className="np-review__row">
              <Button startIcon={<Icon icon={Play} size="small" />} variant="primary">
                Watch Live
              </Button>
              <Button startIcon={<Icon icon={Plus} size="small" />}>Add Source</Button>
              <Button startIcon={<Icon icon={Settings} size="small" />} variant="ghost">
                Configure
              </Button>
              <Button startIcon={<Icon icon={Trash2} size="small" />} variant="danger">
                Delete
              </Button>
            </div>
            <div className="np-review__row">
              <Button size="compact">Compact</Button>
              <Button size="small">Small</Button>
              <Button>Default</Button>
              <Button size="large">Large Touch</Button>
              <Button loading>Saving</Button>
              <Button disabled>Disabled</Button>
            </div>
          </div>
        </section>

        <section className="np-review__section">
          <header className="np-review__section-header">
            <span className="np-eyebrow">IconButton + Tooltip</span>
            <h2>Compact, named controls</h2>
            <p>The label remains available without relying on the tooltip.</p>
          </header>
          <div className="np-review__row">
            <Tooltip content="Notifications">
              <IconButton icon={<Icon icon={Bell} />} label="Notifications" variant="ghost" />
            </Tooltip>
            <Tooltip content="Settings">
              <IconButton icon={<Icon icon={Settings} />} label="Settings" />
            </Tooltip>
            <Tooltip content="Delete provider">
              <IconButton icon={<Icon icon={Trash2} />} label="Delete provider" variant="danger" />
            </Tooltip>
          </div>
        </section>

        <section className="np-review__section">
          <header className="np-review__section-header">
            <span className="np-eyebrow">Links</span>
            <h2>Navigation emphasis</h2>
          </header>
          <div className="np-review__row">
            <TextLink href="#">Match details</TextLink>
            <TextLink href="#" variant="accent">
              Official source <Icon icon={ExternalLink} size="small" />
            </TextLink>
            <TextLink href="#" variant="muted">
              Privacy policy
            </TextLink>
          </div>
        </section>

        <section className="np-review__section">
          <header className="np-review__section-header">
            <span className="np-eyebrow">MetaText + StatusIndicator</span>
            <h2>Text-first metadata and status</h2>
            <p>Color supports the label; it never carries meaning alone.</p>
          </header>
          <div className="np-review__stack">
            <div className="np-review__row">
              <MetaText>Neutral</MetaText>
              <MetaText tone="accent">Tier 1</MetaText>
              <MetaText tone="success">Verified</MetaText>
              <MetaText tone="warning">Delayed</MetaText>
              <MetaText tone="danger">Failed</MetaText>
              <MetaText tone="info">Draft</MetaText>
            </div>
            <div className="np-review__row">
              <StatusIndicator label="Healthy" tone="success" />
              <StatusIndicator label="Delayed" tone="warning" />
              <StatusIndicator label="Unavailable" tone="danger" />
              <StatusIndicator label="Scheduled" tone="info" />
              <LiveIndicator />
            </div>
          </div>
        </section>

        <section className="np-review__section">
          <header className="np-review__section-header">
            <span className="np-eyebrow">Callout + Toast</span>
            <h2>Async feedback</h2>
          </header>
          <div className="np-review__grid">
            <Callout title="Schedule synchronized" tone="success">
              36 matches were reconciled with the canonical provider.
            </Callout>
            <Callout title="Provider response delayed" tone="warning">
              Live telemetry is 42 seconds behind the expected freshness target.
            </Callout>
            <Toast
              action={<Button size="compact">View</Button>}
              title="Import completed"
              tone="success"
            >
              The event roster is ready for review.
            </Toast>
          </div>
        </section>
      </div>
    </main>
  );
}

const meta = {
  component: ActionsGallery,
  parameters: { layout: "fullscreen" },
  title: "Components/01 Actions and status",
} satisfies Meta<typeof ActionsGallery>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Overview: Story = {};
