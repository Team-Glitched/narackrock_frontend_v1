import type { ReactNode } from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Path, Rect } from "react-native-svg";

import type { NativeRequestStatus, NativeWork } from "../../../src/lib/native-screens";
import { Touchable } from "../../ui/kit";
import { colors, gutter } from "../../ui/theme";

/** Same values as the web's Tailwind tokens (text-caption is 14px on the web). */
export const text = StyleSheet.create({
  title: { color: colors.fg, fontSize: 20, lineHeight: 28, fontWeight: "600" },
  heading: { color: colors.fg, fontSize: 20, lineHeight: 26, fontWeight: "700" },
  label: { color: colors.fg, fontSize: 16, lineHeight: 24 },
  labelStrong: { color: colors.fg, fontSize: 16, lineHeight: 22, fontWeight: "600" },
  muted: { color: colors.muted, fontSize: 16, lineHeight: 24 },
  body: { color: colors.fg, fontSize: 14, lineHeight: 20 },
  bodyMuted: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  caption: { color: colors.muted, fontSize: 14, lineHeight: 18 },
  error: { color: colors.error, fontSize: 16, lineHeight: 24 },
});

/** The web's workspace page column (workspacePage: 24px 20px 36px, gap 20) with its h1 and subtitle. */
export function Page({
  title,
  subtitle,
  children,
}: {
  title?: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.page}>
      {title !== undefined && (
        <Text style={text.title} accessibilityRole="header">
          {title}
        </Text>
      )}
      {subtitle !== undefined && <Text style={text.muted}>{subtitle}</Text>}
      {children}
    </View>
  );
}

/** Bordered notice box (workspaceNotice). */
export function Notice({ children, alert = false }: { children: string; alert?: boolean }) {
  return (
    <Text accessibilityRole={alert ? "alert" : undefined} style={[text.label, styles.notice]}>
      {children}
    </Text>
  );
}

/** Centered empty/loading message (workspaceEmpty, PageState). */
export function Empty({
  children,
  tone = "muted",
  action,
}: {
  children: string;
  tone?: "muted" | "error";
  action?: ReactNode;
}) {
  return (
    <View style={styles.empty} accessibilityRole={tone === "error" ? "alert" : undefined}>
      <Text style={[tone === "error" ? text.error : text.muted, styles.center]}>{children}</Text>
      {action}
    </View>
  );
}

/** Rounded pill button (workspaceActions / workspaceHeading buttons; `primary` is workspacePrimary). */
export function Pill({
  label,
  primary = false,
  pressed,
  disabled = false,
  accessibilityLabel,
  onPress,
}: {
  label: string;
  primary?: boolean;
  /** aria-pressed toggle state. */
  pressed?: boolean;
  disabled?: boolean;
  accessibilityLabel?: string;
  onPress: () => void;
}) {
  return (
    <Touchable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled, checked: pressed }}
      disabled={disabled}
      style={[styles.pill, primary && styles.primary, disabled && styles.disabled]}
      onPress={onPress}
    >
      <Text style={styles.pillText}>{label}</Text>
    </Touchable>
  );
}

/** Full-width left-aligned button (workspaceWide). */
export function Wide({
  label,
  disabled = false,
  onPress,
}: {
  label: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Touchable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      style={[styles.wide, disabled && styles.disabled]}
      onPress={onPress}
    >
      <Text style={styles.pillText}>{label}</Text>
    </Touchable>
  );
}

/** Bordered card (workspaceCard). */
export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

const badgeColors = {
  request: {
    borderColor: "#57358a",
    backgroundColor: colors["primary-deep"],
    color: colors["primary-soft"],
  },
  approved: { borderColor: "#3c5a4d", backgroundColor: "#24342e", color: "#c1e4d3" },
  rejected: { borderColor: "#61414a", backgroundColor: "#38292e", color: "#f1c1cb" },
};

/** Request status badge (badgeVariants). */
export function StatusBadge({ status }: { status: NativeRequestStatus }) {
  const { color, ...box } = badgeColors[status.tone];
  return (
    <View style={[styles.badge, box]}>
      <Text style={[styles.badgeText, { color }]}>{status.label}</Text>
    </View>
  );
}

/** lucide ArrowUpRight. */
export function ArrowUpRight({ size, color = colors.fg }: { size: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
      <Path d="M7 17 17 7M7 7h10v10" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/** Same drawing as the web's DraftPreview (copied from native/screens/home.tsx WorkPreview). */
export function WorkPreview({ tracks }: { tracks: NativeWork["preview"] }) {
  return (
    <Svg
      width="100%"
      height={78}
      viewBox="0 0 240 88"
      preserveAspectRatio="none"
      style={styles.preview}
    >
      <Rect width={240} height={88} fill={colors.panel} />
      {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
        <Path key={`v${i}`} d={`M${i * 30} 0V88`} stroke={colors.border} strokeWidth={0.6} />
      ))}
      {[0, 1, 2, 3, 4].map((i) => (
        <Path key={`h${i}`} d={`M0 ${i * 22}H240`} stroke={colors.border} strokeWidth={0.6} />
      ))}
      {tracks.map((clips, row) =>
        clips.map((clip, index) => (
          <Rect
            key={`${row}-${index}`}
            x={clip.start * 232 + 4}
            y={row * 22 + 5}
            width={Math.max(3, clip.length * 232 - 4)}
            height={12}
            rx={3}
            fill={colors.primary}
            opacity={1 - row * 0.16}
          />
        )),
      )}
    </Svg>
  );
}

export const styles = StyleSheet.create({
  page: { paddingHorizontal: gutter, paddingTop: 16, paddingBottom: 36, gap: 20 },
  center: { textAlign: "center" },
  notice: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 16 },
  empty: {
    minHeight: 260,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    paddingHorizontal: gutter,
    paddingVertical: 48,
  },
  pill: {
    minHeight: 40,
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 16,
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  primary: { backgroundColor: colors.primary },
  pillText: { color: colors.fg, fontSize: 16, lineHeight: 20, fontWeight: "500" },
  disabled: { opacity: 0.5 },
  wide: {
    minHeight: 44,
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 16,
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  card: { padding: 16, borderRadius: 12, borderWidth: 1, borderColor: colors.border },
  actions: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 10, marginTop: 14 },
  badge: {
    alignSelf: "flex-start",
    minHeight: 24,
    justifyContent: "center",
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 3,
    marginBottom: 10,
  },
  badgeText: { fontSize: 14, lineHeight: 16, fontWeight: "500" },
  preview: { borderRadius: 6, overflow: "hidden" },
});
