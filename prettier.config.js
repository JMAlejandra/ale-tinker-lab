/** @type {import('prettier').Config & import('prettier-plugin-tailwindcss').PluginOptions} */
export default {
  semi: false,
  singleQuote: true,
  trailingComma: "all",
  tabWidth: 2,
  printWidth: 100,
  arrowParens: "always",
  bracketSpacing: true,
  bracketSameLine: false,
  singleAttributePerLine: true,
  proseWrap: "preserve",
  useTabs: false,
  endOfLine: "lf",
  plugins: ["prettier-plugin-tailwindcss"],
  overrides: [
    {
      files: "docker-compose.yml",
      options: {
        singleQuote: false,
      },
    },
    {
      files: "*.yml",
      options: {
        singleQuote: false,
      },
    },
  ],
};
