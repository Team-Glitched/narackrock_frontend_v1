/**
 * Shared native studio UI: the adaptive canvas, dialogs (instrument, timing, volume, samples),
 * slider and number field. Used by the studio timeline, the note editor and the creation pages.
 * Dialogs are in-tree overlays (not RN `Modal`) so they share the canvas bounds: render
 * them at the screen root, after the scrolling content.
 */
import { useRef, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";

import { timingProblem } from "../../../src/features/composition/project-timing";
import { SEARCH_QUERY_MAX_LENGTH, clampCodePoints } from "../../../src/lib/content-limits";
import type {
  NativeInstrumentPicker,
  NativeSourcePicker,
  NativeTimingSheet,
} from "../../../src/lib/native-screens";
import CloseIcon from "../../../public/figma/search-close.svg";
import VolumeIcon from "../../../public/figma/dialog-volume-sound.svg";
import { Avatar, Touchable } from "../../ui/kit";
import { useScreenBack } from "../../ui/screen-back";
import { useScreen } from "../../ui/screen-context";
import { colors } from "../../ui/theme";

/** Fill the current window; the OS rotates it, so content keeps the screen axes. */
export function StudioCanvas({ children }: { children: ReactNode }) {
  return <View style={styles.canvas}>{children}</View>;
}

/** Centered dialog over the screen (the web's CanvasDialog); a tap outside or Back closes it. */
export function Dialog({
  label,
  onClose,
  children,
  style,
}: {
  label: string;
  onClose: () => void;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  useScreenBack(onClose);
  return (
    <View style={styles.overlay}>
      <Pressable
        style={[StyleSheet.absoluteFill, styles.backdrop]}
        accessibilityRole="button"
        accessibilityLabel="닫기"
        onPress={onClose}
      />
      <View style={[styles.dialog, style]} accessibilityViewIsModal accessibilityLabel={label}>
        {children}
      </View>
    </View>
  );
}

/** Range input (the web's 5px track with a round thumb); `onChange` while dragging. */
export function Slider({
  value,
  min,
  max,
  label,
  valueText,
  disabled = false,
  onChange,
  style,
}: {
  value: number;
  min: number;
  max: number;
  label: string;
  valueText?: string;
  disabled?: boolean;
  onChange: (value: number) => void;
  style?: StyleProp<ViewStyle>;
}) {
  const width = useRef(1);
  const start = useRef(0);
  const latest = useRef({ min, max, onChange, disabled });
  latest.current = { min, max, onChange, disabled };
  const valueAt = (x: number) => {
    const { min: low, max: high } = latest.current;
    return Math.round(low + Math.max(0, Math.min(1, x / width.current)) * (high - low));
  };
  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !latest.current.disabled,
      onMoveShouldSetPanResponder: () => !latest.current.disabled,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (event) => {
        start.current = event.nativeEvent.locationX;
        latest.current.onChange(valueAt(start.current));
      },
      onPanResponderMove: (_, gesture) => {
        latest.current.onChange(valueAt(start.current + gesture.dx));
      },
    }),
  ).current;
  const fraction = max > min ? (value - min) / (max - min) : 0;
  const step = Math.max(1, Math.round((max - min) / 20));
  return (
    <View
      style={[styles.slider, disabled && styles.disabled, style]}
      onLayout={(event) => {
        width.current = Math.max(1, event.nativeEvent.layout.width);
      }}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      accessibilityValue={{ min, max, now: value, text: valueText }}
      onAccessibilityAction={(event) => {
        if (disabled) return;
        if (event.nativeEvent.actionName === "increment") onChange(Math.min(max, value + step));
        if (event.nativeEvent.actionName === "decrement") onChange(Math.max(min, value - step));
      }}
      accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
      {...responder.panHandlers}
    >
      <View style={styles.sliderTrack} pointerEvents="none">
        <View style={[styles.sliderFill, { width: `${fraction * 100}%` }]} />
      </View>
      <View pointerEvents="none" style={[styles.sliderThumb, { left: `${fraction * 100}%` }]} />
    </View>
  );
}

