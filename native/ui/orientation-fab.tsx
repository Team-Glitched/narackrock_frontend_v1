import { StyleSheet } from "react-native";
import Svg, { Path, Rect } from "react-native-svg";

import { Touchable } from "./kit";
import { useScreen } from "./screen-context";
import { useDevicePortrait } from "./use-device-portrait";

/** Floating bottom-right button that switches native composition canvases between portrait and landscape. */
export function OrientationFab({ alignedWithTransport = false }: { alignedWithTransport?: boolean }) {
  const { toggleOrientation } = useScreen();
  const portrait = useDevicePortrait();
  const label = portrait ? "가로 모드로 전환" : "세로 모드로 전환";
  return (
    <Touchable
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[
        styles.button,
        portrait
          ? [styles.portraitSize, alignedWithTransport ? styles.transportAnchor : styles.portraitAnchor]
          : [styles.landscapeSize, styles.landscapeAnchor],
      ]}
      onPress={toggleOrientation}
    >
      <Svg
        width={22}
        height={22}
        viewBox="0 0 24 24"
        fill="none"
        stroke="#f2f4f6"
        strokeWidth={1.85}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {portrait ? (
          <>
            <Rect x={3} y={10} width={14.5} height={10} rx={2.2} />
            <Path d="M14.8 13.7v2.6" />
            <Path d="M9 4.5a8.86 8.86 0 0 1 11.2 6.8" />
            <Path d="M17.9 9.7 20.2 11.3 21.7 8.8" />
          </>
        ) : (
          <>
            <Rect x={4} y={6.5} width={10} height={14.5} rx={2.2} />
            <Path d="M7.7 18.3h2.6" />
            <Path d="M19.7 14.2a8.86 8.86 0 0 0-7-10.4" />
            <Path d="M15.2 2.4 12.7 3.8 14.4 6.1" />
          </>
        )}
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
    backgroundColor: "#241e33",
    borderWidth: 1,
    borderColor: "rgba(153, 102, 255, 0.45)",
    elevation: 6,
    shadowColor: "#000000",
    shadowOpacity: 0.42,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  portraitSize: { width: 48, height: 48, borderRadius: 24 },
  landscapeSize: { width: 44, height: 44, borderRadius: 22 },
  portraitAnchor: { right: 20, bottom: 20 },
  transportAnchor: { right: 16, bottom: 32 },
  landscapeAnchor: { right: 16, bottom: 16 },
});
