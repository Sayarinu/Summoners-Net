import type { CSSProperties, SVGProps } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";

import "./foundations.stories.css";

const colors = [
  { name: "Canvas", value: "#070809", variable: "--color-bg-canvas" },
  { name: "Surface", value: "#0E1012", variable: "--color-bg-surface" },
  { name: "Raised", value: "#16191D", variable: "--color-bg-raised" },
  { name: "Interactive", value: "#23272D", variable: "--color-bg-interactive" },
  {
    name: "Gold",
    value: "#C8A96B",
    variable: "--color-primitive-gold-500",
    text: "var(--color-text-inverse)",
  },
  {
    name: "Gold soft",
    value: "#D8BF8C",
    variable: "--color-text-accent",
    text: "var(--color-text-inverse)",
  },
  {
    name: "Silver",
    value: "#AAB0B8",
    variable: "--color-text-muted",
    text: "var(--color-text-inverse)",
  },
  {
    name: "White",
    value: "#F4F6F8",
    variable: "--color-text-primary",
    text: "var(--color-text-inverse)",
  },
] as const;

const spaces = [
  { name: "01", pixels: "4", variable: "--space-1" },
  { name: "02", pixels: "8", variable: "--space-2" },
  { name: "03", pixels: "12", variable: "--space-3" },
  { name: "04", pixels: "16", variable: "--space-4" },
  { name: "06", pixels: "24", variable: "--space-6" },
  { name: "08", pixels: "32", variable: "--space-8" },
  { name: "12", pixels: "48", variable: "--space-12" },
  { name: "24", pixels: "96", variable: "--space-24" },
] as const;

const chartSeries = [
  { className: "np-chart-series-1", height: "42%" },
  { className: "np-chart-series-2", height: "74%" },
  { className: "np-chart-series-3", height: "57%" },
  { className: "np-chart-series-4", height: "86%" },
  { className: "np-chart-series-5", height: "66%" },
  { className: "np-chart-series-6", height: "48%" },
  { className: "np-chart-series-7", height: "78%" },
  { className: "np-chart-series-8", height: "59%" },
] as const;

function PulseGlyph({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24" {...props}>
      <path d="M3 12h4l2.25-6 4.5 12L16 12h5" stroke="currentColor" strokeLinecap="round" />
    </svg>
  );
}

