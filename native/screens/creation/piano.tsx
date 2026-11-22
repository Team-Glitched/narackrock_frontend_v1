import { StyleSheet, Text, View } from "react-native";

import { useDevicePortrait } from "../../ui/use-device-portrait";
import { useScreen } from "../../ui/screen-context";
import { NoteControls, NoteRoll, NoteRollSheets } from "../editor/roll";
import { StudioCanvas, TimingSheet, InstrumentSheet } from "../studio/parts";
import { AddButton, StudioToolbar } from "../studio/toolbar";
import type { ScreenProps } from "../types";

/** The web's SourcePianoEditor (sample registration "피아노롤"), following the device orientation. */
export function CreationPianoScreen({ model }: ScreenProps<"creation-piano">) {
  const { act } = useScreen();
  const portrait = useDevicePortrait();
  return (
    <StudioCanvas>
      <View style={styles.studio}>
        <StudioToolbar
          transport={model.transport}
          title={model.title}
          timingEditable={!model.pending}
          instrument={
            model.instrumentLabel
              ? {
                  label: model.instrumentLabel,
                  onPress: () => act({ type: "creation-piano-instrument-open" }),
                }
              : undefined
          }
          onBack={() => act({ type: "creation-piano-back" })}
          onRewind={() => act({ type: "creation-piano-rewind" })}
        >
          <AddButton
            label={model.addLabel}
            disabled={model.pending}
            onPress={() => act({ type: "creation-piano-save" })}
          />
        </StudioToolbar>
        <NoteControls roll={model.roll} />
        <View style={styles.roll}>
          <NoteRoll roll={model.roll} rowHeight={portrait ? 40 : undefined} keyWidth={portrait ? 44 : undefined} />
        </View>
        {model.error ? (
          <Text accessibilityRole="alert" style={styles.banner}>
            {model.error}
          </Text>
        ) : (
          model.pending && (
            <Text accessibilityLiveRegion="polite" style={styles.banner}>
              오디오를 만드는 중...
            </Text>
          )
        )}
      </View>
      <NoteRollSheets roll={model.roll} />
      <TimingSheet sheet={model.timing} />
      <InstrumentSheet picker={model.instrumentPicker ?? null} />
    </StudioCanvas>
  );
}

const styles = StyleSheet.create({
  studio: { flex: 1, overflow: "hidden", backgroundColor: "#2a3035" },
  roll: { flex: 1 },
  banner: {
    position: "absolute",
    top: 44,
    left: 12,
    right: 12,
    zIndex: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: "#562a38",
    color: "#ffffff",
    fontSize: 14,
  },
});
