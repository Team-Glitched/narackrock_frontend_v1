import { useState, type ReactNode } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import type { NativeTransport } from "../../../src/lib/native-screens";
import MetronomeIcon from "../../../public/figma/metronome.svg";
import PlayIcon from "../../../public/figma/play.svg";
import ReturnIcon from "../../../public/figma/return.svg";
import SoundIcon from "../../../public/figma/sound.svg";
import { useNativeAudioState } from "../../audio";
import { Touchable } from "../../ui/kit";
import { useScreen } from "../../ui/screen-context";
import { useDevicePortrait } from "../../ui/use-device-portrait";
import { colors } from "../../ui/theme";
import { Slider, VolumeSheet } from "./parts";

const clock = (ms: number) =>
  `00:${String(Math.floor(ms / 60000)).padStart(2, "0")}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}`;

/** Live transport of the page's native engine; the model's coarse values until the engine reports. */
export function useTransport(transport: NativeTransport) {
  const live = useNativeAudioState(transport.engine);
  return transport.engine ? live : { playing: transport.playing, positionMs: transport.positionMs };
}

/**
 * The web's StudioToolbar: back, (rewind), play/pause, metronome, bpm/beat/time readouts, "+ 샘플",
 * (instrument), master volume and the page's right-side buttons (`children`). Transport buttons
 * send `transport-*` actions; the readouts send `timing-open` when `timingEditable`.
 */
export function StudioToolbar({
  transport,
  title,
  timingEditable,
  onBack,
  onRewind,
  onSample,
  instrument,
  clipStartMs = 0,
  children,
}: {
  transport: NativeTransport;
  title: string;
  timingEditable: boolean;
  onBack: () => void;
  onRewind?: () => void;
  onSample?: () => void;
  instrument?: { label: string; onPress: () => void };
  /** The time readout counts from here (the note editor's clip-local time). */
  clipStartMs?: number;
  children?: ReactNode;
}) {
  const { act } = useScreen();
  const portrait = useDevicePortrait();
  const { playing, positionMs } = useTransport(transport);
  const [volumeOpen, setVolumeOpen] = useState(false);
  const signature = `${transport.numerator}/${transport.denominator}`;
  const readouts = (
    <View style={[styles.readouts, portrait && { marginLeft: 0 }]}>
      <Readout
        small="bpm"
        value={String(transport.bpm)}
        label={timingEditable ? "bpm 설정" : undefined}
        onPress={timingEditable ? () => act({ type: "timing-open", kind: "bpm" }) : undefined}
      />
      <Readout
        small="beat"
        value={signature}
        label={timingEditable ? "박자 설정" : undefined}
        onPress={timingEditable ? () => act({ type: "timing-open", kind: "beat" }) : undefined}
      />
      <Readout small="time" value={clock(Math.max(0, positionMs - clipStartMs))} />
      {onSample && (
        <Touchable
          accessibilityRole="button"
          accessibilityLabel="샘플 추가"
          style={styles.sample}
          onPress={onSample}
        >
          <Text style={styles.samplePlus}>+</Text>
          <Text style={styles.sampleText}>샘플</Text>
        </Touchable>
      )}
      {instrument && (
        <Readout
          small="악기"
          value={instrument.label}
          label="악기 선택"
          onPress={instrument.onPress}
        />
      )}
    </View>
  );
  return (
    <View style={[styles.toolbar, portrait && styles.uprightToolbar]}>
      <Text accessibilityRole="header" style={styles.srOnly}>
        {title}
      </Text>
      <View style={styles.transport}>
        <IconButton label="뒤로" onPress={onBack}>
          <ReturnIcon width={22.5} height={22.5} />
        </IconButton>
        {onRewind && (
          <IconButton label="처음으로" onPress={onRewind}>
            <Text style={styles.rewind}>|&lt;</Text>
          </IconButton>
        )}
        <IconButton
          label={playing ? "일시정지" : "재생"}
          onPress={() => act({ type: playing ? "transport-pause" : "transport-play" })}
        >
          {playing ? (
            <View style={styles.pause}>
              <View style={styles.pauseBar} />
              <View style={styles.pauseBar} />
            </View>
          ) : (
            <PlayIcon width={16} height={20} />
          )}
        </IconButton>
        <IconButton
          label="메트로놈"
          pressed={transport.metronome}
          onPress={() => act({ type: "transport-metronome" })}
        >
          <MetronomeIcon width={15} height={22} />
        </IconButton>
      </View>
      {!portrait && readouts}
      <View style={[styles.volume, portrait && styles.uprightVolume]}>
        <Touchable
          accessibilityRole="button"
          accessibilityLabel="음량 설정"
          hitSlop={11}
          onPress={() => setVolumeOpen(true)}
        >
          <SoundIcon width={20} height={17} />
        </Touchable>
        <Slider
          value={transport.volume}
          min={0}
          max={100}
          label="마스터 볼륨"
          valueText={`${transport.volume}%`}
          onChange={(value) => act({ type: "transport-volume", value })}
          style={styles.flex}
        />
      </View>
      {children}
      {portrait && (
        <ScrollView
          horizontal
          style={styles.uprightReadouts}
          showsHorizontalScrollIndicator={false}
        >
          {readouts}
        </ScrollView>
      )}
      {volumeOpen && (
        <VolumeSheet
          value={transport.volume}
          onChange={(value) => act({ type: "transport-volume", value })}
          onClose={() => setVolumeOpen(false)}
        />
      )}
    </View>
  );
}

