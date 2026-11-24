import { useMemo, useRef, useState } from "react";
import { ActivityIndicator, PanResponder, ScrollView, StyleSheet, Text, View } from "react-native";

import {
  beatMarksForDuration,
  totalSegmentsMs,
} from "../../../src/features/composition/audio-splice";
import {
  centerAudioSelection,
  maxAudioClipMs,
  minAudioClipMs,
  moveAudioSelection,
  resizeAudioSelectionEnd,
  resizeAudioSelectionStart,
} from "../../../src/features/composition/audio-trim-selection";
import { parseSignature } from "../../../src/features/composition/time-signature";
import type { NativeAudioTrim } from "../../../src/lib/native-screens";
import { Touchable } from "../../ui/kit";
import { useScreen } from "../../ui/screen-context";
import { colors } from "../../ui/theme";
import { Slider } from "../studio/parts";

type Selection = { startMs: number; endMs: number };
type Drag = { mode: "move" | "start" | "end"; selection: Selection; grantX: number };

/** Same format as the web's trim picker (mm:ss.t). */
export const formatTrimTime = (ms: number) =>
  `${String(Math.floor(Math.max(0, ms) / 60_000)).padStart(2, "0")}:${String(
    Math.floor(Math.max(0, ms) / 1000) % 60,
  ).padStart(2, "0")}.${Math.floor((Math.max(0, ms) % 1000) / 100)}`;

const handleWidth = 16;

function computeDimmedGaps(segments: readonly Selection[], durationMs: number): Selection[] {
  if (!segments.length || durationMs <= 0) return [{ startMs: 0, endMs: Math.max(0, durationMs) }];
  const sorted = [...segments]
    .map((s) => ({
      startMs: Math.max(0, Math.min(durationMs, s.startMs)),
      endMs: Math.max(0, Math.min(durationMs, s.endMs)),
    }))
    .filter((s) => s.endMs > s.startMs)
    .sort((a, b) => a.startMs - b.startMs);
  if (!sorted.length) return [{ startMs: 0, endMs: durationMs }];
  const merged: Selection[] = [sorted[0]];
  for (let i = 1; i < sorted.length; i += 1) {
    const prev = merged[merged.length - 1];
    if (sorted[i].startMs <= prev.endMs) prev.endMs = Math.max(prev.endMs, sorted[i].endMs);
    else merged.push(sorted[i]);
  }
  const gaps: Selection[] = [];
  let cursor = 0;
  for (const seg of merged) {
    if (seg.startMs > cursor) gaps.push({ startMs: cursor, endMs: seg.startMs });
    cursor = Math.max(cursor, seg.endMs);
  }
  if (cursor < durationMs) gaps.push({ startMs: cursor, endMs: durationMs });
  return gaps;
}

/**
 * The web's AudioTrimPicker: beat/bar ruler, dark studio waveform, trim handles, and simple cut/splice controls.
 */
