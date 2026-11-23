import { useRef, useState } from "react";
import { ActivityIndicator, PanResponder, StyleSheet, Text, View } from "react-native";

import {
  centerAudioSelection,
  moveAudioSelection,
  resizeAudioSelectionEnd,
  resizeAudioSelectionStart,
} from "../../../src/features/composition/audio-trim-selection";
import type { NativeAudioTrim } from "../../../src/lib/native-screens";
import { Touchable } from "../../ui/kit";
import { useScreen } from "../../ui/screen-context";
import { colors } from "../../ui/theme";
import { Slider } from "../studio/parts";

type Selection = { startMs: number; endMs: number };
type Drag = { mode: "move" | "start" | "end"; selection: Selection };

/** Same format as the web's trim picker (mm:ss.t). */
export const formatTrimTime = (ms: number) =>
  `${String(Math.floor(ms / 60_000)).padStart(2, "0")}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}.${Math.floor((ms % 1000) / 100)}`;

const handleWidth = 18;

/**
 * The web's AudioTrimPicker. Dragging the selection or its handles and tapping the waveform run
 * here with the web's rules; the final selection is sent on release (`trim-select`).
 */
export function AudioTrim({ trim }: { trim: NativeAudioTrim | null }) {
  const { act } = useScreen();
  if (!trim) return null;
  return (
    <View style={styles.picker}>
      {trim.durationMs !== null && trim.selection ? (
        <Loaded trim={trim} durationMs={trim.durationMs} selection={trim.selection} />
      ) : trim.error ? null : (
        <Loading label="오디오 길이를 읽는 중입니다." />
      )}
      {trim.error && (
        <Text accessibilityRole="alert" style={styles.error}>
          {trim.error}
        </Text>
      )}
      <View style={styles.actions}>
        {trim.cancel && (
          <Touchable
            accessibilityRole="button"
            accessibilityState={{ disabled: trim.busy }}
            disabled={trim.busy}
            style={[styles.action, trim.busy && styles.disabled]}
            onPress={() => act({ type: "trim-cancel" })}
          >
            <Text style={styles.actionText}>취소</Text>
          </Touchable>
        )}
        <Touchable
          accessibilityRole="button"
          accessibilityState={{ disabled: !trim.selection || trim.busy }}
          disabled={!trim.selection || trim.busy}
          style={[styles.action, styles.primary, (!trim.selection || trim.busy) && styles.disabled]}
          onPress={() => act({ type: "trim-save" })}
        >
          <Text style={styles.actionText}>{trim.busy ? "올리는 중..." : trim.saveLabel}</Text>
        </Touchable>
      </View>
    </View>
  );
}

function Loading({ label }: { label: string }) {
  return (
    <View accessibilityRole="progressbar" style={styles.loading}>
      <ActivityIndicator size="small" color={colors.fg} />
      <Text style={styles.caption}>{label}</Text>
    </View>
  );
}

