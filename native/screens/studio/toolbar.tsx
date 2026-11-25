import type { ReactNode } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import Svg, { Path, Rect } from "react-native-svg";

import type { NativeTransport } from "../../../src/lib/native-screens";
import PlayIcon from "../../../public/figma/play.svg";
import ReturnIcon from "../../../public/figma/return.svg";
import { engineTransport, useNativeAudioState } from "../../audio";
import { Touchable } from "../../ui/kit";
import { useScreen } from "../../ui/screen-context";
import { useDevicePortrait } from "../../ui/use-device-portrait";
import { colors } from "../../ui/theme";

const clock = (ms: number) =>
  `00:${String(Math.floor(ms / 60000)).padStart(2, "0")}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}`;

/** Bold metronome glyph matching metronome.svg with active purple tint support. */
export function MetronomeGlyph({ active = false, size = 22 }: { active?: boolean; size?: number }) {
  return (
    <Svg
      width={Math.round((size * 15.0893) / 22.0093)}
      height={size}
      viewBox="0 0 15.0893 22.0093"
      fill="none"
    >
      <Path
        d="M8.79487 1L8.79585 0H8.8232C8.83618 0.00023839 8.85322 0.00123648 8.873 0.00195312C8.91317 0.00341438 8.968 0.00544455 9.03218 0.0107422C9.15868 0.0212003 9.33647 0.0426837 9.53218 0.0869141C9.84859 0.158497 10.5416 0.36001 10.9111 1C11.0588 1.25583 11.1741 1.48529 11.2265 1.69434C11.2363 1.73352 11.2586 1.8255 11.2617 1.94727L11.4384 2.79785L14.0205 15.2812L14.0214 15.2842C14.0219 15.2862 14.0226 15.2893 14.0234 15.293C14.0251 15.3007 14.0279 15.3123 14.0312 15.3271C14.038 15.3573 14.0479 15.4017 14.0605 15.458C14.0858 15.5709 14.1222 15.7326 14.166 15.9277C14.2535 16.3183 14.3711 16.8433 14.4912 17.3809C14.7288 18.445 14.9833 19.5888 15.0263 19.8057L15.0556 19.9609C15.0867 20.1433 15.113 20.3989 15.0546 20.6631C14.9653 21.0669 14.7235 21.336 14.5527 21.5068C14.1687 21.8909 13.6834 21.9757 13.4345 21.999C13.2921 22.0123 13.167 22.0105 13.0781 22.0059C13.0504 22.0044 13.025 22.0019 13.0029 22H2.08687C2.06479 22.0019 2.03931 22.0044 2.01167 22.0059C1.92275 22.0106 1.79773 22.0123 1.65523 21.999C1.40643 21.9757 0.92205 21.8907 0.538039 21.5068C0.367574 21.3364 0.124708 21.0681 0.0351094 20.6641C-0.043101 20.3113 0.0307254 19.9739 0.0644062 19.8047C0.107865 19.586 0.362138 18.4439 0.599562 17.3809C0.719629 16.8433 0.83723 16.3182 0.924758 15.9277C0.968511 15.7325 1.00491 15.5709 1.03023 15.458C1.04288 15.4016 1.05276 15.3573 1.05952 15.3271C1.06287 15.3122 1.06559 15.3007 1.06734 15.293C1.06817 15.2892 1.06885 15.2861 1.06929 15.2842C1.06948 15.2832 1.06918 15.2817 1.06929 15.2812L2.84956 6.67676L1.49702 3.77637C1.15361 3.74561 0.834954 3.53998 0.678664 3.20508C0.522307 2.86978 0.568973 2.49197 0.766555 2.20898L0.708937 2.08691C0.592468 1.83676 0.701066 1.53957 0.951125 1.42285C1.20123 1.30622 1.49833 1.41414 1.61519 1.66406L1.6728 1.78613C2.01648 1.81671 2.3348 2.0242 2.49116 2.35938C2.64745 2.69452 2.60062 3.07155 2.40327 3.35449L3.18843 5.03809L3.6523 2.79785L3.82905 1.94336C3.83269 1.82092 3.85541 1.72884 3.86519 1.69043C3.91744 1.48546 4.03096 1.25895 4.17769 1.00293L4.24995 0.887695C4.63129 0.335052 5.26179 0.153729 5.55757 0.0869141C5.75328 0.0427485 5.93104 0.0211844 6.05757 0.0107422C6.12176 0.00546361 6.17661 0.00341319 6.21675 0.00195312C6.23676 0.00122168 6.25449 0.000223459 6.26753 0H8.79487V1ZM2.55073 17.8164C2.35377 18.6983 2.15684 19.5954 2.06929 20H13.0214C12.9339 19.5955 12.736 18.6984 12.539 17.8164C12.4325 17.3393 12.3284 16.8719 12.2451 16.5H2.84566C2.76231 16.872 2.65731 17.3392 2.55073 17.8164ZM4.60249 8.07129L6.2021 11.5H9.04487C9.32102 11.5 9.54487 11.7239 9.54487 12C9.54487 12.2761 9.32102 12.5 9.04487 12.5H6.6689L7.60152 14.5H11.8173L9.64448 4H5.44527L4.60249 8.07129ZM3.27339 14.5H6.498L4.26362 9.70996L3.27339 14.5ZM8.04487 8.5C8.32102 8.5 8.54487 8.72386 8.54487 9C8.54487 9.27614 8.32102 9.5 8.04487 9.5H7.04487C6.76875 9.49998 6.54487 9.27613 6.54487 9C6.54487 8.72387 6.76875 8.50002 7.04487 8.5H8.04487ZM8.04487 5.5C8.32102 5.5 8.54487 5.72386 8.54487 6C8.54487 6.27614 8.32102 6.5 8.04487 6.5H7.04487C6.76876 6.49997 6.54487 6.27612 6.54487 6C6.54487 5.72388 6.76876 5.50003 7.04487 5.5H8.04487Z"
        fill={active ? colors.primary : "#F2F4F6"}
      />
    </Svg>
  );
}

