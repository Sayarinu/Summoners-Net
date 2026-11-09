import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/.next/**",
      "**/.turbo/**",
      "**/coverage/**",
      "**/dist/**",
      "**/node_modules/**",
      "**/storybook-static/**",
      "**/playwright-report/**",
      "**/test-results/**",
      ".local/**",
      "output/**",
      "packages/tokens/generated/**",
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/consistent-type-imports": ["error", { fixStyle: "inline-type-imports" }],
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "no-console": ["error", { allow: ["warn", "error"] }],
    },
  },
  {
    files: ["**/*.config.{js,mjs,ts}", "**/scripts/**/*.{js,mjs,ts}"],
    languageOptions: {
      parserOptions: {
        projectService: false,
      },
    },
    rules: {
      ...tseslint.configs.disableTypeChecked.rules,
      "no-console": "off",
    },
  },
  {
    files: ["packages/data/src/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            "react",
            "react/**",
            "react-dom",
            "next",
            "next/**",
            "@summonersnet/ui",
            "@summonersnet/ui/**",
          ],
        },
      ],
    },
  },
  {
    files: ["apps/web/src/**/*.{ts,tsx}", "apps/web/app/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            "pg",
            "@summonersnet/data/src/**",
            "@summonersnet/data/dist/**",
            "**/packages/data/src/**",
          ],
        },
      ],
    },
  },
  {
    files: ["apps/web/src/features/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@summonersnet/data",
              allowTypeImports: true,
              message: "Use DTO types in features; database clients belong in src/server.",
            },
          ],
          patterns: ["@summonersnet/data/sync", "**/server/**", "pg", "node:*"],
        },
      ],
    },
  },
);
