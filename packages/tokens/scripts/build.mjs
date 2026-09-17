import StyleDictionary from "style-dictionary";

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
