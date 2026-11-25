import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Animated, Easing, PanResponder, Pressable, StyleSheet, View } from "react-native";

import { sheetSnap } from "../../../src/components/sheet-snap";
import { Touchable } from "../../ui/kit";
import { useReducedMotion } from "../../ui/reduced-motion";
import { useScreenBack } from "../../ui/screen-back";
import { useScreen } from "../../ui/screen-context";
import { colors } from "../../ui/theme";

/** The app header above the screen (native/ui/header.tsx). */
const HEADER_HEIGHT = 48;
/** The web's SNAP_TRANSITION: `height .24s cubic-bezier(.22,.61,.36,1)`. */
const SNAP = { duration: 240, easing: Easing.bezier(0.22, 0.61, 0.36, 1) };

/**
 * The web's FigmaSheet (src/components/figma-sheet.tsx, sharedStyles.figmaSheet*), drawn inside the
 * screen: a 721px panel at the bottom of the 844px canvas, 55px below the header, covering the
 * footer (the page drops the footer while a sheet is open). `px` scales design px like the screen.
 * `resizable` lets the top edge (the 44px drag handle over the grip) be dragged: released low it closes,
 * near the middle it rests at half the screen, higher it returns to full (src/components/sheet-snap.ts).
 */
export function AbyssSheet({
  title,
  px,
  resizable = false,
  onClose,
  children,
}: {
  title: string;
  px: (value: number) => number;
  resizable?: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const { topInset } = useScreen();
  // Back closes the sheet first, as Escape closes the web's sheet.
  useScreenBack(onClose);
  const top = HEADER_HEIGHT + px(55);
  const reduced = useReducedMotion();
  // The screen's height (the web's phone frame) and the panel's height while resized.
  const [frame, setFrame] = useState(0);
  const height = useRef(new Animated.Value(0)).current;
  const shown = useRef(0);
  // The height the sheet rests at: null is the full height.
  const resting = useRef<number | null>(null);
  const latest = useRef({ frame, full: Math.max(0, frame - top), reduced, onClose });
  latest.current = { frame, full: Math.max(0, frame - top), reduced, onClose };
  const full = latest.current.full;
  useEffect(() => {
    const id = height.addListener(({ value }) => {
      shown.current = value;
    });
    return () => height.removeListener(id);
  }, [height]);
  useEffect(() => {
    if (full > 0) height.setValue(Math.min(resting.current ?? full, full));
  }, [full, height]);
  // Size the panel in the same commit as the frame, so the first resized frame is not 0 high.
  const layout = (frameHeight: number) => {
    const fullHeight = Math.max(0, frameHeight - top);
    if (fullHeight > 0) height.setValue(Math.min(resting.current ?? fullHeight, fullHeight));
    setFrame(frameHeight);
  };

  const drag = useMemo(() => {
    let start = 0;
    let moved = false;
    const settle = (target: number, then?: () => void) => {
      height.stopAnimation();
      if (latest.current.reduced) {
        height.setValue(target);
        then?.();
        return;
      }
      Animated.timing(height, { toValue: target, useNativeDriver: false, ...SNAP }).start(
        ({ finished }) => finished && then?.(),
      );
    };
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        height.stopAnimation();
        start = shown.current;
        moved = false;
      },
      onPanResponderMove: (_, { dy }) => {
        if (!moved && Math.abs(dy) < 4) return;
        moved = true;
        height.setValue(Math.max(0, Math.min(latest.current.full, start - dy)));
      },
      onPanResponderRelease: () => {
        const { frame: screen, full: fullHeight, onClose: close } = latest.current;
        // A tap on the handle closes, as the grip always has.
        if (!moved) return close();
        const snap = sheetSnap(shown.current, screen);
        if (snap === "closed") return settle(0, close);
        resting.current = snap === "half" ? Math.round(screen / 2) : null;
        settle(resting.current ?? fullHeight);
      },
      onPanResponderTerminate: () =>
        settle(Math.min(resting.current ?? latest.current.full, latest.current.full)),
    });
  }, [height]);

  return (
    <View
      style={StyleSheet.absoluteFill}
      onLayout={(event) => layout(event.nativeEvent.layout.height)}
    >
      <Pressable
        // The backdrop also dims the space above the header, as the web's covers the whole canvas.
        style={[StyleSheet.absoluteFill, styles.backdrop, { top: -topInset }]}
        accessibilityRole="button"
        accessibilityLabel={`${title} 닫기`}
        onPress={onClose}
      />
      <Animated.View
        style={[
          styles.panel,
          resizable && full > 0 ? { height } : { top },
          {
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
        {resizable && (
          <View
            style={[styles.handle, { height: px(44) }]}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            {...drag.panHandlers}
          />
        )}
        <View style={styles.content}>{children}</View>
      </Animated.View>
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
    overflow: "hidden",
    backgroundColor: colors.bg,
  },
  grip: { backgroundColor: colors.surface },
  handle: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 1 },
  content: { flex: 1, alignSelf: "stretch" },
});
