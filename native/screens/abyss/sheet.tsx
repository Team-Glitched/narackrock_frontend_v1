import { useEffect, useState, type ReactNode } from "react";
import { Keyboard, Pressable, StyleSheet, View } from "react-native";

import { Touchable } from "../../ui/kit";
import { useScreen } from "../../ui/screen-context";
import { colors } from "../../ui/theme";

/**
 * The web's FigmaSheet drawn inside the screen (not a Modal), so it hides with the screen while a web
 * modal it opens (login prompt, report sheet) is up. It stops above the tab bar, which stays on top.
 */
export function AbyssSheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const { bottomInset } = useScreen();
  // The tab bar steps aside while the keyboard is up; the sheet then reaches the bottom.
  const [keyboard, setKeyboard] = useState(false);
  useEffect(() => {
    const shown = Keyboard.addListener("keyboardDidShow", () => setKeyboard(true));
    const hidden = Keyboard.addListener("keyboardDidHide", () => setKeyboard(false));
    return () => {
      shown.remove();
      hidden.remove();
    };
  }, []);
  return (
    <View style={StyleSheet.absoluteFill}>
      <Pressable
        style={[StyleSheet.absoluteFill, styles.backdrop]}
        accessibilityRole="button"
        accessibilityLabel={`${title} 닫기`}
        onPress={onClose}
      />
      <View
        style={[styles.panel, { bottom: keyboard ? 0 : bottomInset }]}
        accessibilityViewIsModal
        accessibilityLabel={title}
      >
        <Touchable
          accessibilityRole="button"
          accessibilityLabel={`${title} 닫기`}
          hitSlop={{ top: 10, bottom: 10, left: 20, right: 20 }}
          style={styles.grip}
          onPress={onClose}
        />
        <View style={styles.content}>{children}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { backgroundColor: "rgba(0, 0, 0, 0.4)" },
  panel: {
    position: "absolute",
    top: "15%",
    left: 0,
    right: 0,
    alignItems: "center",
    gap: 30,
    paddingTop: 10,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    backgroundColor: colors.bg,
  },
  grip: { width: 50, height: 4, borderRadius: 20, backgroundColor: colors.surface },
  content: { flex: 1, alignSelf: "stretch" },
});