/** The web's DialogNumberInput: commits on submit or blur, clamped and rounded. */
export function NumberField({
  value,
  min,
  max,
  clamp = true,
  style,
  label,
  disabled = false,
  onChange,
}: {
  value: number;
  min: number;
  max?: number;
  clamp?: boolean;
  style?: StyleProp<TextStyle>;
  label: string;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    if (draft !== null && draft.trim() !== "" && Number.isFinite(Number(draft))) {
      const rounded = Math.round(Number(draft));
      onChange(clamp ? Math.min(max ?? Number.MAX_SAFE_INTEGER, Math.max(min, rounded)) : rounded);
    }
    setDraft(null);
  };
  return (
    <TextInput
      accessibilityLabel={label}
      editable={!disabled}
      keyboardType="number-pad"
      returnKeyType="done"
      selectionColor={colors.accent}
      value={draft ?? String(value)}
      onChangeText={setDraft}
      onBlur={commit}
      onSubmitEditing={commit}
      style={[styles.number, style, disabled && styles.disabled]}
    />
  );
}

/** Small rounded button of the dialogs (buttonVariants compact). */
export function DialogButton({
  label,
  tone = "primary",
  disabled = false,
  wide = false,
  style,
  onPress,
}: {
  label: string;
  tone?: "primary" | "secondary";
  disabled?: boolean;
  wide?: boolean;
  style?: StyleProp<ViewStyle>;
  onPress: () => void;
}) {
  return (
    <Touchable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      style={[
        styles.dialogButton,
        tone === "secondary" && styles.dialogButtonSecondary,
        wide && styles.wide,
        disabled && styles.disabled,
        style,
      ]}
      onPress={onPress}
    >
      <Text style={styles.dialogButtonText}>{label}</Text>
    </Touchable>
  );
}

function Alert({ children }: { children: string }) {
  return (
    <Text accessibilityRole="alert" style={styles.alert}>
      {children}
    </Text>
  );
}

/**
 * The web's VolumeDialog: "음량" slider + number, optionally a track's identity, "악기/보컬 변경"
 * and the track's note-free MIDI entries.
 */
export function VolumeSheet({
  value,
  onChange,
  onClose,
  identity,
  onChangeInstrument,
  emptyMidi = [],
}: {
  value: number;
  onChange: (value: number) => void;
  onClose: () => void;
  identity?: { name: string; part: string };
  onChangeInstrument?: () => void;
  emptyMidi?: { clipId: number; label: string; open: () => void }[];
}) {
  return (
    <Dialog label="음량" onClose={onClose} style={styles.volumeDialog}>
      {identity && (
        <View style={styles.identity}>
          <View style={styles.identityText}>
            <Text style={styles.identityName} numberOfLines={1}>
              {identity.name}
            </Text>
            <Text style={styles.caption}>{identity.part}</Text>
          </View>
          <Avatar uri={null} size={43} />
        </View>
      )}
      <Text style={styles.dialogTitle} accessibilityRole="header">
        음량
      </Text>
      <View style={styles.volumeRow}>
        <VolumeIcon width={20} height={17} style={styles.volumeIcon} />
        <Slider
          value={value}
          min={0}
          max={100}
          label="음량"
          valueText={`${value}%`}
          onChange={onChange}
          style={styles.flex}
        />
        <NumberField value={value} min={0} max={100} label="음량 직접 입력" onChange={onChange} />
      </View>
      {onChangeInstrument && (
        <View style={styles.instrumentChange}>
          <DialogButton label="악기/보컬 변경" tone="secondary" wide onPress={onChangeInstrument} />
        </View>
      )}
      {emptyMidi.map(({ clipId, label, open }) => (
        <DialogButton
          key={clipId}
          label={label}
          tone="secondary"
          wide
          style={styles.emptyMidiButton}
          onPress={open}
        />
      ))}
    </Dialog>
  );
}

