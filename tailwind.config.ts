import type { Config } from "tailwindcss";
import plugin from "tailwindcss/plugin";
import { cssVariables, designTokens, tailwindColors } from "./src/styles/tokens";

export default {
  theme: {
    extend: {
      colors: { app: tailwindColors },
      fontFamily: { sans: ["var(--font-body)"] },
      fontSize: {
        navigation: "var(--app-text-navigation)",
        caption: "var(--app-text-caption)",
        body: "var(--app-text-body)",
        label: "var(--app-text-label)",
        title: "var(--app-text-title)",
        xs: "var(--app-text-caption)",
        sm: "var(--app-text-body)",
        base: "var(--app-text-label)",
        lg: "var(--app-text-title)",
        xl: "var(--app-text-title)",
      },
      borderRadius: designTokens.radius,
      spacing: designTokens.spacing,
    },
  },
  plugins: [plugin(({ addBase }) => addBase({ ":root": cssVariables }))],
} satisfies Config;
