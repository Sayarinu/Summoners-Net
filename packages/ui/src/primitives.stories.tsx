import { ExternalLink, Play, Plus, Settings, Trash2 } from "lucide-react";
import type { Meta, StoryObj } from "@storybook/react-vite";

import { Icon } from "./internal.js";

import { Button, TextLink } from "./primitives.js";
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