function Loaded({
  trim,
  durationMs,
  selection: committed,
}: {
  trim: NativeAudioTrim;
  durationMs: number;
  selection: Selection;
}) {
  const { act } = useScreen();
  const [draft, setDraft] = useState<Selection | null>(null);
  const selection = draft ?? committed;
  const [seen, setSeen] = useState(committed);
  if (seen.startMs !== committed.startMs || seen.endMs !== committed.endMs) {
    setSeen(committed);
    setDraft(null);
  }
  const width = useRef(1);
  const drag = useRef<Drag | null>(null);
  const dragged = useRef<Selection | null>(null);
  const latest = useRef({ committed, durationMs, act });
  latest.current = { committed, durationMs, act };

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (event) => {
        const { committed: current, durationMs: total } = latest.current;
        const x = event.nativeEvent.locationX;
        const startX = (current.startMs / total) * width.current;
        const endX = (current.endMs / total) * width.current;
        const mode =
          x >= startX - 4 && x <= startX + handleWidth
            ? "start"
            : x >= endX - handleWidth && x <= endX + 4
              ? "end"
              : x > startX && x < endX
                ? "move"
                : null;
        if (mode) {
          drag.current = { mode, selection: current };
          return;
        }
        // A tap outside the selection centres it there, like the web's pointerdown.
        drag.current = null;
        const next = centerAudioSelection(
          current,
          Math.max(0, Math.min(1, x / width.current)) * total,
          total,
        );
        latest.current.act({ type: "trim-select", ...next });
      },
      onPanResponderMove: (_, gesture) => {
        const state = drag.current;
        if (!state) return;
        const total = latest.current.durationMs;
        const deltaMs = (gesture.dx / width.current) * total;
        dragged.current =
          state.mode === "move"
            ? moveAudioSelection(state.selection, deltaMs, total)
            : state.mode === "start"
              ? resizeAudioSelectionStart(state.selection, state.selection.startMs + deltaMs)
              : resizeAudioSelectionEnd(state.selection, state.selection.endMs + deltaMs, total);
        setDraft(dragged.current);
      },
      onPanResponderRelease: () => finish(),
      onPanResponderTerminate: () => finish(),
    }),
  ).current;

  function finish() {
    const final = dragged.current;
    drag.current = null;
    dragged.current = null;
    // The drawn selection stays until the page reports the new one (no flash back).
    if (final) latest.current.act({ type: "trim-select", ...final });
  }

  function nudge(handle: "start" | "end", direction: number) {
    act({
      type: "trim-select",
      ...(handle === "start"
        ? resizeAudioSelectionStart(committed, committed.startMs + direction * 100)
        : resizeAudioSelectionEnd(committed, committed.endMs + direction * 100, durationMs)),
    });
  }

  const start = (selection.startMs / durationMs) * 100;
  const end = (selection.endMs / durationMs) * 100;
  const position = draft ? selection.startMs : trim.positionMs;
  return (
    <>
      <View style={styles.summary}>
        <Text style={styles.summaryLead}>
          <Text style={styles.summaryStrong}>
            {formatTrimTime(selection.endMs - selection.startMs)}
          </Text>{" "}
          선택
        </Text>
        <Text style={styles.summaryRange}>
          {formatTrimTime(selection.startMs)} – {formatTrimTime(selection.endMs)}
        </Text>
      </View>
      <View style={styles.previewRow}>
        <Touchable
          accessibilityRole="button"
          accessibilityLabel={trim.previewing ? "미리 듣기 정지" : "선택 구간 미리 듣기"}
          style={styles.previewToggle}
          onPress={() => act({ type: "trim-preview" })}
        >
          <Text style={styles.previewToggleText}>{trim.previewing ? "■" : "▶"}</Text>
        </Touchable>
        <Text style={styles.previewTime}>{formatTrimTime(position)}</Text>
        <Slider
          value={position}
          min={selection.startMs}
          max={selection.endMs}
          label="미리 듣기 위치"
          valueText={formatTrimTime(position)}
          style={styles.flex}
          onChange={(value) =>
            act({ type: "trim-position", positionMs: Math.round(value / 100) * 100 })
          }
        />
      </View>
      <Text style={styles.guide}>
        선택 영역을 움직이거나 양쪽 손잡이로 길이를 조절하세요. 최대 1분까지 저장할 수 있습니다.
      </Text>
      <View
        style={styles.waveform}
        accessibilityLabel="오디오 구간 선택 파형"
        onLayout={(event) => {
          width.current = Math.max(1, event.nativeEvent.layout.width);
        }}
        {...responder.panHandlers}
      >
        {trim.peaks ? (
          <View style={styles.bars} pointerEvents="none">
            {trim.peaks.map((peak, index) => (
              <View key={index} style={[styles.bar, { height: `${Math.round(peak * 82)}%` }]} />
            ))}
          </View>
        ) : (
          <View style={styles.waveformState} pointerEvents="none">
            {trim.waveformFailed ? (
              <Text style={styles.caption}>파형을 표시할 수 없습니다.</Text>
            ) : (
              <Loading label="파형을 계산하는 중입니다." />
            )}
          </View>
        )}
        <View pointerEvents="none" style={[styles.shade, { left: 0, width: `${start}%` }]} />
        <View pointerEvents="none" style={[styles.shade, { left: `${end}%`, right: 0 }]} />
        <View
          pointerEvents="box-none"
          style={[styles.selection, { left: `${start}%`, width: `${end - start}%` }]}
        >
          <Handle side="start" onNudge={(direction) => nudge("start", direction)} />
          <Handle side="end" onNudge={(direction) => nudge("end", direction)} />
        </View>
      </View>
      <View style={styles.times}>
        <Text style={styles.timeText}>00:00.0</Text>
        <Text style={styles.timeText}>{formatTrimTime(durationMs)}</Text>
      </View>
    </>
  );
}