/** The web's InstrumentDialog ("악기 선택"); null renders nothing. Actions go to the page. */
export function InstrumentSheet({ picker }: { picker: NativeInstrumentPicker | null }) {
  const { act } = useScreen();
  if (!picker) return null;
  return (
    <Dialog
      label="악기 선택"
      onClose={() => act({ type: "instrument-close" })}
      style={styles.instrumentDialog}
    >
      <Text style={styles.dialogHeading} accessibilityRole="header">
        악기 선택
      </Text>
      <Text style={styles.muted}>같은 악기나 보컬을 여러 명이 함께 선택할 수 있어요.</Text>
      <ScrollView
        style={styles.instrumentList}
        contentContainerStyle={styles.instrumentGroups}
        accessibilityRole="radiogroup"
        accessibilityLabel="악기"
      >
        {picker.groups.map((group) => (
          <View key={group.id}>
            <Text style={styles.legend}>{group.label}</Text>
            <View style={styles.parts}>
              {group.parts.map((part) => {
                const checked = picker.selected === part.id;
                return (
                  <Touchable
                    key={part.id}
                    accessibilityRole="radio"
                    accessibilityState={{ checked, disabled: picker.busy }}
                    disabled={picker.busy}
                    style={[
                      styles.part,
                      checked && styles.partChecked,
                      picker.busy && styles.disabled,
                    ]}
                    onPress={() => act({ type: "instrument-select", id: part.id })}
                  >
                    <Text style={styles.partText}>{part.label}</Text>
                  </Touchable>
                );
              })}
            </View>
          </View>
        ))}
      </ScrollView>
      {picker.mode === "audio" && (
        <View style={styles.row}>
          <DialogButton
            label="원본 듣기"
            tone="secondary"
            disabled={picker.busy}
            onPress={() => act({ type: "instrument-preview" })}
          />
          <DialogButton
            label="정지"
            tone="secondary"
            onPress={() => act({ type: "instrument-stop-preview" })}
          />
        </View>
      )}
      {picker.error && <Alert>{picker.error}</Alert>}
      <DialogButton
        label={picker.busy ? "적용 중..." : "선택 완료"}
        wide
        disabled={!picker.canConfirm}
        onPress={() => act({ type: "instrument-confirm" })}
      />
    </Dialog>
  );
}

/** The web's TimingDialog ("bpm" / "beat"); the draft stays here until "적용". */
export function TimingSheet({ sheet }: { sheet: NativeTimingSheet | null }) {
  if (!sheet) return null;
  return <TimingDialog key={sheet.kind} sheet={sheet} />;
}

