import { StyleSheet } from "react-native";
import Svg, { Path } from "react-native-svg";

import { Touchable } from "./kit";
import { useScreen } from "./screen-context";
import { useDevicePortrait } from "./use-device-portrait";

/** Floating bottom-right button that switches native composition canvases between portrait and landscape. */
export function OrientationFab() {
  const { toggleOrientation } = useScreen();
  const portrait = useDevicePortrait();
  const label = portrait ? "가로 모드로 전환" : "세로 모드로 전환";
  return (
    <Touchable
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[
        styles.button,
        styles.anchor,
        portrait ? styles.portraitSize : styles.landscapeSize,
      ]}
      onPress={toggleOrientation}
    >
      <Svg
        width={portrait ? 24 : 22}
        height={portrait ? 24 : 22}
        viewBox="0 0 24 24"
        fill="none"
        stroke="#f2f4f6"
        strokeWidth={2.05}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <Path d="M5.42 8.54 8.54 5.42a1.8 1.8 0 0 1 2.54 0l7.5 7.5a1.8 1.8 0 0 1 0 2.54l-3.12 3.12a1.8 1.8 0 0 1-2.54 0l-7.5-7.5a1.8 1.8 0 0 1 0-2.54Z" />
        <Path d="M20.46 9.25A8.9 8.9 0 0 0 14.75 3.54" />
        <Path d="M17.03 2.52 14.75 3.54 16 5.71" />
        <Path d="M3.54 14.75A8.9 8.9 0 0 0 9.25 20.46" />
        <Path d="M6.97 21.48 9.25 20.46 8 18.29" />
      </Svg>
    </Touchable>
  );
}

const styles = StyleSheet.create({
  button: {
    position: "absolute",
    zIndex: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#23232a",
    borderWidth: 1,
    borderColor: "#32323d",
    elevation: 6,
    shadowColor: "#000000",
    shadowOpacity: 0.42,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  portraitSize: { width: 48, height: 48, borderRadius: 24 },
  landscapeSize: { width: 44, height: 44, borderRadius: 22 },
  anchor: { right: 16, bottom: 16 },
});
