import type { Preview } from "@storybook/react-vite";

import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "@fontsource/ibm-plex-mono/600.css";
import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/500.css";
import "@fontsource/ibm-plex-sans/600.css";
import "@esportsviewer/tokens/generated/tokens.css";
import "../src/styles.css";

const preview: Preview = {
  parameters: {
    a11y: { test: "error" },
    backgrounds: { default: "canvas", values: [{ name: "canvas", value: "#070809" }] },
    controls: { expanded: true },
    layout: "fullscreen",
  },
};

export default preview;
