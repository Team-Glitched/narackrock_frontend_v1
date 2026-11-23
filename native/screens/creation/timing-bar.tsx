import { StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";

import { Touchable } from "../../ui/kit";
import { useScreen } from "../../ui/screen-context";
import { colors } from "../../ui/theme";

/** Small pencil glyph matching web's CreationTimingBar readout. */
function EditPencil() {
  return (
    <Svg width={11} height={11} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"
        stroke="#a78bfa"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** Shared top BPM & time signature readout/editor bar for Native Record and Upload screens. */
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
      <View style={styles.pills}>
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
              <EditPencil />
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
              <EditPencil />
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
      {timingMode === "initial" ? (
        <View style={[styles.badge, styles.badgeInitial]}>
          <Text style={styles.badgeInitialText}>박자 · BPM 설정</Text>
        </View>
      ) : timingMode === "locked" ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>참여 곡 기준</Text>
        </View>
      ) : (
        <Text style={styles.hint}>탭하여 변경</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  pills: {
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
  badge: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#32323d",
    backgroundColor: "#1e1e26",
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeInitial: {
    borderColor: "rgba(76, 0, 229, 0.45)",
    backgroundColor: "rgba(76, 0, 229, 0.18)",
  },
  badgeInitialText: {
    color: "#c4b5fd",
    fontSize: 11,
    fontWeight: "600",
  },
  badgeText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "500",
  },
  hint: {
    color: colors.muted,
    fontSize: 11,
  },
  disabled: {
    opacity: 0.5,
  },
});