/** A selection edge; screen readers adjust it in 0.1 s steps (the web's arrow keys). */
function Handle({
  side,
  onNudge,
}: {
  side: "start" | "end";
  onNudge: (direction: number) => void;
}) {
  return (
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={side === "start" ? "시작 위치 조절" : "종료 위치 조절"}
      accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
      onAccessibilityAction={(event) =>
        onNudge(event.nativeEvent.actionName === "increment" ? 1 : -1)
      }
      pointerEvents="none"
      style={[styles.handle, side === "start" ? styles.handleStart : styles.handleEnd]}
    >
      <View style={styles.grip} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  picker: { width: "100%", maxWidth: 520, gap: 12 },
  loading: { flexDirection: "row", alignItems: "center", gap: 8 },
  caption: { color: colors.fg, fontSize: 12, lineHeight: 18 },
  error: { color: "#ff9ca8", fontSize: 14, lineHeight: 20 },
  summary: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 12,
  },
  summaryLead: { color: "#c5cbd2", fontSize: 14, fontVariant: ["tabular-nums"] },
  summaryStrong: { color: "#ffffff", fontSize: 20, fontWeight: "700" },
  summaryRange: { color: "#f4f1fa", fontSize: 14, fontVariant: ["tabular-nums"] },
  previewRow: { flexDirection: "row", alignItems: "center", gap: 9 },
  previewToggle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    paddingLeft: 2,
    backgroundColor: "#ffffff",
  },
  previewToggleText: { color: "#15161a", fontSize: 14 },
  previewTime: { width: 55, color: "#d8dce1", fontSize: 14, fontVariant: ["tabular-nums"] },
  guide: { color: "#bac4cd", fontSize: 14, lineHeight: 20 },
  waveform: {
    height: 112,
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: "#242a30",
  },
  bars: {
    position: "absolute",
    top: 10,
    bottom: 10,
    left: 6,
    right: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  bar: { flex: 1, minWidth: 1, borderRadius: 99, backgroundColor: "#c4c9d0" },
  waveformState: {
    ...StyleSheet.absoluteFill,
    zIndex: 3,
    alignItems: "center",
    justifyContent: "center",
  },
  shade: { position: "absolute", top: 0, bottom: 0, zIndex: 1, backgroundColor: "#15191dcc" },
  selection: {
    position: "absolute",
    top: 4,
    bottom: 4,
    zIndex: 2,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: colors.accent,
    shadowColor: "#7138ff",
    shadowOpacity: 1,
    shadowRadius: 1,
  },
  handle: {
    position: "absolute",
    top: -2,
    bottom: -2,
    width: handleWidth,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.accent,
  },
  handleStart: {
    left: -2,
    borderTopLeftRadius: 9,
    borderBottomLeftRadius: 9,
    borderTopRightRadius: 3,
    borderBottomRightRadius: 3,
  },
  handleEnd: {
    right: -2,
    borderTopLeftRadius: 3,
    borderBottomLeftRadius: 3,
    borderTopRightRadius: 9,
    borderBottomRightRadius: 9,
  },
  grip: { width: 3, height: 28, borderRadius: 99, backgroundColor: "#ffffff" },
  times: { flexDirection: "row", justifyContent: "space-between", marginTop: -8 },
  timeText: { color: "#929ba5", fontSize: 14, fontVariant: ["tabular-nums"] },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-end",
    gap: 8,
    marginTop: 3,
  },
  action: {
    borderRadius: 7,
    paddingVertical: 7,
    paddingHorizontal: 10,
    backgroundColor: colors.surface,
  },
  primary: { backgroundColor: colors.primary },
  actionText: { color: "#ffffff", fontSize: 14 },
  disabled: { opacity: 0.5 },
});
