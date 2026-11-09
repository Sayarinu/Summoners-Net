import { AtSign, Globe2, Hash } from "lucide-react";

import type { Meta, StoryObj } from "@storybook/react-vite";

import { Combobox, Input, Select, Switch } from "./forms.js";
import { Icon } from "./internal.js";
import "./review.stories.css";

const regions = [
  { description: "League of Legends EMEA Championship", label: "LEC", value: "lec" },
  { description: "League Championship Series", label: "LCS", value: "lcs" },
  { description: "League of Legends Champions Korea", label: "LCK", value: "lck" },
  { description: "League of Legends Pro League", label: "LPL", value: "lpl" },
] as const;

function FormsGallery() {
  return (
    <main className="np-review">
      <div className="np-review__inner">
        <header className="np-review__masthead">
          <div>
            <span className="np-eyebrow">Components / 02</span>
            <h1>Forms & selection</h1>
          </div>
          <p>
            Native editing behavior with precise validation, descriptions, and dense selection
            surfaces.
          </p>
        </header>

        <section className="np-review__section">
          <header className="np-review__section-header">
            <span className="np-eyebrow">Input</span>
            <h2>Text entry</h2>
            <p>Label, description, affix, validation, and disabled states.</p>
          </header>
          <div className="np-review__grid np-review__grid--form">
            <Input
              description="Shown on the public team page."
              label="Display name"
              placeholder="Team name"
            />
            <Input
              label="Provider ID"
              placeholder="provider:team:123"
              prefix={<Icon icon={Hash} size="small" />}
            />
            <Input
              error="Enter a valid public URL."
              label="Official website"
              prefix={<Icon icon={Globe2} size="small" />}
              defaultValue="not-a-url"
            />
            <Input
              disabled
              label="Provider email"
              prefix={<Icon icon={AtSign} size="small" />}
              value="locked@example.com"
            />
          </div>
        </section>

        <section className="np-review__section">
          <header className="np-review__section-header">
            <span className="np-eyebrow">Select + Combobox</span>
            <h2>Known and searchable options</h2>
          </header>
          <div className="np-review__grid">
            <Select
              defaultValue="lck"
              description="Controls the public competition scope."
              label="Primary region"
              options={regions}
            />
            <Combobox
              description="Type to narrow supported Tier-1 regions."
              label="Add region"
              options={regions}
            />
            <Select
              error="Choose a canonical region."
              label="Required region"
              options={regions}
              required
            />
          </div>
        </section>

        <section className="np-review__section">
          <header className="np-review__section-header">
            <span className="np-eyebrow">Switch</span>
            <h2>Persistent settings</h2>
          </header>
          <div className="np-review__stack">
            <Switch defaultSelected>Hide match-result spoilers</Switch>
            <Switch>Use compact table density</Switch>
            <Switch disabled>Enable experimental provider</Switch>
          </div>
        </section>
      </div>
    </main>
  );
}

const meta = {
  component: FormsGallery,
  parameters: { layout: "fullscreen" },
  title: "Components/02 Forms and selection",
} satisfies Meta<typeof FormsGallery>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Overview: Story = {};
