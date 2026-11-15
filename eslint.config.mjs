import js from "@eslint/js";
import ts from "@typescript-eslint/eslint-plugin";
import hooks from "eslint-plugin-react-hooks";
import globals from "globals";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([
  globalIgnores([
    "dist/**",
    ".next/**",
    ".vinext/**",
    "node_modules/**",
    "native/node_modules/**",
    "native/.expo/**",
    "native/android/**",
    "native/ios/**",
    "native/web/**",
  ]),
  js.configs.recommended,
  ...ts.configs["flat/recommended"],
  {
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    extends: [hooks.configs.flat.recommended],
  },
  {
    // Expo config plugins and the Metro config are loaded by Node as CommonJS.
    files: ["native/plugins/**/*.js", "native/metro.config.js"],
    languageOptions: { sourceType: "commonjs" },
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
]);
