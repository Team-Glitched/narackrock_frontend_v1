import { StyleSheet, Text, View } from "react-native";

import { Touchable } from "../../ui/kit";
import { LoadingOverlay } from "../../ui/loading-overlay";
import { useDevicePortrait } from "../../ui/use-device-portrait";
import { OrientationFab } from "../../ui/orientation-fab";
import { useScreen } from "../../ui/screen-context";
import { colors } from "../../ui/theme";
import { NoteControls, NoteRoll, NoteRollSheets } from "../editor/roll";
import { StudioCanvas, TimingSheet, InstrumentSheet } from "../studio/parts";
import { AddButton, StudioToolbar } from "../studio/toolbar";
import type { ScreenProps } from "../types";

/** The web's SourcePianoEditor (sample registration "피아노롤"), following the device orientation. */
export function CreationPianoScreen({ model }: ScreenProps<"creation-piano">) {
  const { act } = useScreen();
  const portrait = useDevicePortrait();
  const busy = model.pending || model.importing;
  return (
    <StudioCanvas>
      <View style={styles.studio}>
        <StudioToolbar
          transport={model.transport}
          title={model.title}
          timingEditable={!busy}
          piano
          instrument={
            model.instrumentLabel
              ? {
                  label: model.instrumentLabel,
                  onPress: () => act({ type: "creation-piano-instrument-open" }),
                  disabled: model.pending,
                }
              : undefined
          }
          onBack={() => act({ type: "creation-piano-back" })}
          onRewind={() => act({ type: "creation-piano-rewind" })}
        >
          <AddButton
            label={model.addLabel}
            disabled={busy}
            onPress={() => act({ type: "creation-piano-save" })}
          />
        </StudioToolbar>
        <NoteControls roll={model.roll} />
        <View style={styles.status}>
          {model.error ? (
            <Text accessibilityRole="alert" style={styles.statusText}>
              {model.error}
            </Text>
          ) : (
            <Text accessibilityLiveRegion="polite" style={styles.statusText}>
              {model.importing
                ? "JSON 파일을 읽는 중..."
                : model.pending
                  ? "오디오를 만드는 중..."
                  : `${model.noteCount}개 노트`}
            </Text>
          )}
          <Touchable
            accessibilityRole="button"
            accessibilityState={{ disabled: busy }}
            disabled={busy}
            style={[styles.jsonButton, busy && styles.disabled]}
            onPress={() => act({ type: "creation-piano-import-json" })}
          >
            <Text style={styles.jsonButtonText}>+ JSON으로 추가</Text>
          </Touchable>
        </View>
        <View style={styles.roll}>
          <NoteRoll roll={model.roll} rowHeight={portrait ? 40 : undefined} keyWidth={portrait ? 44 : undefined} />
        </View>
        <OrientationFab />
      </View>
      <NoteRollSheets roll={model.roll} />
      <TimingSheet sheet={model.timing} />
      <InstrumentSheet picker={model.instrumentPicker ?? null} />
      {busy && (
        <LoadingOverlay message={model.importing ? "JSON 파일을 읽는 중입니다." : "오디오를 만드는 중입니다."} />
      )}
    </StudioCanvas>
  );
}

const styles = StyleSheet.create({
  studio: { flex: 1, overflow: "hidden", backgroundColor: colors.bg },
  roll: { flex: 1 },
  status: {
    minHeight: 36,
    flexShrink: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#2b2b34",
    backgroundColor: "#19191f",
  },
  statusText: { flex: 1, minWidth: 0, color: colors.muted, fontSize: 13, lineHeight: 16 },
  jsonButton: {
    height: 28,
    flexShrink: 0,
    justifyContent: "center",
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#32323d",
    backgroundColor: "#23232a",
  },
  jsonButtonText: { color: colors.fg, fontSize: 12, lineHeight: 16, fontWeight: "500" },
  disabled: { opacity: 0.5 },
});
