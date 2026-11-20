import type { StorybookConfig } from "@storybook/react-vite";

const config: StorybookConfig = {
  addons: ["@storybook/addon-docs", "@storybook/addon-a11y"],
  framework: { name: "@storybook/react-vite", options: {} },
  viteFinal: (config) => ({
    ...config,
    server: { ...config.server, proxy: { "/api/images": "http://127.0.0.1:3000" } },
  }),
  stories: ["../src/**/*.stories.@(ts|tsx)"],
};

export default config;
