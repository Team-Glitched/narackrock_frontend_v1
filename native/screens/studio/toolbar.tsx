import type { ReactNode } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import Svg, { Path, Rect } from "react-native-svg";

import type { NativeTransport } from "../../../src/lib/native-screens";
import MetronomeIcon from "../../../public/figma/metronome.svg";
import PlayIcon from "../../../public/figma/play.svg";
import ReturnIcon from "../../../public/figma/return.svg";
import { useNativeAudioState } from "../../audio";
import { Touchable } from "../../ui/kit";
import { useScreen } from "../../ui/screen-context";
import { useDevicePortrait } from "../../ui/use-device-portrait";
import { colors } from "../../ui/theme";

const clock = (ms: number) =>
  `00:${String(Math.floor(ms / 60000)).padStart(2, "0")}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}`;

/** Bold rewind-to-start SVG matching play.svg's visual weight. */
export function RewindIcon({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={4.5} y={4.5} width={3} height={15} rx={1.5} fill="#F2F4F6" />
      <Path
        d="M18.5 5.75L9.75 12L18.5 18.25V5.75Z"
        fill="#F2F4F6"
        stroke="#F2F4F6"
        strokeWidth={2.5}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** Live transport of the page's native engine; the model's coarse values until the engine reports. */
export function useTransport(transport: NativeTransport) {
  const live = useNativeAudioState(transport.engine);
  return transport.engine ? live : { playing: transport.playing, positionMs: transport.positionMs };
}

/**
 * The web's StudioToolbar: back, (rewind), play/pause, metronome, bpm/beat/time readouts, "+ 샘플",
 * (instrument) and the page's right-side buttons (`children`). Transport buttons
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
            <RewindIcon size={20} />
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
      <View style={styles.rightActions}>{children}</View>
      {portrait && (
        <ScrollView
          horizontal
          style={styles.uprightReadouts}
          showsHorizontalScrollIndicator={false}
        >
          {readouts}
        </ScrollView>
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
  rightActions: { marginLeft: "auto", flexDirection: "row", alignItems: "center", gap: 8 },
  uprightReadouts: { width: "100%", flexGrow: 0 },
  icon: { width: 30, height: 30, alignItems: "center", justifyContent: "center", borderRadius: 8 },
  iconPressed: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#8b5cf6",
  },
  pause: { flexDirection: "row", gap: 5 },
  pauseBar: { width: 5, height: 18, borderRadius: 1.5, backgroundColor: colors.fg },
  readouts: { flexDirection: "row", alignItems: "center", gap: 8, marginLeft: 12 },
  readout: {
    height: 30,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#32323d",
    backgroundColor: "#23232a",
  },
  readoutSmall: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 20,
    paddingRight: 5,
    borderRightWidth: 1,
    borderRightColor: colors.line,
  },
  readoutValue: {
    color: colors.fg,
    fontSize: 14,
    lineHeight: 20,
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
    borderWidth: 1,
    borderColor: "#32323d",
    backgroundColor: "#23232a",
  },
  samplePlus: { color: colors.fg, fontSize: 18, lineHeight: 20 },
  sampleText: { color: colors.fg, fontSize: 13, lineHeight: 16, fontWeight: "500" },
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
