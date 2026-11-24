import { StyleSheet, Text, View } from "react-native";

import { Touchable } from "../../ui/kit";
import { useScreen } from "../../ui/screen-context";
import { colors } from "../../ui/theme";

/** Shared top BPM & time signature readout bar matching Native StudioToolbar. */
export function CreationTimingBar({
  bpm,
  timeSignature,
  timingMode = "locked",
  disabled = false,
}: {
  bpm: number;
  timeSignature: string;
  timingMode?: "initial" | "editable" | "locked";
  disabled?: boolean;
}) {
  const { act } = useScreen();
  const editable = timingMode !== "locked";

  return (
    <View style={styles.row}>
      {editable ? (
        <>
          <Touchable
            accessibilityRole="button"
            accessibilityLabel="bpm 설정"
            accessibilityState={{ disabled }}
            disabled={disabled}
            style={[styles.pill, disabled && styles.disabled]}
            onPress={() => act({ type: "timing-open", kind: "bpm" })}
          >
            <Text style={styles.small}>bpm</Text>
            <Text style={styles.value}>{bpm}</Text>
          </Touchable>
          <Touchable
            accessibilityRole="button"
            accessibilityLabel="박자 설정"
            accessibilityState={{ disabled }}
            disabled={disabled}
            style={[styles.pill, disabled && styles.disabled]}
            onPress={() => act({ type: "timing-open", kind: "beat" })}
          >
            <Text style={styles.small}>beat</Text>
            <Text style={styles.value}>{timeSignature}</Text>
          </Touchable>
        </>
      ) : (
        <>
          <View style={styles.pill}>
            <Text style={styles.small}>bpm</Text>
            <Text style={styles.value}>{bpm}</Text>
          </View>
          <View style={styles.pill}>
            <Text style={styles.small}>beat</Text>
            <Text style={styles.value}>{timeSignature}</Text>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  pill: {
    height: 36,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#32323d",
    backgroundColor: "#23232a",
    paddingHorizontal: 11,
  },
  small: {
    color: colors.muted,
    fontSize: 12,
  },
  value: {
    color: colors.fg,
    fontSize: 14,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  disabled: {
    opacity: 0.5,
  },
});
