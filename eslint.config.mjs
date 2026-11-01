import js from "@eslint/js";
import ts from "@typescript-eslint/eslint-plugin";
import hooks from "eslint-plugin-react-hooks";
import globals from "globals";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([
  globalIgnores(["dist/**", ".next/**", ".vinext/**", "node_modules/**"]),
  js.configs.recommended,
  ...ts.configs["flat/recommended"],
  {
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    extends: [hooks.configs.flat.recommended],
  },
]);
