import { Image, StyleSheet, Text, View } from "react-native";
import Svg, { Line, Pattern, Rect } from "react-native-svg";

import RecordImage from "../../../public/figma/choose-record.png";
import UploadImage from "../../../public/figma/choose-upload.png";
import type { NativeCreationMethod } from "../../../src/lib/native-screens";
import { AppHeader } from "../../ui/header";
import { Touchable } from "../../ui/kit";
import { ScreenScroll } from "../../ui/screen";
import { useScreen } from "../../ui/screen-context";
import { colors } from "../../ui/theme";
import type { ScreenProps } from "../types";
import { InstrumentSheet } from "../studio/parts";

const choices = [
  {
    method: "upload",
    label: "업로드",
    description: "오디오 파일을 불러와 레이어로 추가합니다.",
    image: UploadImage,
  },
  {
    method: "record",
    label: "녹음",
    description: "연주나 목소리를 직접 녹음합니다.",
    image: RecordImage,
  },
  {
    method: "note",
    label: "피아노롤",
    description: "노트를 배치해 멜로디를 만듭니다.",
    image: null,
  },
] as const;

/** The web's CompositionChoiceScreen (sample registration "오디오 추가"). */
export function CreationChooseScreen({ model, header }: ScreenProps<"creation-choose">) {
  const { act } = useScreen();
  return (
    <>
      {header && <AppHeader header={header} />}
      <ScreenScroll>
        <CreationChoiceList
          busy={model.busy}
          error={model.error}
          onChoose={(method) => act({ type: "creation-choose", method })}
        />
      </ScreenScroll>
      <InstrumentSheet picker={model.instrument ?? null} />
    </>
  );
}

/** The three creation cards (also the studio's layer choice). */
export function CreationChoiceList({
  busy,
  error,
  onChoose,
}: {
  busy: boolean;
  error: string | null;
  onChoose: (method: NativeCreationMethod) => void;
}) {
  return (
    <View style={styles.list}>
      {error && (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      )}
      {choices.map((item) => (
        <Touchable
          key={item.method}
          accessibilityRole="button"
          accessibilityLabel={`${item.label} ${item.description}`}
          accessibilityState={{ disabled: busy }}
          disabled={busy}
          style={[styles.card, busy && styles.disabled]}
          onPress={() => onChoose(item.method)}
        >
          <View style={styles.copy}>
            <Text style={styles.label}>{item.label}</Text>
            <Text style={styles.description}>{item.description}</Text>
          </View>
          {item.image === null ? (
            <PianoPreview />
          ) : (
            <Image source={item.image} style={styles.image} resizeMode="cover" />
          )}
        </Touchable>
      ))}
    </View>
  );
}

/** The web's creationPianoPreview: a small piano roll with six notes. */
function PianoPreview() {
  const notes = [
    { top: 17, left: 16, width: 16 },
    { top: 33, left: 35, width: 13 },
    { top: 49, left: 19, width: 21 },
    { top: 17, left: 50, width: 24 },
    { top: 66, left: 43, width: 17 },
    { top: 49, left: 66, width: 27 },
  ];
  return (
    <View style={styles.image}>
      <Svg width="100%" height="100%">
        <Pattern id="cells" width={18} height={16} patternUnits="userSpaceOnUse">
          <Line x1={0.5} y1={0} x2={0.5} y2={16} stroke={colors["grid-cell"]} strokeWidth={1} />
          <Line x1={0} y1={0.5} x2={18} y2={0.5} stroke={colors["grid-cell"]} strokeWidth={1} />
        </Pattern>
        <Pattern id="whites" width={10} height={16} patternUnits="userSpaceOnUse">
          <Rect width={10} height={15} fill={colors["key-white"]} />
          <Rect y={15} width={10} height={1} fill="#b9b8c2" />
        </Pattern>
        <Pattern id="blacks" width={10} height={32} patternUnits="userSpaceOnUse">
          <Rect y={9} width={10} height={8} fill={colors["key-black"]} />
        </Pattern>
        <Rect width="100%" height="100%" fill={colors["grid-row"]} />
        <Rect width="100%" height="100%" fill="url(#cells)" />
        <Rect width="10%" height="100%" fill="url(#whites)" />
        <Rect width="6.5%" height="100%" fill="url(#blacks)" />
      </Svg>
      {notes.map((note, index) => (
        <View
          key={index}
          style={[
            styles.note,
            { top: `${note.top}%`, left: `${note.left}%`, width: `${note.width}%` },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 26, padding: 20 },
  error: { color: colors.error, fontSize: 14, lineHeight: 20 },
  card: {
    gap: 24,
    padding: 16,
    borderRadius: 20,
    borderBottomWidth: 4,
    borderBottomColor: colors.primary,
    backgroundColor: colors.surface,
  },
  disabled: { opacity: 0.55 },
  copy: { gap: 8 },
  label: { color: colors.fg, fontSize: 20, lineHeight: 24, fontWeight: "700" },
  description: { color: colors.muted, fontSize: 14, lineHeight: 18 },
  image: {
    width: "100%",
    aspectRatio: 316 / 113,
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: colors["grid-row"],
  },
  note: {
    position: "absolute",
    height: "10%",
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
});