function TimingDialog({ sheet }: { sheet: NativeTimingSheet }) {
  const { act } = useScreen();
  const [draft, setDraft] = useState({
    bpm: sheet.bpm,
    numerator: sheet.numerator,
    denominator: sheet.denominator,
  });
  const problem = timingProblem({
    bpm: draft.bpm,
    signature: { numerator: draft.numerator, denominator: draft.denominator },
  });
  const editable = sheet.editable;
  const beat = sheet.kind === "beat";
  return (
    <Dialog
      label={sheet.kind}
      onClose={() => act({ type: "timing-close" })}
      style={styles.timingDialog}
    >
      <Text style={styles.dialogTitleTight} accessibilityRole="header">
        {sheet.kind}
      </Text>
      {beat ? (
        <View style={styles.signatureRow}>
          <NumberField
            value={draft.numerator}
            min={1}
            max={12}
            clamp={false}
            style={[styles.timingNumber, styles.flex]}
            label="마디당 박 수"
            disabled={!editable}
            onChange={(numerator) => setDraft((old) => ({ ...old, numerator }))}
          />
          <Text style={styles.signatureSlash}>/</Text>
          <NumberField
            value={draft.denominator}
            min={2}
            max={16}
            clamp={false}
            style={[styles.timingNumber, styles.flex]}
            label="기준 음표"
            disabled={!editable}
            onChange={(denominator) => setDraft((old) => ({ ...old, denominator }))}
          />
        </View>
      ) : (
        <View style={styles.timingRow}>
          <Slider
            value={draft.bpm}
            min={30}
            max={300}
            label="bpm"
            disabled={!editable}
            onChange={(bpm) => setDraft((old) => ({ ...old, bpm }))}
            style={styles.flex}
          />
          <NumberField
            value={draft.bpm}
            min={30}
            max={300}
            clamp={false}
            style={styles.timingNumber}
            label="BPM 직접 입력"
            disabled={!editable}
            onChange={(bpm) => setDraft((old) => ({ ...old, bpm }))}
          />
        </View>
      )}
      {!editable && (
        <Text style={styles.muted}>곡의 BPM과 박자는 원작성자만 바꿀 수 있습니다.</Text>
      )}
      {editable && problem && <Alert>{problem}</Alert>}
      {sheet.error && <Alert>{sheet.error}</Alert>}
      {editable ? (
        <DialogButton
          wide
          label={sheet.busy ? "저장 중..." : "적용"}
          disabled={sheet.busy || problem !== null}
          onPress={() => act({ type: "timing-apply", ...draft })}
        />
      ) : (
        <DialogButton
          wide
          label="닫기"
          tone="secondary"
          onPress={() => act({ type: "timing-close" })}
        />
      )}
    </Dialog>
  );
}

/** The web's StudioSourceDialog ("샘플 추가"); null renders nothing. */
export function SourceSheet({ picker }: { picker: NativeSourcePicker | null }) {
  return picker ? <SourceDialog picker={picker} /> : null;
}

function SourceDialog({ picker }: { picker: NativeSourcePicker }) {
  const { act } = useScreen();
  const [query, setQuery] = useState(picker.query);
  const close = () => {
    if (!picker.busy) act({ type: "source-close" });
  };
  return (
    <Dialog label="샘플 추가" onClose={close} style={styles.sourceDialog}>
      <View style={styles.sourceHeader}>
        <Text style={styles.dialogHeading} accessibilityRole="header">
          샘플 추가
        </Text>
        <Touchable
          accessibilityRole="button"
          accessibilityLabel="가져오기 닫기"
          accessibilityState={{ disabled: picker.busy }}
          disabled={picker.busy}
          hitSlop={8}
          style={styles.sourceClose}
          onPress={() => act({ type: "source-close" })}
        >
          <CloseIcon width={14} height={14} />
        </Touchable>
      </View>
      {picker.tabs.length > 1 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.sourceChipScroll}
          contentContainerStyle={styles.sourceChipRow}
        >
          {picker.tabs.map((value) => {
            const selected = picker.tab === value;
            return (
              <Touchable
                key={value}
                accessibilityRole="button"
                accessibilityState={{ selected, disabled: picker.busy }}
                disabled={picker.busy}
                style={[styles.sourceChip, selected && styles.sourceChipActive, picker.busy && styles.disabled]}
                onPress={() => act({ type: "source-tab", tab: value })}
              >
                <Text style={[styles.sourceChipText, selected && styles.sourceChipTextActive]}>
                  {sourceTabLabels[value]}
                </Text>
              </Touchable>
            );
          })}
        </ScrollView>
      )}
      {picker.tab === "upload" ? (
        <>
          <Text style={styles.caption}>{picker.description}</Text>
          <DialogButton
            label="파일 선택"
            tone="secondary"
            disabled={picker.busy}
            onPress={() => act({ type: "source-upload" })}
          />
          {picker.uploading && (
            <Text style={styles.caption} accessibilityLiveRegion="polite">
              파일을 읽는 중…
            </Text>
          )}
          {picker.error && <Alert>{picker.error}</Alert>}
        </>
      ) : (
        <SourceList picker={picker} query={query} onQuery={setQuery} />
      )}
    </Dialog>
  );
}

