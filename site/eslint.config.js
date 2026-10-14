import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import { qwikEslint9Plugin } from "eslint-plugin-qwik";

export default [
  { ignores: ["dist/**", "server/**", "storybook-static/**", "styled-system/**", "tmp/**"] },
  {
    files: ["src/**/*.ts", "src/**/*.tsx"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        tsconfigRootDir: import.meta.dirname,
        project: ["./tsconfig.json"],
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: { "@typescript-eslint": tsPlugin, qwik: qwikEslint9Plugin },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      ...qwikEslint9Plugin.configs.recommended[0].rules,
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/no-namespace": "off",
      "@typescript-eslint/no-empty-function": "off",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
  },
];