/** Full-height rewind-to-start SVG matching play.svg and return.svg visual scale. */
export function RewindIcon({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <Rect x={1.5} y={1} width={3} height={18} rx={1.5} fill="#F2F4F6" />
      <Path
        d="M18 2.25L7.5 10L18 17.75V2.25Z"
        fill="#F2F4F6"
        stroke="#F2F4F6"
        strokeWidth={2.2}
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

/** `useTransport`'s position read once (e.g. in an action handler), without re-rendering per frame. */
export function transportPositionMs(transport: NativeTransport) {
  return transport.engine ? engineTransport(transport.engine).positionMs : transport.positionMs;
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
  piano?: boolean;
  onBack: () => void;
  onRewind?: () => void;
  onSample?: () => void;
  /** `disabled`: shown but not pressable while the page is busy (e.g. rendering audio). */
  instrument?: { label: string; onPress: () => void; disabled?: boolean };
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
          disabled={instrument.disabled}
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
          checked={transport.metronome}
          pressed={false}
          onPress={() => act({ type: "transport-metronome" })}
        >
          <MetronomeGlyph active={transport.metronome} size={22} />
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
  checked,
  pressed,
  onPress,
  children,
}: {
  label: string;
  checked?: boolean;
  pressed?: boolean;
  onPress: () => void;
  children: ReactNode;
}) {
  const ariaChecked = checked ?? pressed;
  return (
    <Touchable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={ariaChecked === undefined ? undefined : { checked: ariaChecked }}
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
  disabled = false,
}: {
  small: string;
  value: string;
  label?: string;
  onPress?: () => void;
  disabled?: boolean;
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
      accessibilityState={{ disabled }}
      disabled={disabled}
      style={[styles.readout, disabled && styles.disabled]}
      onPress={onPress}
    >
      {body}
    </Touchable>
  ) : (
    <View style={styles.readout}>{body}</View>
  );
}

/**
 * The round "+" button of the toolbar (the web's studioAdd: 60×30, primary). `hint` is the web's
 * `title` tooltip, read as the accessibility hint.
 */
export function AddButton({
  label,
  hint,
  disabled = false,
  onPress,
}: {
  label: string;
  hint?: string | null;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Touchable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint ?? undefined}
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
    borderColor: colors.primary,
  },
  pause: { flexDirection: "row", gap: 5 },
  pauseBar: { width: 5, height: 18, borderRadius: 1.5, backgroundColor: colors.fg },
  readouts: { flexDirection: "row", alignItems: "center", gap: 8, marginLeft: 12 },
  readout: {
    height: 30,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 2,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#32323d",
    backgroundColor: "#23232a",
  },
  readoutSmall: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 16,
    paddingRight: 6,
    borderRightWidth: 1,
    borderRightColor: colors.line,
  },
  readoutValue: {
    color: colors.fg,
    fontSize: 14,
    lineHeight: 18,
    fontVariant: ["tabular-nums"],
  },
  sample: {
    height: 30,
    minWidth: 80,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#32323d",
    backgroundColor: "#23232a",
  },
  samplePlus: { color: colors.fg, fontSize: 14, lineHeight: 18, fontWeight: "600" },
  sampleText: { color: colors.fg, fontSize: 14, lineHeight: 18, fontWeight: "500" },
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
  submitText: { color: "#ffffff", fontSize: 14, lineHeight: 18, fontWeight: "600" },
});
