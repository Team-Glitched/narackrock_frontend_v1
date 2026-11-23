import { StyleSheet, Text, View } from "react-native";

import UploadIcon from "../../../public/figma/audio-upload-large.svg";
import { AppHeader } from "../../ui/header";
import { Touchable } from "../../ui/kit";
import { ScreenScroll } from "../../ui/screen";
import { useScreen } from "../../ui/screen-context";
import { colors } from "../../ui/theme";
import { InstrumentSheet, TimingSheet } from "../studio/parts";
import type { ScreenProps } from "../types";
import { CreationTimingBar } from "./timing-bar";
import { AudioTrim } from "./trim";

/** Unified Native Upload Screen matching CreationRecordScreen. */
export function CreationUploadScreen({ model, header }: ScreenProps<"creation-upload">) {
  const { act } = useScreen();
  const hasAudio = model.trim !== null;
  const bpm = model.bpm ?? 120;
  const timeSignature = model.timeSignature ?? "4/4";

  return (
    <>
      {header && <AppHeader header={header} />}
      <ScreenScroll>
        <View style={styles.view}>
          <CreationTimingBar
            bpm={bpm}
            timeSignature={timeSignature}
            timingMode={model.timingMode}
          />
          {model.error && (
            <Text accessibilityRole="alert" style={styles.error}>
              {model.error}
            </Text>
          )}
          {!hasAudio ? (
            <Touchable
              accessibilityRole="button"
              accessibilityLabel={model.fileName ?? "업로드 파일 선택"}
              style={styles.dropzone}
              onPress={() => act({ type: "creation-upload-pick" })}
            >
              <View style={styles.iconCircle}>
                <UploadIcon width={32} height={30} />
              </View>
              <View style={styles.copy}>
                <Text style={styles.title}>오디오 파일 업로드</Text>
                <Text style={styles.subtitle}>WAV, MP3, M4A, FLAC · 박자에 맞춰 자르고 이어 붙이기</Text>
              </View>
              <View style={styles.pickPill}>
                <Text style={styles.pickText}>업로드 파일 선택</Text>
              </View>
            </Touchable>
          ) : (
            <View style={styles.loadedWrap}>
              <View style={styles.fileBar}>
                <Text numberOfLines={1} style={styles.fileName}>
                  {model.fileName || "선택한 파일"}
                </Text>
                <Touchable
                  accessibilityRole="button"
                  accessibilityLabel="파일 변경"
                  style={styles.changeBtn}
                  onPress={() => act({ type: "creation-upload-pick" })}
                >
                  <Text style={styles.changeBtnText}>파일 변경</Text>
                </Touchable>
              </View>
              <View style={styles.trimCard}>
                <AudioTrim trim={model.trim} />
              </View>
            </View>
          )}
        </View>
      </ScreenScroll>
      <InstrumentSheet picker={model.instrument} />
      <TimingSheet sheet={model.timing ?? null} />
    </>
  );
}

const styles = StyleSheet.create({
  view: {
    flex: 1,
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
  },
  error: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 77, 79, 0.35)",
    backgroundColor: "rgba(255, 77, 79, 0.1)",
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: "#ff9ca8",
    fontSize: 13,
    lineHeight: 18,
  },
  dropzone: {
    flex: 1,
    minHeight: 300,
    borderRadius: 18,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#3b3b4a",
    backgroundColor: "#1e1e26",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 16,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(76, 0, 229, 0.16)",
    alignItems: "center",
    justifyContent: "center",
  },
  copy: { alignItems: "center", gap: 6 },
  title: { color: "#ffffff", fontSize: 18, fontWeight: "700" },
  subtitle: { color: colors.muted, fontSize: 12, lineHeight: 18, textAlign: "center" },
  pickPill: {
    borderRadius: 999,
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  pickText: { color: "#ffffff", fontSize: 14, fontWeight: "600" },
  loadedWrap: { gap: 12 },
  fileBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#32323d",
    backgroundColor: "#1e1e26",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  fileName: { flex: 1, color: "#ffffff", fontSize: 14, fontWeight: "500" },
  changeBtn: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#32323d",
    backgroundColor: "#23232a",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  changeBtnText: { color: colors.fg, fontSize: 12, fontWeight: "500" },
  trimCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#32323d",
    backgroundColor: "#1e1e26",
    padding: 16,
  },
});
