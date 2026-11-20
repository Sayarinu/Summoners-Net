import StyleDictionary from "style-dictionary";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const dictionary = new StyleDictionary({
  log: { verbosity: "default" },
  platforms: {
    css: {
      buildPath: "generated/",
      files: [
        {
          destination: "tokens.css",
          format: "css/variables",
          options: { outputReferences: true },
        },
      ],
      transformGroup: "css",
    },
    json: {
      buildPath: "generated/",
      files: [{ destination: "tokens.json", format: "json/nested" }],
      transformGroup: "js",
    },
  },
  source: ["src/tokens.json"],
});

dictionary.usesDtcg = true;

await dictionary.buildAllPlatforms();

// Tailwind reads the same tokens through a theme with semantic names, so page layout can only use
// design-system values: `bg-raised`, `text-accent`, `border-line`, `p-4`, `text-sm`, `rounded-md`.
// Utilities reference the token variables, so tokens.css stays the single runtime source.
const tokens = JSON.parse(
  await readFile(join(import.meta.dirname, "../generated/tokens.json"), "utf8"),
);
const groups = {
  color: {
    canvas: "bg-canvas",
    surface: "bg-surface",
    raised: "bg-raised",
    interactive: "bg-interactive",
    selected: "bg-selected",
    overlay: "bg-overlay",
    fg: "text-primary",
    "fg-secondary": "text-secondary",
    "fg-muted": "text-muted",
    "fg-disabled": "text-disabled",
    "fg-inverse": "text-inverse",
    accent: "text-accent",
    line: "border-subtle",
    "line-strong": "border-strong",
    "line-accent": "border-accent",
    focus: "border-focus",
    danger: "status-danger",
    success: "status-success",
    warning: "status-warning",
    info: "status-info",
    live: "status-live",
    "side-blue": "side-blue",
    "side-red": "side-red",
    ...Object.fromEntries(Object.keys(tokens.color.chart).map((k) => [`chart-${k}`, `chart-${k}`])),
  },
  radius: Object.fromEntries(Object.keys(tokens.radius).map((k) => [k, k])),
  text: Object.fromEntries(Object.keys(tokens.font.size).map((k) => [k, k])),
  font: { sans: "sans", mono: "mono" },
  "font-weight": Object.fromEntries(Object.keys(tokens.font.weight).map((k) => [k, k])),
  leading: Object.fromEntries(Object.keys(tokens.font.lineHeight).map((k) => [k, k])),
  tracking: Object.fromEntries(Object.keys(tokens.font.tracking).map((k) => [k, k])),
  breakpoint: Object.fromEntries(Object.keys(tokens.breakpoint).map((k) => [k, k])),
  container: { content: "content", reading: "reading" },
};
const source = {
  color: (path) => `--color-${path}`,
  radius: (path) => `--radius-${path}`,
  text: (path) => `--font-size-${path}`,
  font: (path) => `--font-family-${path}`,
  "font-weight": (path) => `--font-weight-${path}`,
  leading: (path) => `--font-line-height-${path}`,
  tracking: (path) => `--font-tracking-${path}`,
  breakpoint: (path) => `--breakpoint-${path}`,
  container: (path) => `--size-${path}`,
};
const literal = { breakpoint: tokens.breakpoint, container: tokens.size };
const lines = [
  "/**",
  " * Do not edit directly, this file was auto-generated from src/tokens.json.",
  " */",
  "",
  "@theme inline reference {",
  `  --spacing: ${tokens.space["1"]};`,
];
for (const [group, names] of Object.entries(groups)) {
  lines.push("");
  for (const [name, path] of Object.entries(names)) {
    // Media and container queries cannot read custom properties, so those carry the raw value.
    const value = literal[group] ? literal[group][path] : `var(${source[group](path)})`;
    if (value === undefined) throw new Error(`Unknown ${group} token: ${path}`);
    lines.push(`  --${group}-${name}: ${value};`);
  }
}
// Derived colors mix tokens; they live here so pages and components share one definition.
lines.push(
  "",
  "  /* A loss reads as red without the alarm of an error. */",
  "  --color-loss: color-mix(in srgb, var(--color-status-danger) 84%, var(--color-text-primary));",
);
lines.push("}", "");
await writeFile(join(import.meta.dirname, "../generated/tailwind.css"), lines.join("\n"));