export function AudioTrim({ trim }: { trim: NativeAudioTrim | null }) {
  const { act } = useScreen();
  if (!trim) return null;
  return (
    <View style={styles.picker}>
      {trim.durationMs !== null && trim.selection ? (
        <Loaded trim={trim} durationMs={trim.durationMs} committed={trim.selection} />
      ) : trim.error ? null : (
        <Loading label="오디오 길이를 읽는 중입니다." />
      )}
      {trim.error && (
        <Text accessibilityRole="alert" style={styles.error}>
          {trim.error}
        </Text>
      )}
      {!trim.hideActions && (
        <View style={styles.actions}>
          {trim.cancel && (
            <Touchable
              accessibilityRole="button"
              accessibilityState={{ disabled: trim.busy }}
              disabled={trim.busy}
              style={[styles.action, styles.secondaryAction, trim.busy && styles.disabled]}
              onPress={() => act({ type: "trim-cancel" })}
            >
              <Text style={styles.actionText}>취소</Text>
            </Touchable>
          )}
          <Touchable
            accessibilityRole="button"
            accessibilityState={{ disabled: !trim.selection || trim.busy }}
            disabled={!trim.selection || trim.busy}
            style={[
              styles.action,
              styles.primaryAction,
              (!trim.selection || trim.busy) && styles.disabled,
            ]}
            onPress={() => act({ type: "trim-save" })}
          >
            <Text style={styles.primaryActionText}>
              {trim.busy ? "올리는 중..." : trim.saveLabel}
            </Text>
          </Touchable>
        </View>
      )}
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
  committed,
}: {
  trim: NativeAudioTrim;
  durationMs: number;
  committed: Selection;
}) {
  const { act } = useScreen();
  const segments = useMemo(
    () => (trim.segments?.length ? trim.segments : [committed]),
    [trim.segments, committed],
  );
  const selectedIndex = Math.max(0, Math.min(segments.length - 1, trim.selectedSegmentIndex ?? 0));
  const activeSeg = segments[selectedIndex] ?? committed;

  const [draft, setDraft] = useState<Selection | null>(null);
  const selection = draft ?? activeSeg;
  const [seen, setSeen] = useState(activeSeg);
  if (seen.startMs !== activeSeg.startMs || seen.endMs !== activeSeg.endMs) {
    setSeen(activeSeg);
    setDraft(null);
  }

  const width = useRef(1);
  const drag = useRef<Drag | null>(null);
  const dragged = useRef<Selection | null>(null);
  const latest = useRef({ activeSeg, segments, durationMs, act });
  latest.current = { activeSeg, segments, durationMs, act };

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (event) => {
        const { activeSeg: current, segments: segList, durationMs: total, act: send } = latest.current;
        const x = event.nativeEvent.locationX;
        const startX = (current.startMs / total) * width.current;
        const endX = (current.endMs / total) * width.current;
        const mode =
          x >= startX - 6 && x <= startX + handleWidth
            ? "start"
            : x >= endX - handleWidth && x <= endX + 6
              ? "end"
              : x > startX && x < endX
                ? "move"
                : null;
        if (mode) {
          drag.current = { mode, selection: current, grantX: x };
          return;
        }
        drag.current = null;
        const tappedMs = Math.max(0, Math.min(1, x / width.current)) * total;
        const hitIdx = segList.findIndex((seg) => tappedMs >= seg.startMs && tappedMs <= seg.endMs);
        if (hitIdx >= 0) {
          if (hitIdx !== selectedIndex) send({ type: "trim-select-segment", index: hitIdx });
          send({ type: "trim-cursor", sourceMs: Math.round(tappedMs / 100) * 100 });
          return;
        }
        if (segList.length === 1) {
          const next = centerAudioSelection(current, tappedMs, total);
          send({ type: "trim-select", ...next });
        } else {
          send({ type: "trim-cursor", sourceMs: Math.round(tappedMs / 100) * 100 });
        }
      },
      onPanResponderMove: (_, gesture) => {
        const state = drag.current;
        if (!state) return;
        if (Math.abs(gesture.dx) < 3) return;
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
      onPanResponderRelease: (_, gesture) => {
        if (drag.current?.mode === "move" && !dragged.current && Math.abs(gesture.dx) < 4) {
          const { durationMs: total, act: send } = latest.current;
          const seg = drag.current.selection;
          const tappedMs = Math.round(((drag.current.grantX / width.current) * total) / 100) * 100;
          const clampedMs = Math.max(seg.startMs, Math.min(seg.endMs, tappedMs));
          send({ type: "trim-cursor", sourceMs: clampedMs });
        }
        finish();
      },
      onPanResponderTerminate: () => finish(),
    }),
  ).current;

  function finish() {
    const final = dragged.current;
    drag.current = null;
    dragged.current = null;
    if (final) latest.current.act({ type: "trim-select", ...final });
  }

  function nudge(handle: "start" | "end", direction: number) {
    act({
      type: "trim-select",
      ...(handle === "start"
        ? resizeAudioSelectionStart(activeSeg, activeSeg.startMs + direction * 100)
        : resizeAudioSelectionEnd(activeSeg, activeSeg.endMs + direction * 100, durationMs)),
    });
  }

  const bpm = trim.bpm ?? 120;
  const sig = parseSignature(trim.timeSignature ?? "4/4");
  const beatTimeline = useMemo(() => beatMarksForDuration(durationMs, bpm, sig), [durationMs, bpm, sig]);
  const displaySegments = useMemo(
    () => segments.map((seg, i) => (i === selectedIndex ? selection : seg)),
    [segments, selectedIndex, selection],
  );
  const totalMs = totalSegmentsMs(displaySegments);
  const dimmedGaps = useMemo(() => computeDimmedGaps(displaySegments, durationMs), [displaySegments, durationMs]);
  const cursorSourceMs = trim.cursorSourceMs ?? selection.startMs;
  const canSplit = displaySegments.some(
    (s) =>
      Math.round(cursorSourceMs / 100) * 100 >= s.startMs + minAudioClipMs &&
      Math.round(cursorSourceMs / 100) * 100 <= s.endMs - minAudioClipMs,
  );
  const canDuplicate = totalMs + (activeSeg.endMs - activeSeg.startMs) <= maxAudioClipMs;
  const position = draft ? 0 : trim.positionMs;
  const enableSplice = trim.enableSplice !== false;

  return (
    <>
      <View style={styles.summary}>
        <Text style={styles.summaryStrong}>{formatTrimTime(totalMs)}</Text>
        {displaySegments.length > 1 && (
          <Text style={styles.summaryMeta}>{displaySegments.length}조각</Text>
        )}
      </View>

      <View style={styles.waveBox}>
        <View style={styles.ruler} pointerEvents="none">
          {beatTimeline.marks.map((mark, index) => {
            const left = (mark.ms / durationMs) * 100;
            return (
              <View key={index} style={[styles.rulerMark, { left: `${left}%` }]}>
                <View style={mark.isBar ? styles.rulerBarLine : styles.rulerBeatLine} />
                {mark.label && left <= 92 && <Text style={styles.rulerLabel}>{mark.label}</Text>}
              </View>
            );
          })}
        </View>

        <View
          style={styles.waveform}
          accessibilityLabel="오디오 구간 선택 파형"
          onLayout={(event) => {
            width.current = Math.max(1, event.nativeEvent.layout.width);
          }}
          {...responder.panHandlers}
        >
          {beatTimeline.marks.map((mark, index) => (
            <View
              key={`grid-${index}`}
              pointerEvents="none"
              style={[
                styles.gridLine,
                mark.isBar ? styles.gridBar : styles.gridBeat,
                { left: `${(mark.ms / durationMs) * 100}%` },
              ]}
            />
          ))}
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
          {dimmedGaps.map((gap, index) => (
            <View
              key={`gap-${index}`}
              pointerEvents="none"
              style={[
                styles.shade,
                {
                  left: `${(gap.startMs / durationMs) * 100}%`,
                  width: `${((gap.endMs - gap.startMs) / durationMs) * 100}%`,
                },
              ]}
            />
          ))}
          {displaySegments.map((seg, index) => {
            const left = (seg.startMs / durationMs) * 100;
            const segWidth = Math.max(0.5, ((seg.endMs - seg.startMs) / durationMs) * 100);
            const isSelected = index === selectedIndex;
            return (
              <View
                key={`seg-${index}`}
                pointerEvents="box-none"
                style={[
                  styles.selection,
                  !isSelected && styles.selectionInactive,
                  { left: `${left}%`, width: `${segWidth}%` },
                ]}
              >
                {displaySegments.length > 1 && (
                  <View style={[styles.segBadge, isSelected && styles.segBadgeActive]}>
                    <Text style={styles.segBadgeText}>#{index + 1}</Text>
                  </View>
                )}
                {isSelected && (
                  <>
                    <Handle side="start" onNudge={(direction) => nudge("start", direction)} />
                    <Handle side="end" onNudge={(direction) => nudge("end", direction)} />
                  </>
                )}
              </View>
            );
          })}
          <View
            pointerEvents="none"
            style={[
              styles.playhead,
              { left: `${Math.max(0, Math.min(100, (cursorSourceMs / durationMs) * 100))}%` },
            ]}
          />
        </View>
      </View>

      <View style={styles.previewRow}>
        {!trim.hidePreviewButton && (
          <Touchable
            accessibilityRole="button"
            accessibilityLabel={trim.previewing ? "미리 듣기 정지" : "선택 구간 미리 듣기"}
            style={styles.previewToggle}
            onPress={() => act({ type: "trim-preview" })}
          >
            <Text style={styles.previewToggleText}>{trim.previewing ? "■" : "▶"}</Text>
          </Touchable>
        )}
        <Text style={styles.previewTime}>{formatTrimTime(position)}</Text>
        <Slider
          value={position}
          min={0}
          max={Math.max(100, totalMs)}
          label="미리 듣기 위치"
          valueText={formatTrimTime(position)}
          style={styles.flex}
          onChange={(value) =>
            act({ type: "trim-position", positionMs: Math.round(value / 100) * 100 })
          }
        />
        <Text style={styles.previewTotal}>{formatTrimTime(totalMs)}</Text>
      </View>

      {enableSplice && (
        <View style={styles.spliceWrap}>
          <View style={styles.toolRow}>
            <Touchable
              accessibilityRole="button"
              disabled={trim.busy || !canSplit}
              style={[styles.toolChip, (trim.busy || !canSplit) && styles.disabled]}
              onPress={() => act({ type: "trim-split" })}
            >
              <Text style={styles.toolText}>자르기</Text>
            </Touchable>
            <Touchable
              accessibilityRole="button"
              disabled={trim.busy || displaySegments.length <= 1}
              style={[styles.toolChip, (trim.busy || displaySegments.length <= 1) && styles.disabled]}
              onPress={() => act({ type: "trim-delete-segment" })}
            >
              <Text style={styles.toolText}>삭제</Text>
            </Touchable>
            <Touchable
              accessibilityRole="button"
              disabled={trim.busy || !canDuplicate}
              style={[styles.toolChip, (trim.busy || !canDuplicate) && styles.disabled]}
              onPress={() => act({ type: "trim-duplicate-segment" })}
            >
              <Text style={styles.toolText}>붙이기</Text>
            </Touchable>
            <Touchable
              accessibilityRole="button"
              disabled={trim.busy || !trim.canUndo}
              style={[styles.toolChip, (trim.busy || !trim.canUndo) && styles.disabled]}
              onPress={() => act({ type: "trim-undo" })}
            >
              <Text style={styles.toolText}>되돌리기</Text>
            </Touchable>
            <Touchable
              accessibilityRole="button"
              disabled={trim.busy || !trim.edited}
              style={[styles.toolChip, (trim.busy || !trim.edited) && styles.disabled]}
              onPress={() => act({ type: "trim-reset" })}
            >
              <Text style={styles.toolMutedText}>초기화</Text>
            </Touchable>
          </View>

          {displaySegments.length > 1 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.segList}>
              {displaySegments.map((seg, index) => {
                const active = index === selectedIndex;
                return (
                  <View key={`chip-${index}`} style={[styles.segChip, active && styles.segChipActive]}>
                    <Touchable onPress={() => act({ type: "trim-select-segment", index })}>
                      <Text style={[styles.segChipText, active && styles.segChipTextActive]}>
                        #{index + 1} {formatTrimTime(seg.startMs)}–{formatTrimTime(seg.endMs)}
                      </Text>
                    </Touchable>
                    {active && (
                      <View style={styles.segArrows}>
                        <Touchable
                          disabled={trim.busy || index === 0}
                          onPress={() => act({ type: "trim-reorder-segment", direction: -1 })}
                          style={[styles.segArrowBtn, index === 0 && styles.disabled]}
                        >
                          <Text style={styles.segChipTextActive}>‹</Text>
                        </Touchable>
                        <Touchable
                          disabled={trim.busy || index === displaySegments.length - 1}
                          onPress={() => act({ type: "trim-reorder-segment", direction: 1 })}
                          style={[styles.segArrowBtn, index === displaySegments.length - 1 && styles.disabled]}
                        >
                          <Text style={styles.segChipTextActive}>›</Text>
                        </Touchable>
                      </View>
                    )}
                  </View>
                );
              })}
            </ScrollView>
          )}
        </View>
      )}
    </>
  );
}