function FoundationsGallery() {
  return (
    <main className="np-foundations np-page">
      <div className="np-container">
        <header className="np-foundations__masthead">
          <div className="np-foundations__mark">NP/01</div>
          <div className="np-foundations__intro np-motion-enter">
            <p className="np-overline">Nexus Pulse / Foundation system</p>
            <h1 className="np-display">Signal over spectacle.</h1>
            <p className="np-body-lg">
              A dark, line-led interface for live competition, historical context, and reliable
              operations.
            </p>
          </div>
          <div className="np-foundations__index" aria-label="Foundation summary">
            {[
              ["01", "Dark only"],
              ["02", "IBM Plex"],
              ["03", "4px rhythm"],
              ["04", "Measured motion"],
            ].map(([number, label]) => (
              <div className="np-foundations__index-item" key={number}>
                <span className="np-meta">{number}</span>
                <span className="np-heading-sm">{label}</span>
              </div>
            ))}
          </div>
        </header>

        <section className="np-foundations__section" aria-labelledby="foundation-color">
          <header className="np-foundations__section-header">
            <p className="np-overline">01 / Color</p>
            <h2 className="np-heading-md" id="foundation-color">
              Calm surfaces. Precise emphasis.
            </h2>
            <p className="np-body-sm">
              Black carries hierarchy; silver carries context; gold marks attention and action.
            </p>
          </header>
          <div className="np-foundations__swatches">
            {colors.map((color) => (
              <div
                className="np-foundations__swatch"
                key={color.name}
                style={
                  {
                    "--swatch": `var(${color.variable})`,
                    "--swatch-text": "text" in color ? color.text : undefined,
                  } as CSSProperties
                }
              >
                <span className="np-foundations__swatch-name">{color.name}</span>
                <span className="np-foundations__swatch-value">{color.value}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="np-foundations__section" aria-labelledby="foundation-type">
          <header className="np-foundations__section-header">
            <p className="np-overline">02 / Typography</p>
            <h2 className="np-heading-md" id="foundation-type">
              Editorial hierarchy, operational density.
            </h2>
            <p className="np-body-sm">
              IBM Plex Sans reads the competition. IBM Plex Mono carries time, score, and system
              state.
            </p>
          </header>
          <div className="np-foundations__type-list">
            <div className="np-foundations__type-row">
              <span className="np-meta">Display / 48</span>
              <span className="np-display">Worlds 2026</span>
            </div>
            <div className="np-foundations__type-row">
              <span className="np-meta">Heading / 28</span>
              <span className="np-heading-lg">The next series starts in Seoul.</span>
            </div>
            <div className="np-foundations__type-row">
              <span className="np-meta">Body / 16</span>
              <span className="np-body">
                Verified schedules, rosters, results, and live context.
              </span>
            </div>
            <div className="np-foundations__type-row">
              <span className="np-meta">Data / 14</span>
              <span className="np-data">GEN 02 — 01 T1 · 34:18 · PATCH 16.13</span>
            </div>
            <div className="np-foundations__type-row">
              <span className="np-meta">Overline / 12</span>
              <span className="np-overline">Live / map three / sourced just now</span>
            </div>
          </div>
        </section>

        <section className="np-foundations__section" aria-labelledby="foundation-rhythm">
          <header className="np-foundations__section-header">
            <p className="np-overline">03 / Rhythm</p>
            <h2 className="np-heading-md" id="foundation-rhythm">
              One scale, three working densities.
            </h2>
            <p className="np-body-sm">
              Public reading surfaces breathe. Data tables stay compact. Touch controls remain
              deliberate.
            </p>
          </header>
          <div
            className="np-stack"
            style={{ "--np-stack-gap": "var(--space-10)" } as CSSProperties}
          >
            <div className="np-foundations__spacing" aria-label="Spacing scale">
              {spaces.map((space) => (
                <div className="np-foundations__space-row" key={space.name}>
                  <span className="np-meta">{space.name}</span>
                  <span
                    className="np-foundations__space-bar"
                    style={{ "--space-value": `var(${space.variable})` } as CSSProperties}
                  />
                  <span className="np-meta np-tabular">{space.pixels}px</span>
                </div>
              ))}
            </div>
            <div className="np-foundations__density">
              {[
                ["np-density-compact", "Compact", "32px control", "Operations"],
                ["np-density-default", "Default", "44px control", "Public data"],
                ["np-density-comfortable", "Comfortable", "52px control", "Touch focus"],
              ].map(([className, name, size, use]) => (
                <div className={`np-foundations__density-row ${className}`} key={name}>
                  <span className="np-heading-sm">{name}</span>
                  <span className="np-meta">{use}</span>
                  <button
                    className="np-foundations__density-action np-motion-interactive"
                    type="button"
                  >
                    {size}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="np-foundations__section" aria-labelledby="foundation-icons">
          <header className="np-foundations__section-header">
            <p className="np-overline">04 / Icon sizing</p>
            <h2 className="np-heading-md" id="foundation-icons">
              Optical sizes for fast scanning.
            </h2>
            <p className="np-body-sm">
              A consistent 1.75 stroke keeps utility icons legible without adding visual weight.
            </p>
          </header>
          <div className="np-foundations__icon-grid">
            {[
              ["small", "16px", "Dense metadata"],
              ["default", "20px", "Default control"],
              ["large", "24px", "Primary action"],
            ].map(([size, label, use]) => (
              <div className="np-foundations__icon-cell" key={size}>
                <PulseGlyph className="np-icon" data-size={size === "default" ? undefined : size} />
                <span className="np-data">{label}</span>
                <span className="np-meta">{use}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="np-foundations__section" aria-labelledby="foundation-motion">
          <header className="np-foundations__section-header">
            <p className="np-overline">05 / Motion</p>
            <h2 className="np-heading-md" id="foundation-motion">
              Fast enough to feel immediate.
            </h2>
            <p className="np-body-sm">
              Motion clarifies state and hierarchy. Hover or focus each track to inspect timing.
            </p>
          </header>
          <div className="np-foundations__motion-grid">
            {[
              ["Fast", "120ms", "var(--motion-duration-fast)"],
              ["Standard", "180ms", "var(--motion-duration-standard)"],
              ["Deliberate", "260ms", "var(--motion-duration-deliberate)"],
            ].map(([name, value, duration]) => (
              <div
                className="np-foundations__motion-sample"
                key={name}
                style={{ "--sample-duration": duration } as CSSProperties}
              >
                <div>
                  <p className="np-heading-sm">{name}</p>
                  <p className="np-meta">{value}</p>
                </div>
                <div className="np-foundations__motion-track">
                  <span className="np-foundations__motion-dot" />
                </div>
                <button className="np-foundations__motion-trigger np-focus-ring" type="button">
                  Focus to replay
                </button>
              </div>
            ))}
          </div>
        </section>

        <section className="np-foundations__section" aria-labelledby="foundation-focus">
          <header className="np-foundations__section-header">
            <p className="np-overline">06 / Focus</p>
            <h2 className="np-heading-md" id="foundation-focus">
              Visible, quiet, unmistakable.
            </h2>
            <p className="np-body-sm">
              A two-pixel gold ring with three pixels of separation survives dark surfaces and
              forced colors.
            </p>
          </header>
          <div className="np-foundations__focus-stage">
            <button
              className="np-foundations__focus-button np-focus-ring np-motion-interactive"
              data-focus-visible="true"
              type="button"
            >
              Demonstrated focus
            </button>
            <div
              className="np-stack"
              style={{ "--np-stack-gap": "var(--space-2)" } as CSSProperties}
            >
              <span className="np-data">2px / gold.300</span>
              <span className="np-meta">3px offset · keyboard only · forced-color aware</span>
            </div>
          </div>
        </section>

        <section className="np-foundations__section" aria-labelledby="foundation-chart">
          <header className="np-foundations__section-header">
            <p className="np-overline">07 / Data visualization</p>
            <h2 className="np-heading-md" id="foundation-chart">
              Eight ordered series.
            </h2>
            <p className="np-body-sm">
              Gold remains the primary comparison. Supporting colors communicate series—not product
              status.
            </p>
          </header>
          <div className="np-foundations__chart" aria-label="Eight-color chart palette">
            {chartSeries.map((series, index) => (
              <div
                className={`np-foundations__chart-bar ${series.className}`}
                key={series.className}
                style={{ "--bar-height": series.height } as CSSProperties}
              >
                <span className="np-foundations__chart-label">
                  {String(index + 1).padStart(2, "0")}
                </span>
              </div>
            ))}
          </div>
        </section>

        <footer className="np-foundations__footer np-split">
          <p className="np-overline">Nouvelle Lune Atelier</p>
          <p className="np-meta">Nexus Pulse / Foundation review / Dark system</p>
        </footer>
      </div>
    </main>
  );
}

const meta = {
  component: FoundationsGallery,
  parameters: { layout: "fullscreen" },
  title: "Foundations/System gallery",
} satisfies Meta<typeof FoundationsGallery>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Overview: Story = {};
