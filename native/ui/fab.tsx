import { StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";

import { Touchable } from "./kit";
import { useScreen } from "./screen-context";
import { colors } from "./theme";

/** The web's floating create button (ContextualCreate), kept above the tab bar. */
export function Fab({ label, onPress }: { label: string; onPress: () => void }) {
  const { bottomInset } = useScreen();
  return (
    <View style={[styles.anchor, { bottom: bottomInset + 20 }]} pointerEvents="box-none">
      <Touchable
        accessibilityRole="button"
        accessibilityLabel={label}
        style={styles.fab}
        onPress={onPress}
      >
        <Svg
          width={22}
          height={22}
          viewBox="0 0 24 24"
          fill="none"
          stroke={colors.fg}
          strokeWidth={2}
        >
          <Path d="M12 5v14M5 12h14" strokeLinecap="round" />
        </Svg>
        <Text style={styles.label}>{label}</Text>
      </Touchable>
    </View>
  );
}

const styles = StyleSheet.create({
  anchor: { position: "absolute", right: 20 },
  fab: {
    height: 50,
    paddingHorizontal: 20,
    borderRadius: 25,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.primary,
    overflow: "hidden",
    elevation: 6,
  },
  label: { color: colors.fg, fontSize: 18, fontWeight: "600" },
});