const sourceTabLabels = {
  saved: "보관한 샘플",
  local: "이 기기의 MIDI 작업",
  upload: "이 기기에서 업로드",
} as const;

/** The search and rows of the "보관한 샘플" / "이 기기의 MIDI 작업" tabs. */
function SourceList({
  picker,
  query,
  onQuery,
}: {
  picker: NativeSourcePicker;
  query: string;
  onQuery: (query: string) => void;
}) {
  const { act } = useScreen();
  return (
    <>
      <Text style={styles.caption}>{picker.description}</Text>
      <TextInput
        accessibilityLabel="샘플 검색"
        placeholder={picker.placeholder}
        placeholderTextColor="#9692a6"
        selectionColor={colors.accent}
        value={query}
        onChangeText={(text) => {
          const clamped = clampCodePoints(text, SEARCH_QUERY_MAX_LENGTH);
          onQuery(clamped);
          act({ type: "source-query", query: clamped });
        }}
        style={styles.search}
      />
      <ScrollView style={styles.sourceResults} contentContainerStyle={styles.sourceRows}>
        {picker.rows === null ? (
          <Text style={styles.caption} accessibilityRole="text">
            보관한 샘플을 불러오는 중...
          </Text>
        ) : (
          picker.rows.map((row) => (
            <View key={row.key} style={styles.sourceRow}>
              <View style={styles.sourceRowText}>
                <Text style={styles.sourceTitle}>{row.title}</Text>
                <Text style={styles.caption}>{row.subtitle}</Text>
              </View>
              <DialogButton
                label={row.button}
                disabled={row.disabled}
                onPress={() => act({ type: "source-pick", key: row.key })}
              />
            </View>
          ))
        )}
        {picker.empty && <Text style={styles.caption}>{picker.empty}</Text>}
        {picker.failed && <Alert>보관한 샘플을 불러오지 못했습니다.</Alert>}
        {picker.more && (
          <DialogButton
            label={picker.more.label}
            tone="secondary"
            disabled={picker.more.disabled}
            onPress={() => act({ type: "source-more" })}
          />
        )}
      </ScrollView>
      {picker.error && <Alert>{picker.error}</Alert>}
    </>
  );
}

