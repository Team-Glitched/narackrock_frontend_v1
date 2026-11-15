import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type PressableProps,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from "react-native";
import Svg, { Circle, Path } from "react-native-svg";

import MoreIcon from "../../public/figma/post-more.svg";
import { colors, gutter, ripple, type } from "./theme";

/** Pressable with the platform's press feedback: ripple on Android, dimming on iOS. */
export function Touchable({ style, ...props }: PressableProps & { style?: StyleProp<ViewStyle> }) {
  return (
    <Pressable
      android_ripple={ripple}
      style={({ pressed }) => [style, pressed && Platform.OS === "ios" && styles.pressed]}
      {...props}
    />
  );
}

/** A titled block with the web's "모두보기" link. */
export function Section({
  title,
  onAll,
  allLabel = "모두보기",
  children,
}: {
  title: string;
  onAll?: () => void;
  allLabel?: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionTitleRow}>
        <Text style={[type.title, styles.flex]} numberOfLines={1} accessibilityRole="header">
          {title}
        </Text>
        {onAll && (
          <Touchable
            accessibilityRole="button"
            accessibilityLabel={`${title} ${allLabel}`}
            hitSlop={8}
            onPress={onAll}
          >
            <Text style={styles.sectionAll}>{allLabel}</Text>
          </Touchable>
        )}
      </View>
      {children}
    </View>
  );
}

/** Loading / empty / error line in place of a list. */
export function Status({
  children,
  tone = "muted",
}: {
  children: string;
  tone?: "muted" | "error";
}) {
  return (
    <Text
      accessibilityRole={tone === "error" ? "alert" : undefined}
      style={[styles.status, tone === "error" && { color: colors.error }]}
    >
      {children}
    </Text>
  );
}

/** Error message with the web's "다시 시도" button. */
export function ErrorRetry({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <View style={styles.errorBox} accessibilityRole="alert">
      <Text style={[type.body, { color: colors.error }]}>{message}</Text>
      <Button label="다시 시도" tone="secondary" onPress={onRetry} />
    </View>
  );
}

export function Button({
  label,
  tone = "primary",
  disabled = false,
  busy = false,
  style,
  onPress,
}: {
  label: string;
  tone?: "primary" | "secondary" | "danger";
  disabled?: boolean;
  busy?: boolean;
  style?: StyleProp<ViewStyle>;
  onPress: () => void;
}) {
  return (
    <Touchable
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || busy, busy }}
      disabled={disabled || busy}
      style={[
        styles.button,
        tone === "secondary" && styles.buttonSecondary,
        tone === "danger" && styles.buttonDanger,
        (disabled || busy) && styles.disabled,
        style,
      ]}
      onPress={onPress}
    >
      {busy ? (
        <ActivityIndicator color={colors.fg} />
      ) : (
        <Text style={styles.buttonText}>{label}</Text>
      )}
    </Touchable>
  );
}

/** Underlined tab row (the web's tab headers). */
export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.tabs} accessibilityRole="tablist">
      {tabs.map((tab) => {
        const selected = tab.value === value;
        return (
          <Touchable
            key={tab.value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            style={[styles.tab, selected && styles.tabSelected]}
            onPress={() => onChange(tab.value)}
          >
            <Text style={[styles.tabText, selected && styles.tabTextSelected]} numberOfLines={1}>
              {tab.label}
            </Text>
          </Touchable>
        );
      })}
    </View>
  );
}

/** Rounded filter chips (the web's filterChip). */
export function Chips<T extends string>({
  chips,
  value,
  onChange,
}: {
  chips: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.chips}>
      {chips.map((chip) => {
        const selected = chip.value === value;
        return (
          <Touchable
            key={chip.value}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            style={[styles.chip, selected && styles.chipSelected]}
            onPress={() => onChange(chip.value)}
          >
            <Text style={[type.body, selected && { fontWeight: "600" }]}>{chip.label}</Text>
          </Touchable>
        );
      })}
    </View>
  );
}

export function TextField({ style, ...props }: TextInputProps) {
  return (
    <TextInput
      placeholderTextColor="#9692a6"
      selectionColor={colors.accent}
      style={[styles.input, props.multiline && styles.inputMultiline, style]}
      {...props}
    />
  );
}

export function Avatar({ uri, size }: { uri: string | null; size: number }) {
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
      {uri ? (
        <Image source={{ uri }} style={StyleSheet.absoluteFill} accessibilityLabel="프로필" />
      ) : (
        // The web's fallback: a person outline (lucide UserRound) on grey.
        <Svg
          width={size * 0.58}
          height={size * 0.58}
          viewBox="0 0 24 24"
          fill="none"
          stroke="#ffffff"
          strokeWidth={2}
          accessibilityLabel="프로필"
        >
          <Circle cx={12} cy={8} r={5} />
          <Path d="M20 21a8 8 0 0 0-16 0" strokeLinecap="round" />
        </Svg>
      )}
    </View>
  );
}

export function MoreButton({
  label,
  style,
  onPress,
}: {
  label: string;
  style?: StyleProp<ViewStyle>;
  onPress: () => void;
}) {
  return (
    <Touchable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      style={[styles.more, style]}
      onPress={onPress}
    >
      <MoreIcon width={20} height={20} />
    </Touchable>
  );
}

/** Next-page footer of a paged list: spinner, retry, or nothing. */
export function PagingFooter({
  appending,
  appendFailed,
  onMore,
}: {
  appending: boolean;
  appendFailed: boolean;
  onMore: () => void;
}) {
  if (appending) return <ActivityIndicator style={styles.paging} color={colors.muted} />;
  if (appendFailed)
    return (
      <View style={styles.paging}>
        <Button label="다시 시도" tone="secondary" onPress={onMore} />
      </View>
    );
  return null;
}

export const styles = StyleSheet.create({
  flex: { flex: 1 },
  pressed: { opacity: 0.6 },
  disabled: { opacity: 0.4 },
  section: { marginBottom: 32 },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: gutter,
    marginBottom: 16,
  },
  sectionAll: { color: colors.muted, fontSize: 16, lineHeight: 20, fontWeight: "500" },
  status: {
    paddingHorizontal: gutter,
    paddingVertical: 32,
    textAlign: "center",
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  errorBox: {
    marginHorizontal: gutter,
    marginVertical: 16,
    padding: 16,
    gap: 12,
    borderRadius: 10,
    backgroundColor: colors.panel,
  },
  button: {
    minHeight: 44,
    paddingHorizontal: 18,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
  },
  buttonSecondary: { backgroundColor: colors.surface },
  buttonDanger: { backgroundColor: colors.danger },
  buttonText: { color: colors.fg, fontSize: 15, fontWeight: "600" },
  tabs: {
    flexDirection: "row",
    marginHorizontal: gutter,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  tab: {
    flex: 1,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabSelected: { borderBottomColor: colors.primary },
  tabText: { color: colors.muted, fontSize: 16, fontWeight: "500" },
  tabTextSelected: { color: colors.fg, fontWeight: "700" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: gutter },
  chip: {
    height: 34,
    paddingHorizontal: 14,
    borderRadius: 17,
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipSelected: { borderColor: colors.primary, backgroundColor: "#1e004a" },
  input: {
    minHeight: 44,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    color: colors.fg,
    fontSize: 16,
    backgroundColor: colors.surface,
  },
  inputMultiline: { minHeight: 96, textAlignVertical: "top" },
  avatar: {
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#949494",
  },
  more: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  paging: { paddingVertical: 20, paddingHorizontal: gutter },
});
