import { useEffect, useRef, type ReactNode } from "react";
import { BackHandler, Pressable, StyleSheet, View } from "react-native";

import { Touchable } from "../../ui/kit";
import { colors } from "../../ui/theme";

/** The app header above the screen (native/ui/header.tsx). */
const HEADER_HEIGHT = 48;

/**
 * The web's FigmaSheet (src/components/figma-sheet.tsx, sharedStyles.figmaSheet*), drawn inside the
 * screen: a 721px panel at the bottom of the 844px canvas, 55px below the header, covering the
 * footer (the page drops the footer while a sheet is open). `px` scales design px like the screen.
 */
export function AbyssSheet({
  title,
  px,
  onClose,
  children,
}: {
  title: string;
  px: (value: number) => number;
  onClose: () => void;
  children: ReactNode;
}) {
  // Back closes the sheet first, as Escape closes the web's sheet (the last listener runs first).
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      close.current();
      return true;
    });
    return () => subscription.remove();
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
        style={[
          styles.panel,
          {
            top: HEADER_HEIGHT + px(55),
            gap: px(30),
            paddingVertical: px(10),
            paddingHorizontal: px(20),
            borderTopLeftRadius: px(14),
            borderTopRightRadius: px(14),
          },
        ]}
        accessibilityViewIsModal
        accessibilityLabel={title}
      >
        <Touchable
          accessibilityRole="button"
          accessibilityLabel={`${title} 닫기`}
          hitSlop={{ top: px(10), bottom: px(10), left: px(20), right: px(20) }}
          style={[styles.grip, { width: px(50), height: px(4), borderRadius: px(20) }]}
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
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: "center",
    backgroundColor: colors.bg,
  },
  grip: { backgroundColor: colors.surface },
  content: { flex: 1, alignSelf: "stretch" },
});