/** Spinner + message in the middle of the canvas (the web's studio loading/error state). */
export function CanvasState({
  message,
  failed,
  actionLabel,
  onAction,
}: {
  message: string;
  failed: boolean;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.state} accessibilityRole={failed ? "alert" : undefined}>
      {!failed && <ActivityIndicator color={colors.muted} />}
      <Text style={styles.label}>{message}</Text>
      {actionLabel && onAction && (
        <Touchable accessibilityRole="button" style={styles.stateButton} onPress={onAction}>
          <Text style={styles.label}>{actionLabel}</Text>
        </Touchable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  disabled: { opacity: 0.5 },
  row: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 },
  canvas: { flex: 1, overflow: "hidden", backgroundColor: colors.bg },
  overlay: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    zIndex: 30,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  backdrop: { backgroundColor: "rgba(0, 0, 0, 0.6)" },
  dialog: {
    width: 350,
    maxWidth: "100%",
    maxHeight: "100%",
    padding: 20,
    borderRadius: 20,
    backgroundColor: colors.bg,
  },
  volumeDialog: {},
  timingDialog: { gap: 20, alignItems: "stretch" },
  instrumentDialog: { gap: 16 },
  sourceDialog: { width: 540, gap: 16 },
  dialogTitle: {
    color: colors.fg,
    fontSize: 16,
    lineHeight: 19,
    fontWeight: "700",
    marginBottom: 22,
  },
  dialogTitleTight: { color: colors.fg, fontSize: 16, lineHeight: 19, fontWeight: "700" },
  dialogHeading: { color: colors.fg, fontSize: 16, lineHeight: 22, fontWeight: "700" },
  label: { color: colors.fg, fontSize: 14, lineHeight: 18, fontWeight: "500" },
  muted: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  caption: { color: colors.muted, fontSize: 12, lineHeight: 16 },
  alert: { color: colors.error, fontSize: 14, lineHeight: 20 },
  identity: { flexDirection: "row", justifyContent: "space-between", marginBottom: 20 },
  identityText: { flex: 1, gap: 10 },
  identityName: { color: colors.fg, fontSize: 16, lineHeight: 19, fontWeight: "700" },
  volumeRow: { flexDirection: "row", alignItems: "center", gap: 12, alignSelf: "stretch" },
  timingRow: { flexDirection: "row", alignItems: "center", gap: 16, alignSelf: "stretch" },
  timingNumber: {
    width: 72,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    fontWeight: "600",
  },
  volumeIcon: { marginRight: 18 },
  instrumentChange: { marginTop: 20 },
  emptyMidiButton: { minHeight: 44, marginTop: 12 },
  slider: { height: 30, justifyContent: "center" },
  sliderTrack: {
    height: 5,
    borderRadius: 10,
    backgroundColor: colors.line,
    overflow: "hidden",
  },
  sliderFill: { height: 5, backgroundColor: colors.fg },
  sliderThumb: {
    position: "absolute",
    width: 9,
    height: 9,
    marginLeft: -4.5,
    borderRadius: 4.5,
    backgroundColor: colors.fg,
  },
  number: {
    width: 52,
    height: 30,
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRadius: 6,
    backgroundColor: colors.surface,
    color: colors.fg,
    fontSize: 16,
    fontWeight: "500",
    textAlign: "center",
  },
  dialogButton: {
    minHeight: 36,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
  },
  dialogButtonSecondary: { backgroundColor: colors.surface },
  dialogButtonText: { color: colors.fg, fontSize: 14, lineHeight: 20, fontWeight: "500" },
  wide: { alignSelf: "stretch" },
  instrumentList: { maxHeight: 220, flexGrow: 0 },
  instrumentGroups: { gap: 16 },
  legend: { color: colors.muted, fontSize: 16, lineHeight: 22, fontWeight: "700", marginBottom: 8 },
  parts: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  part: {
    minHeight: 36,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.surface,
  },
  partChecked: { backgroundColor: colors.primary },
  partText: { color: colors.fg, fontSize: 14, lineHeight: 20, fontWeight: "500" },
  signatureRow: { flexDirection: "row", alignItems: "center", gap: 12, alignSelf: "stretch" },
  signatureSlash: { color: colors.muted, fontSize: 18, fontWeight: "700" },
  sourceHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sourceClose: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  sourceChipScroll: { flexGrow: 0 },
  sourceChipRow: { alignItems: "center", gap: 8, paddingVertical: 4 },
  sourceChip: {
    minHeight: 28,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  sourceChipActive: { borderColor: colors.primary, backgroundColor: colors.primary },
  sourceChipText: { color: colors.muted, fontSize: 12, lineHeight: 18, fontWeight: "500" },
  sourceChipTextActive: { color: colors.fg, fontWeight: "500" },
  search: {
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: colors.surface,
    color: colors.fg,
    fontSize: 14,
  },
  sourceResults: { maxHeight: 180, flexGrow: 0 },
  sourceRows: { gap: 16 },
  sourceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
  },
  sourceRowText: { flex: 1, gap: 8 },
  sourceTitle: { color: colors.fg, fontSize: 16, lineHeight: 20, fontWeight: "600" },
  state: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 20 },
  stateButton: {
    borderRadius: 7,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: colors.primary,
  },
});
