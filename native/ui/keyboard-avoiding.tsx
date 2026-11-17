/**
 * A flex container whose bottom padding keeps its content (a composer) above the software keyboard.
 *
 * React Native's KeyboardAvoidingView compares its frame relative to its parent with the keyboard's
 * window position, so it under-pads by the parent's distance from the window top (the safe area, a
 * sheet's top), and edge-to-edge Android does not resize the window for the keyboard. This measures
 * the container in the window instead, on every keyboard change and every layout (a sheet that
 * grows when the tab bar steps aside).
 */
import { useEffect, useRef, useState, type ComponentRef, type ReactNode } from "react";
import {
  Keyboard,
  LayoutAnimation,
  Platform,
  View,
  type KeyboardEvent,
  type StyleProp,
  type ViewStyle,
} from "react-native";

export function KeyboardAvoiding({
  style,
  children,
}: {
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const ref = useRef<ComponentRef<typeof View>>(null);
  /** The keyboard's top edge in window coordinates; null while it is hidden. */
  const keyboardTop = useRef<number | null>(null);
  const [padding, setPadding] = useState(0);

  function update(event?: KeyboardEvent) {
    const top = keyboardTop.current;
    ref.current?.measureInWindow((_x, y, _width, height) => {
      const next = top === null ? 0 : Math.max(0, y + height - top);
      if (event && event.duration > 0 && Platform.OS === "ios") {
        LayoutAnimation.configureNext({
          duration: event.duration,
          update: {
            duration: event.duration,
            type: LayoutAnimation.Types[event.easing] ?? "keyboard",
          },
        });
      }
      setPadding(next);
    });
  }

  useEffect(() => {
    const ios = Platform.OS === "ios";
    const shown = Keyboard.addListener(
      ios ? "keyboardWillChangeFrame" : "keyboardDidShow",
      (event) => {
        keyboardTop.current = event.endCoordinates.screenY;
        update(event);
      },
    );
    const hidden = Keyboard.addListener(ios ? "keyboardWillHide" : "keyboardDidHide", (event) => {
      keyboardTop.current = null;
      update(event);
    });
    return () => {
      shown.remove();
      hidden.remove();
    };
  }, []);

  return (
    <View ref={ref} style={[style, { paddingBottom: padding }]} onLayout={() => update()}>
      {children}
    </View>
  );
}
