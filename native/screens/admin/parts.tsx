import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Button, Touchable } from "../../ui/kit";
import { colors, gutter, type } from "../../ui/theme";

/** The web's bordered workspace card (workspaceStyles.workspaceCard). */
export function Card({ children }: { children: ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

/** Card heading (workspaceCard h2). */
export function CardTitle({ children }: { children: string }) {
  return (
    <Text style={[type.label, styles.cardTitle]} accessibilityRole="header">
      {children}
    </Text>
  );
}

/** The web's row of rounded card buttons (workspaceStyles.workspaceActions). */
export function CardActions({ children }: { children: ReactNode }) {
  return <View style={styles.actions}>{children}</View>;
}

export function CardButton({
  label,
  accessibilityLabel,
  primary = false,
  disabled = false,
  onPress,
}: {
  label: string;
  /** Spoken label when it differs from the visible one (the web's `aria-label`). */
  accessibilityLabel?: string;
  primary?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Touchable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      style={[styles.cardButton, primary && styles.primary, disabled && styles.disabled]}
      onPress={onPress}
    >
      <Text style={[styles.cardButtonText, primary && styles.primaryText]}>{label}</Text>
    </Touchable>
  );
}

/** Full-width rounded button with left-aligned text (workspaceStyles.workspaceWide). */
export function WideButton({
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
      <Text style={styles.wideText}>{label}</Text>
    </Touchable>
  );
}

/** Small pill toggles (workspaceStyles.workspaceTabs, aria-pressed buttons). */
export function Pills<T extends string>({
  options,
  value,
  label,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  label?: string;
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.pills} accessibilityLabel={label}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Touchable
            key={option.value}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            style={[styles.pill, selected && styles.pillSelected]}
            onPress={() => onChange(option.value)}
          >
            <Text style={[styles.pillText, selected && styles.pillTextSelected]}>
              {option.label}
            </Text>
          </Touchable>
        );
      })}
    </View>
  );
}

/** Centered page message (src/components/page-state.tsx PageState). */
export function PageState({ children, error = false }: { children: ReactNode; error?: boolean }) {
  return (
    <View style={styles.pageState} accessibilityRole={error ? "alert" : undefined}>
      {children}
    </View>
  );
}

export function PageStateText({ children, error = false }: { children: string; error?: boolean }) {
  return <Text style={[styles.pageStateText, error && styles.error]}>{children}</Text>;
}

/** The web's SignInRequired: the notice and a 로그인 button that opens the login prompt. */
export function SignInRequired({ text, onSignIn }: { text: string; onSignIn: () => void }) {
  return (
    <PageState>
      <PageStateText>{text}</PageStateText>
      <Button label="로그인" onPress={onSignIn} />
    </PageState>
  );
}

/** A plain muted line of a list section, or an alert in the error color. */
export function Line({ children, error = false }: { children: string; error?: boolean }) {
  return (
    <Text
      accessibilityRole={error ? "alert" : undefined}
      style={[type.muted, styles.line, error && styles.error]}
    >
      {children}
    </Text>
  );
}

export const adminStyles = StyleSheet.create({
  body: { paddingHorizontal: gutter, gap: 12 },
  title: { marginBottom: 4 },
});

const styles = StyleSheet.create({
  card: {
    padding: 16,
    gap: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTitle: { marginVertical: 2 },
  actions: { marginTop: 8, flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 10 },
  cardButton: {
    minHeight: 40,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  cardButtonText: { color: colors.fg, fontSize: 14, lineHeight: 20, fontWeight: "500" },
  primary: { backgroundColor: colors.primary },
  primaryText: { fontSize: 16 },
  disabled: { opacity: 0.5 },
  wide: {
    minHeight: 44,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  wideText: { color: colors.fg, fontSize: 16, lineHeight: 20, fontWeight: "500" },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingVertical: 4 },
  pill: {
    minHeight: 28,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  pillSelected: { borderColor: colors.primary, backgroundColor: colors.primary },
  pillText: { color: colors.muted, fontSize: 14, lineHeight: 18, fontWeight: "500" },
  pillTextSelected: { color: colors.fg },
  pageState: {
    minHeight: 280,
    paddingHorizontal: gutter,
    paddingVertical: 48,
    gap: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  pageStateText: { color: colors.muted, fontSize: 16, lineHeight: 24, textAlign: "center" },
  line: { paddingVertical: 4 },
  error: { color: colors.error },
});