function IconButton({
  label,
  pressed,
  onPress,
  children,
}: {
  label: string;
  pressed?: boolean;
  onPress: () => void;
  children: ReactNode;
}) {
  return (
    <Touchable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={pressed === undefined ? undefined : { checked: pressed }}
      hitSlop={7}
      style={[styles.icon, pressed && styles.iconPressed]}
      onPress={onPress}
    >
      {children}
    </Touchable>
  );
}

function Readout({
  small,
  value,
  label,
  onPress,
}: {
  small: string;
  value: string;
  label?: string;
  onPress?: () => void;
}) {
  const body = (
    <>
      <Text style={styles.readoutSmall}>{small}</Text>
      <Text style={styles.readoutValue} numberOfLines={1}>
        {value}
      </Text>
    </>
  );
  return onPress ? (
    <Touchable
      accessibilityRole="button"
      accessibilityLabel={label}
      style={styles.readout}
      onPress={onPress}
    >
      {body}
    </Touchable>
  ) : (
    <View style={styles.readout}>{body}</View>
  );
}

/** The round "+" button of the toolbar (the web's studioAdd: 60×30, primary). */
export function AddButton({
  label,
  disabled = false,
  onPress,
}: {
  label: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Touchable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      style={[styles.add, disabled && styles.disabled]}
      onPress={onPress}
    >
      <View style={styles.plusH} />
      <View style={styles.plusV} />
    </Touchable>
  );
}

/** The toolbar's text button (the web's studioSubmit "제출하기"). */
export function ToolbarTextButton({
  label,
  disabled = false,
  onPress,
}: {
  label: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Touchable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      style={[styles.submit, disabled && styles.disabled]}
      onPress={onPress}
    >
      <Text style={styles.submitText}>{label}</Text>
    </Touchable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  disabled: { opacity: 0.5 },
  srOnly: { position: "absolute", width: 1, height: 1, opacity: 0 },
  toolbar: {
    height: 44,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    backgroundColor: colors.bg,
  },
  transport: { flexDirection: "row", alignItems: "center" },
  uprightToolbar: { height: "auto", flexWrap: "wrap", gap: 8, paddingVertical: 8 },
  uprightVolume: { marginRight: 0, paddingLeft: 0, minWidth: 44 },
  uprightReadouts: { width: "100%", flexGrow: 0 },
  icon: { width: 30, height: 30, alignItems: "center", justifyContent: "center" },
  iconPressed: { backgroundColor: colors.surface, borderRadius: 8 },
  rewind: { color: colors.fg, fontSize: 16, fontWeight: "600" },
  pause: { flexDirection: "row", gap: 5 },
  pauseBar: { width: 5, height: 18, borderRadius: 1.5, backgroundColor: colors.fg },
  readouts: { flexDirection: "row", alignItems: "center", gap: 10, marginLeft: 16 },
  readout: {
    height: 30,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingVertical: 2,
    paddingHorizontal: 4,
    borderRadius: 8,
    backgroundColor: colors.surface,
  },
  readoutSmall: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 26,
    paddingRight: 3,
    borderRightWidth: 1,
    borderRightColor: colors.line,
  },
  readoutValue: {
    color: colors.fg,
    fontSize: 16,
    lineHeight: 22,
    fontVariant: ["tabular-nums"],
  },
  sample: {
    height: 30,
    minWidth: 80,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingHorizontal: 9,
    borderRadius: 8,
    backgroundColor: colors.surface,
  },
  samplePlus: { color: colors.fg, fontSize: 20, lineHeight: 20 },
  sampleText: { color: colors.fg, fontSize: 14, lineHeight: 16, fontWeight: "500" },
  volume: {
    flex: 1,
    maxWidth: 210,
    // Shrinks to the icon and a short slider so two toolbar buttons fit (web .studio-volume).
    minWidth: 44,
    marginLeft: "auto",
    marginRight: 30,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingLeft: 12,
  },
  add: {
    width: 60,
    height: 30,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
  },
  plusH: {
    position: "absolute",
    width: 20,
    height: 2,
    borderRadius: 2,
    backgroundColor: "#d7dce2",
  },
  plusV: {
    position: "absolute",
    width: 2,
    height: 20,
    borderRadius: 2,
    backgroundColor: "#d7dce2",
  },
  submit: {
    height: 30,
    minWidth: 82,
    paddingHorizontal: 12,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
  },
  submitText: { color: "#ffffff", fontSize: 16, lineHeight: 20, fontWeight: "500" },
});
