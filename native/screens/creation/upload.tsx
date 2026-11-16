import { StyleSheet, Text, View } from "react-native";

import UploadIcon from "../../../public/figma/audio-upload-large.svg";
import { AppHeader } from "../../ui/header";
import { Touchable } from "../../ui/kit";
import { ScreenScroll } from "../../ui/screen";
import { useScreen } from "../../ui/screen-context";
import { colors } from "../../ui/theme";
import { InstrumentSheet } from "../studio/parts";
import type { ScreenProps } from "../types";
import { AudioTrim } from "./trim";

/** The web's CompositionUploadScreen: the platform file picker, then the trim picker. */
export function CreationUploadScreen({ model, header }: ScreenProps<"creation-upload">) {
  const { act } = useScreen();
  const hasAudio = model.trim !== null;
  return (
    <>
      {header && <AppHeader header={header} />}
      <ScreenScroll>
        <View style={[styles.view, !hasAudio && styles.empty]}>
          {model.error && (
            <Text accessibilityRole="alert" style={styles.error}>
              {model.error}
            </Text>
          )}
          <Touchable
            accessibilityRole="button"
            accessibilityLabel={model.fileName ?? "업로드 파일 선택"}
            style={styles.area}
            onPress={() => act({ type: "creation-upload-pick" })}
          >
            <UploadIcon width={150} height={136} />
            <Text style={styles.pick}>{model.fileName || "업로드 파일 선택"}</Text>
          </Touchable>
          <AudioTrim trim={model.trim} />
        </View>
      </ScreenScroll>
      <InstrumentSheet picker={model.instrument} />
    </>
  );
}

const styles = StyleSheet.create({
  view: { alignItems: "center", gap: 20, paddingVertical: 30, paddingHorizontal: 16 },
  empty: { minHeight: 560, justifyContent: "center", paddingHorizontal: 20 },
  error: { alignSelf: "stretch", color: colors.error, fontSize: 14, lineHeight: 20 },
  area: { alignItems: "center", gap: 34 },
  pick: {
    overflow: "hidden",
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: colors.primary,
    color: colors.fg,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "500",
    textAlign: "center",
  },
});
