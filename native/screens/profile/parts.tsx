import { useMemo, useRef, useState, type ReactNode } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { NativeCommonAction } from "../../../src/lib/native-screens";
import { ContentMenu } from "../../ui/content-menu";
import { Touchable } from "../../ui/kit";
import { ScreenContext, useScreen, type MenuTarget } from "../../ui/screen-context";
import { ScreenModal } from "../../ui/screen-modal";
import { colors, gutter, type } from "../../ui/theme";

/** The web's preference row: title, description, and a switch (preferenceRow / preferenceSwitch). */
export function PreferenceRow({
  title,
  description,
  value,
  disabled = false,
  large = false,
  alert,
  onChange,
}: {
  title: string;
  description: string;
  value: boolean;
  disabled?: boolean;
  /** Title in the 20px title style (the profile's privacy row). */
  large?: boolean;
  /** Error under the description. */
  alert?: string | null;
  onChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.preference}>
      <View style={styles.preferenceCopy}>
        <Text style={large ? type.title : styles.preferenceTitle}>{title}</Text>
        <Text style={type.muted}>{description}</Text>
        {alert && (
          <Text accessibilityRole="alert" style={[type.body, { color: colors.error }]}>
            {alert}
          </Text>
        )}
      </View>
      <Switch
        accessibilityLabel={title}
        value={value}
        disabled={disabled}
        onValueChange={onChange}
        trackColor={{ false: colors.line, true: colors.primary }}
        thumbColor={colors.fg}
        style={disabled && styles.disabled}
      />
    </View>
  );
}

type MenuAction = Extract<NativeCommonAction, { type: "share" | "report" }>;

/**
 * A bottom sheet over the screen (the web's FigmaSheet). Card ⋯ menus opened inside it are drawn
 * inside the sheet's modal: iOS cannot present the screen's own menu modal while this one is up.
 * A chosen menu action closes the sheet first: report opens the app's root dialog, and share may
 * too (the login prompt, a failed share's alert), which iOS cannot present over this modal either.
 * On iOS the sheet hides only once the menu it presented has finished dismissing (hiding both at
 * once would leave this modal up, empty), and the action goes to the page once the sheet is gone.
 */
export function Sheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const { bottom } = useSafeAreaInsets();
  const screen = useScreen();
  const [menu, setMenu] = useState<MenuTarget | null>(null);
  const [pending, setPending] = useState<MenuAction | null>(null);
  const chosen = useRef<MenuAction | null>(null);
  const context = useMemo(() => ({ ...screen, openMenu: setMenu }), [screen]);
  const forward = (action: MenuAction) => {
    screen.act(action);
    onClose();
  };
  return (
    <ScreenModal
      visible={pending === null}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      onDismiss={() => {
        if (pending) forward(pending);
      }}
      statusBarTranslucent
    >
      <View style={styles.sheetRoot}>
        <Pressable
          style={StyleSheet.absoluteFill}
          accessibilityRole="button"
          accessibilityLabel="닫기"
          onPress={onClose}
        />
        <View style={[styles.sheet, { paddingBottom: bottom + 24 }]} accessibilityViewIsModal>
          <Touchable
            accessibilityRole="button"
            accessibilityLabel={`${title} 닫기`}
            style={styles.grip}
            onPress={onClose}
          >
            <View style={styles.gripBar} />
          </Touchable>
          <ScrollView contentContainerStyle={styles.sheetBody} keyboardShouldPersistTaps="handled">
            <ScreenContext value={context}>{children}</ScreenContext>
          </ScrollView>
        </View>
        <ContentMenu
          target={menu}
          canReport={menu !== null && menu.ownerId !== screen.session.userId}
          onClose={() => setMenu(null)}
          onChoose={(type, target) => {
            const action: MenuAction = { type, kind: target.kind, id: target.id, title: target.title };
            // Android stacks the root dialog over this one; only iOS must wait for the dismissals.
            if (Platform.OS === "ios") chosen.current = action;
            else forward(action);
          }}
          onDismiss={() => {
            const action = chosen.current;
            chosen.current = null;
            if (action) setPending(action);
          }}
        />
      </View>
    </ScreenModal>
  );
}

/** Centered message block with an optional action (the web's my-auto empty/error states). */
export function CenterMessage({
  children,
  tone = "muted",
  action,
}: {
  children: string;
  tone?: "muted" | "error";
  action?: ReactNode;
}) {
  return (
    <View style={styles.center}>
      <Text
        accessibilityRole={tone === "error" ? "alert" : undefined}
        style={[styles.centerText, tone === "error" && { color: colors.error }]}
      >
        {children}
      </Text>
      {action}
    </View>
  );
}

/** Bordered notice line (error or info) under a page title. */
export function Notice({ children, tone }: { children: string; tone: "muted" | "error" }) {
  return (
    <Text
      accessibilityRole={tone === "error" ? "alert" : undefined}
      style={[styles.notice, tone === "error" && { color: colors.error }]}
    >
      {children}
    </Text>
  );
}

/** The web's small filter pill (filterChip): filled with the primary color when pressed. */
export function FilterChip({
  label,
  pressed,
  disabled = false,
  onPress,
}: {
  label: string;
  pressed: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Touchable
      accessibilityRole="button"
      accessibilityState={{ selected: pressed, disabled }}
      disabled={disabled}
      style={[styles.chip, pressed && styles.chipPressed, disabled && styles.disabled]}
      onPress={onPress}
    >
      <Text style={[styles.chipText, pressed && { color: colors.fg }]}>{label}</Text>
    </Touchable>
  );
}

export const styles = StyleSheet.create({
  disabled: { opacity: 0.5 },
  chip: {
    minHeight: 28,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: "center",
  },
  chipPressed: { borderColor: colors.primary, backgroundColor: colors.primary },
  chipText: { color: colors.muted, fontSize: 14, lineHeight: 18, fontWeight: "500" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  preference: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    paddingVertical: 12,
  },
  preferenceCopy: { flex: 1, gap: 6 },
  preferenceTitle: { color: colors.fg, fontSize: 16, lineHeight: 24, fontWeight: "500" },
  sheetRoot: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0, 0, 0, 0.5)" },
  sheet: {
    maxHeight: "85%",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    backgroundColor: colors.bg,
  },
  grip: { height: 28, alignItems: "center", justifyContent: "center" },
  gripBar: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.line },
  sheetBody: { paddingHorizontal: gutter, paddingTop: 8 },
  center: {
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    paddingHorizontal: gutter,
    paddingVertical: 48,
  },
  centerText: { color: colors.muted, fontSize: 16, lineHeight: 24, textAlign: "center" },
  notice: {
    marginHorizontal: gutter,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.muted,
    fontSize: 16,
    lineHeight: 24,
  },
});