/** A selection edge; screen readers adjust it in 0.1 s steps. */
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
  picker: { width: "100%", maxWidth: 520, gap: 20 },
  loading: { flexDirection: "row", alignItems: "center", gap: 8 },
  caption: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  error: { color: "#ff9ca8", fontSize: 13, lineHeight: 18 },
  summary: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 8,
  },
  summaryStrong: { color: "#ffffff", fontSize: 20, fontWeight: "700", fontVariant: ["tabular-nums"] },
  summaryMeta: { color: colors.muted, fontSize: 12, fontVariant: ["tabular-nums"] },
  waveBox: {
    borderRadius: 10,
    backgroundColor: "#181820",
    overflow: "hidden",
  },
  ruler: {
    height: 24,
    borderBottomWidth: 1,
    borderBottomColor: "#2a2a35",
    backgroundColor: "#181820",
    position: "relative",
  },
  rulerMark: { position: "absolute", top: 0, bottom: 0 },
  rulerBarLine: { width: 1, height: "100%", backgroundColor: "#525268" },
  rulerBeatLine: { width: 1, height: 7, marginTop: "auto", backgroundColor: "#2d2d3d" },
  rulerLabel: {
    position: "absolute",
    top: 2,
    left: 4,
    color: "#a1a1b5",
    fontSize: 10,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  waveform: {
    height: 112,
    backgroundColor: "#14141a",
    position: "relative",
  },
  gridLine: { position: "absolute", top: 0, bottom: 0, width: 1 },
  gridBar: { backgroundColor: "rgba(255,255,255,0.07)" },
  gridBeat: { backgroundColor: "rgba(255,255,255,0.025)" },
  bars: {
    position: "absolute",
    top: 10,
    bottom: 10,
    left: 2,
    right: 2,
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  bar: { flex: 1, minWidth: 1, borderRadius: 99, backgroundColor: "rgba(199, 201, 212, 0.75)" },
  waveformState: {
    ...StyleSheet.absoluteFill,
    zIndex: 3,
    alignItems: "center",
    justifyContent: "center",
  },
  shade: { position: "absolute", top: 0, bottom: 0, zIndex: 1, backgroundColor: "rgba(11, 11, 16, 0.78)" },
  selection: {
    position: "absolute",
    top: 4,
    bottom: 4,
    zIndex: 3,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.primary,
    backgroundColor: "rgba(76, 0, 229, 0.15)",
  },
  selectionInactive: {
    zIndex: 2,
    borderWidth: 1,
    borderColor: "rgba(124, 58, 237, 0.7)",
    backgroundColor: "rgba(76, 0, 229, 0.08)",
  },
  segBadge: {
    position: "absolute",
    top: 4,
    left: 8,
    borderRadius: 4,
    backgroundColor: "rgba(35,35,42,0.9)",
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  segBadgeActive: { backgroundColor: colors.primary },
  segBadgeText: { color: "#ffffff", fontSize: 10, fontWeight: "700" },
  handle: {
    position: "absolute",
    top: -2,
    bottom: -2,
    width: handleWidth,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
  },
  handleStart: {
    left: -2,
    borderTopLeftRadius: 8,
    borderBottomLeftRadius: 8,
    borderTopRightRadius: 3,
    borderBottomRightRadius: 3,
  },
  handleEnd: {
    right: -2,
    borderTopLeftRadius: 3,
    borderBottomLeftRadius: 3,
    borderTopRightRadius: 8,
    borderBottomRightRadius: 8,
  },
  grip: { width: 2.5, height: 24, borderRadius: 99, backgroundColor: "#ffffff" },
  playhead: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 2,
    zIndex: 5,
    backgroundColor: "#ffffff",
  },
  previewRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  previewToggle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
  },
  previewToggleText: { color: "#ffffff", fontSize: 13 },
  previewTime: { width: 52, color: "#d8dce1", fontSize: 12, fontVariant: ["tabular-nums"] },
  previewTotal: { color: colors.muted, fontSize: 12, fontVariant: ["tabular-nums"] },
  spliceWrap: { gap: 12 },
  toolRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  toolChip: {
    flex: 1,
    height: 36,
    paddingHorizontal: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#32323d",
    backgroundColor: "#23232a",
    alignItems: "center",
    justifyContent: "center",
  },
  toolText: { color: colors.fg, fontSize: 11, fontWeight: "500" },
  toolMutedText: { color: colors.muted, fontSize: 11, fontWeight: "500" },
  segList: { gap: 6, paddingVertical: 2 },
  segChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#32323d",
    backgroundColor: "#23232a",
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  segChipActive: { borderColor: colors.primary, backgroundColor: "rgba(76, 0, 229, 0.2)" },
  segChipText: { color: colors.muted, fontSize: 11, fontVariant: ["tabular-nums"] },
  segChipTextActive: { color: "#ffffff", fontSize: 11, fontWeight: "600", fontVariant: ["tabular-nums"] },
  segArrows: { flexDirection: "row", alignItems: "center", gap: 2, borderLeftWidth: 1, borderLeftColor: "rgba(255,255,255,0.15)", paddingLeft: 4 },
  segArrowBtn: { paddingHorizontal: 4 },
  actions: { flexDirection: "row", gap: 12, paddingTop: 8 },
  action: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  secondaryAction: { backgroundColor: "#23232a", borderWidth: 1, borderColor: "#32323d" },
  primaryAction: { backgroundColor: colors.primary },
  actionText: { color: colors.fg, fontSize: 14, fontWeight: "600" },
  primaryActionText: { color: "#ffffff", fontSize: 14, fontWeight: "600" },
  disabled: { opacity: 0.4 },
});
