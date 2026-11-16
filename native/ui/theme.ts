import { StyleSheet } from "react-native";

import { designTokens } from "../../src/styles/tokens";

export const colors = { ...designTokens.colors, error: "#ff8d8d", danger: "#ef4444" };

export const ripple = { color: "rgba(255, 255, 255, 0.12)" };

/** Text styles of the web's type scale (src/styles/tokens.ts fontSize). */
export const type = StyleSheet.create({
  title: { color: colors.fg, fontSize: 20, lineHeight: 26, fontWeight: "700" },
  label: { color: colors.fg, fontSize: 16, lineHeight: 22, fontWeight: "600" },
  body: { color: colors.fg, fontSize: 14, lineHeight: 20 },
  muted: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  caption: { color: colors.muted, fontSize: 12, lineHeight: 16 },
});

/** Horizontal page padding (spacing.gutter). */
export const gutter = 20;
