import type { ReactNode } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import type { NativeNoteEditor, NativeTransport } from "../../../src/lib/native-screens";
import PlayIcon from "../../../public/figma/play.svg";
import ReturnIcon from "../../../public/figma/return.svg";
import { Touchable } from "../../ui/kit";
import { useScreen } from "../../ui/screen-context";
import { useDevicePortrait } from "../../ui/use-device-portrait";
import { colors } from "../../ui/theme";
import {
  CanvasState,
  Dialog,
  DialogButton,
  InstrumentSheet,
  StudioCanvas,
  SourceSheet,
  TimingSheet,
} from "../studio/parts";
import { AddButton, MetronomeGlyph, RewindIcon, StudioToolbar, useTransport } from "../studio/toolbar";
import type { ScreenProps } from "../types";
import { NoteControls, NoteRoll, NoteRollSheets, NoteTools } from "./roll";

type Ready = Extract<NativeNoteEditor, { status: "ready" }>;

/** /studio/:projectId/tracks/:trackId/notes: the web's NoteEditorScreen, landscape or portrait. */
export function NoteEditorScreen({ model }: ScreenProps<"editor-notes">) {
  const { act } = useScreen();
  const portrait = useDevicePortrait();
  if (model.status !== "ready")
    return (
      <View style={styles.page}>
        <CanvasState
          message={model.message}
          failed={model.status === "error"}
          actionLabel="돌아가기"
          onAction={() => act({ type: "back" })}
        />
      </View>
    );
  return portrait ? (
    <View style={styles.page}>
      <Portrait model={model} />
      <Overlays model={model} />
    </View>
  ) : (
    <StudioCanvas>
      <View style={styles.page}>
        <StudioToolbar
          transport={model.transport}
          title={model.title}
          timingEditable={model.timingEditable}
          piano
          onBack={() => act({ type: "back" })}
          onRewind={() => act({ type: "editor-rewind" })}
          onSample={model.canImportSource ? () => act({ type: "source-open" }) : undefined}
          instrument={
            model.instrument
              ? { label: model.instrument.label, onPress: () => act({ type: "editor-instrument-open" }) }
              : undefined
          }
          clipStartMs={model.roll.clipStartMs}
        >
          <AddButton label="레이어 목록" onPress={() => act({ type: "editor-layers" })} />
        </StudioToolbar>
        {model.editable && <NoteControls roll={model.roll} />}
        <StatusRow model={model} />
        <Notices model={model} />
        <NoteRoll roll={model.roll} />
        <Overlays model={model} />
      </View>
    </StudioCanvas>
  );
}

/** The landscape controls restacked for the upright canvas (the web's PortraitNoteEditor). */
function Portrait({ model }: { model: Ready }) {
  const { act } = useScreen();
  const { transport } = model;
  return (
    <>
      <Text accessibilityRole="header" style={styles.srOnly}>
        {model.title}
      </Text>
      <View style={styles.portraitTop}>
        <Touchable
          accessibilityRole="button"
          accessibilityLabel="뒤로"
          style={styles.portraitIcon}
          onPress={() => act({ type: "back" })}
        >
          <ReturnIcon width={22.5} height={22.5} />
        </Touchable>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.portraitTopCenter}
          contentContainerStyle={styles.portraitQuickActions}
        >
          {model.instrument && (
            <Touchable
              accessibilityRole="button"
              accessibilityLabel="악기 선택"
              style={styles.portraitChip}
              onPress={() => act({ type: "editor-instrument-open" })}
            >
              <Text style={styles.readoutSmall}>악기</Text>
              <Text style={styles.portraitChipText} numberOfLines={1}>
                {model.instrument.label}
              </Text>
            </Touchable>
          )}
          {model.editable && model.roll.canChord && (
            <Touchable
              accessibilityRole="button"
              accessibilityLabel="코드 입력"
              style={styles.portraitChip}
              onPress={() => act({ type: "roll-chords-open" })}
            >
              <Text style={styles.portraitChipText}>코드 입력</Text>
            </Touchable>
          )}
          {model.editable && model.roll.drum && (
            <Touchable
              accessibilityRole="button"
              accessibilityLabel={`전체 키트${model.roll.hidden ? `, 숨은 노트 ${model.roll.hidden}개` : ""}`}
              accessibilityState={{ selected: model.roll.expandedDrums }}
              style={[styles.portraitChip, model.roll.expandedDrums && styles.portraitChipActive]}
              onPress={() => act({ type: "roll-drums", expanded: !model.roll.expandedDrums })}
            >
              <Text style={[styles.portraitChipText, model.roll.expandedDrums && styles.portraitChipTextActive]}>
                전체 키트{model.roll.hidden > 0 ? ` +${model.roll.hidden}` : ""}
              </Text>
            </Touchable>
          )}
        </ScrollView>
        <Touchable
          accessibilityRole="button"
          accessibilityLabel="레이어 목록"
          style={styles.portraitAdd}
          onPress={() => act({ type: "editor-layers" })}
        >
          <View style={styles.plusH} />
          <View style={styles.plusV} />
        </Touchable>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.readoutScroll}
        contentContainerStyle={styles.readouts}
      >
        <Readout
          small="bpm"
          value={String(transport.bpm)}
          label={model.timingEditable ? "bpm 설정" : undefined}
          onPress={model.timingEditable ? () => act({ type: "timing-open", kind: "bpm" }) : undefined}
        />
        <Readout
          small="beat"
          value={`${transport.numerator}/${transport.denominator}`}
          label={model.timingEditable ? "박자 설정" : undefined}
          onPress={model.timingEditable ? () => act({ type: "timing-open", kind: "beat" }) : undefined}
        />
        <LiveTime transport={transport} clipStartMs={model.roll.clipStartMs} maxMs={model.roll.maxTick * model.roll.tickMs} />
        {model.canImportSource && (
          <Readout small="+" value="샘플" label="샘플 추가" onPress={() => act({ type: "source-open" })} plain />
        )}
      </ScrollView>
      {model.editable && <NoteControls roll={model.roll} tools={false} showModeAction={false} />}
      <StatusRow model={model} />
      <Notices model={model} />
      <View style={styles.portraitRoll}>
        <NoteRoll roll={model.roll} rowHeight={40} keyWidth={44} />
      </View>
      <View style={styles.portraitBottom}>
        {model.editable && <NoteTools roll={model.roll} large />}
        <PortraitTransport transport={transport} />
      </View>
    </>
  );
}

function Recommendation({ model }: { model: Ready }) {
  const { act } = useScreen();
  const recommendation = model.recommendation;
  if (!recommendation) return null;
  const panel = recommendation.panel;
  return (
    // Wraps instead of scrolling so "추천 코드 넣기" stays visible on an upright phone.
    <View style={[styles.recommendation, panel && styles.flex]}>
      {panel && (
        <>
          <Touchable
            accessibilityRole="button"
            accessibilityLabel="추천 노트 위치로 이동"
            style={styles.recChip}
            onPress={() => act({ type: "editor-chord-reveal" })}
          >
            <Text style={styles.recommendationText}>◎</Text>
          </Touchable>
          {panel.names.map((name, index) => (
            <Touchable
              key={name}
              accessibilityRole="button"
              accessibilityState={{ selected: index === panel.index }}
              style={[styles.recChip, index === panel.index && styles.recChipActive]}
              onPress={() => act({ type: "editor-chord-select", index })}
            >
              <Text style={[styles.recommendationText, index === panel.index && styles.recTextActive]}>
                {name}
              </Text>
            </Touchable>
          ))}
          <Touchable style={styles.recChip} onPress={() => act({ type: "editor-chord-listen" })}>
            <Text style={styles.recommendationText}>{panel.playing ? "미리듣기 정지" : "미리듣기"}</Text>
          </Touchable>
          <Touchable style={[styles.recChip, styles.recChipActive]} onPress={() => act({ type: "editor-chord-apply" })}>
            <Text style={[styles.recommendationText, styles.recTextActive]}>추천 코드 넣기</Text>
          </Touchable>
          <Touchable style={styles.recDismiss} onPress={() => act({ type: "editor-chord-dismiss" })}>
            <Text style={styles.recDismissText}>건너뛰기</Text>
          </Touchable>
        </>
      )}
      <Touchable
        style={[styles.recChip, recommendation.enabled && styles.recToggleOn]}
        onPress={() => act({ type: "editor-chord-toggle" })}
        accessibilityRole="button"
        accessibilityState={{ checked: recommendation.enabled }}
      >
        <Text style={[styles.recommendationText, recommendation.enabled && styles.recToggleText]}>
          코드 추천 {recommendation.enabled ? "켜짐" : "꺼짐"}
        </Text>
      </Touchable>
    </View>
  );
}

function PortraitTransport({ transport }: { transport: NativeTransport }) {
  const { act } = useScreen();
  const { playing } = useTransport(transport);
  return (
    <View style={styles.transport}>
      <Touchable
        accessibilityRole="button"
        accessibilityLabel="처음으로"
        style={styles.round}
        onPress={() => act({ type: "editor-rewind" })}
      >
        <RewindIcon size={20} />
      </Touchable>
      <Touchable
        accessibilityRole="button"
        accessibilityLabel={playing ? "일시정지" : "재생"}
        style={styles.play}
        onPress={() => act({ type: playing ? "transport-pause" : "transport-play" })}
      >
        {playing ? (
          <View style={styles.pause}>
            <View style={styles.pauseBar} />
            <View style={styles.pauseBar} />
          </View>
        ) : (
          <PlayIcon width={28} height={28} />
        )}
      </Touchable>
      <Touchable
        accessibilityRole="button"
        accessibilityLabel="메트로놈"
        accessibilityState={{ checked: transport.metronome }}
        style={[styles.round, transport.metronome && styles.roundPressed]}
        onPress={() => act({ type: "transport-metronome" })}
      >
        <MetronomeGlyph active={false} size={22} />
      </Touchable>
    </View>
  );
}

const clock = (ms: number) =>
  `${String(Math.floor(ms / 60000)).padStart(2, "0")}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}`;

/** The clip-local time readout ("00:mm:ss"), from the live engine position. */
function LiveTime({ transport, clipStartMs, maxMs }: { transport: NativeTransport; clipStartMs: number; maxMs: number }) {
  const { positionMs } = useTransport(transport);
  return <Readout small="time" value={`00:${clock(Math.min(maxMs, Math.max(0, positionMs - clipStartMs)))}`} />;
}

function Readout({
  small,
  value,
  label,
  onPress,
  plain = false,
}: {
  small: string;
  value: string;
  label?: string;
  onPress?: () => void;
  /** "+ 샘플": no divider after the small text. */
  plain?: boolean;
}) {
  const body = (
    <>
      <Text style={plain ? styles.readoutPlus : styles.readoutSmall}>{small}</Text>
      <Text style={styles.readoutValue} numberOfLines={1}>
        {value}
      </Text>
    </>
  );
  return onPress ? (
    <Touchable accessibilityRole="button" accessibilityLabel={label} style={styles.readout} onPress={onPress}>
      {body}
    </Touchable>
  ) : (
    <View style={styles.readout}>{body}</View>
  );
}

/** Draft status ("변경 없음", "개인 초안 저장됨", …); visually yields to a shown chord suggestion. */
function StatusRow({ model }: { model: Ready }) {
  const suggesting = Boolean(model.recommendation?.panel);
  return (
    <View style={styles.status}>
      {model.statusText !== null && (
        <Text
          accessibilityLiveRegion="polite"
          style={suggesting ? styles.srOnly : styles.statusText}
          numberOfLines={1}
        >
          {model.statusText}
        </Text>
      )}
      <Recommendation model={model} />
    </View>
  );
}

/** Draft reload, conflict recovery and the read-only notice (shown above the roll like the web). */
function Notices({ model }: { model: Ready }) {
  const { act } = useScreen();
  const items: ReactNode[] = [];
  if (model.retryLoad)
    items.push(
      <DialogButton key="retry" label="초안 다시 불러오기" onPress={() => act({ type: "editor-retry-load" })} />,
    );
  if (model.conflict)
    items.push(
      <DialogButton
        key="server"
        label="서버본 열기"
        disabled={model.busy}
        onPress={() => act({ type: "editor-use-server" })}
      />,
      <DialogButton
        key="export"
        label="로컬 복구본 내보내기"
        tone="secondary"
        onPress={() => act({ type: "editor-export" })}
      />,
      <DialogButton
        key="local"
        label="로컬 복구본 명시적으로 재적용"
        tone="secondary"
        disabled={model.busy}
        onPress={() => act({ type: "editor-keep-local" })}
      />,
    );
  if (!model.editable)
    items.push(
      <Text key="readonly" style={styles.notice}>
        내 MIDI 레이어만 수정할 수 있습니다.
      </Text>,
    );
  return items.length ? <View style={styles.notices}>{items}</View> : null;
}

/** Error banner and every dialog, over the whole canvas. */
function Overlays({ model }: { model: Ready }) {
  const { act } = useScreen();
  return (
    <>
      {model.error && (
        <Text accessibilityRole="alert" style={styles.error}>
          {model.error}
        </Text>
      )}
      <NoteRollSheets roll={model.roll} />
      <InstrumentSheet picker={model.instrumentPicker} />
      <TimingSheet sheet={model.timing} />
      <SourceSheet picker={model.sources} />
      {model.exit && (
        <Dialog label="개인 초안을 어떻게 할까요?" onClose={() => act({ type: "editor-exit-cancel" })}>
          <Text accessibilityRole="header" style={styles.dialogTitle}>
            개인 초안을 어떻게 할까요?
          </Text>
          <Text style={styles.dialogText}>
            저장 후 나가기는 공유 클립에 반영합니다. 초안 유지는 다른 참여자의 공유본을 바꾸지 않습니다.
          </Text>
          <View style={styles.exitActions}>
            <DialogButton
              label="저장 후 나가기"
              wide
              disabled={model.exit.saveDisabled}
              onPress={() => act({ type: "editor-exit-save" })}
            />
            <DialogButton
              label="개인 초안 유지"
              wide
              tone="secondary"
              disabled={model.exit.keepDisabled}
              onPress={() => act({ type: "editor-exit-keep" })}
            />
            <View style={styles.exitRow}>
              <Touchable
                accessibilityRole="button"
                style={styles.exitSubButton}
                onPress={() => act({ type: "editor-export" })}
              >
                <Text style={styles.exitSubText}>복구본 내보내기</Text>
              </Touchable>
              <Touchable
                accessibilityRole="button"
                accessibilityState={{ disabled: model.exit.busy }}
                disabled={model.exit.busy}
                style={[styles.exitSubButton, model.exit.busy && styles.disabled]}
                onPress={() => act({ type: "editor-exit-cancel" })}
              >
                <Text style={styles.exitSubText}>계속 편집</Text>
              </Touchable>
            </View>
            <Touchable
              accessibilityRole="button"
              accessibilityState={{ disabled: model.exit.busy }}
              disabled={model.exit.busy}
              style={[styles.exitDangerButton, model.exit.busy && styles.disabled]}
              onPress={() => act({ type: "editor-exit-discard" })}
            >
              <Text style={styles.exitDangerText}>버리기</Text>
            </Touchable>
          </View>
        </Dialog>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  recommendation: {
    minWidth: 0,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 6,
  },
  recommendationText: { color: colors.fg, fontSize: 12, lineHeight: 16, fontWeight: "500" },
  recChip: {
    height: 28,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#32323d",
    backgroundColor: "#23232a",
    alignItems: "center",
    justifyContent: "center",
  },
  recChipActive: { borderColor: colors.primary, backgroundColor: colors.primary },
  recTextActive: { color: "#ffffff", fontWeight: "700" },
  recDismiss: {
    height: 28,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#32323d",
    backgroundColor: "#1c1c23",
    alignItems: "center",
    justifyContent: "center",
  },
  recDismissText: { color: colors.muted, fontSize: 12, lineHeight: 16, fontWeight: "500" },
  recToggleOn: { borderColor: colors.primary, backgroundColor: colors.primary },
  recToggleText: { color: "#ffffff", fontWeight: "600" },
  flex: { flex: 1 },
  disabled: { opacity: 0.45 },
  page: { flex: 1, backgroundColor: colors.bg },
  srOnly: { position: "absolute", width: 1, height: 1, opacity: 0 },
  portraitTop: { height: 56, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16 },
  portraitIcon: { width: 36, height: 36, alignItems: "center", justifyContent: "center", borderRadius: 10 },
  portraitTopCenter: { flex: 1, minWidth: 0 },
  portraitQuickActions: { alignItems: "center", gap: 8 },
  portraitChip: {
    height: 36,
    maxWidth: 140,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#32323d",
    backgroundColor: "#23232a",
  },
  portraitChipText: { color: colors.fg, fontSize: 13, lineHeight: 18, fontWeight: "600", flexShrink: 1 },
  portraitChipActive: { borderColor: colors.primary, backgroundColor: colors.primary },
  portraitChipTextActive: { color: "#ffffff" },
  portraitAdd: {
    width: 56,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
  },
  plusH: { position: "absolute", width: 20, height: 2, borderRadius: 2, backgroundColor: "#d7dce2" },
  plusV: { position: "absolute", width: 2, height: 20, borderRadius: 2, backgroundColor: "#d7dce2" },
  readoutScroll: { flexGrow: 0, flexShrink: 0 },
  readouts: { height: 48, alignItems: "center", gap: 8, paddingHorizontal: 16 },
  readout: {
    height: 36,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#32323d",
    backgroundColor: "#23232a",
  },
  readoutSmall: { color: colors.muted, fontSize: 12, lineHeight: 16 },
  readoutPlus: { color: colors.fg, fontSize: 14, lineHeight: 18, fontWeight: "600" },
  readoutValue: { color: colors.fg, fontSize: 14, lineHeight: 18, fontVariant: ["tabular-nums"] },
  portraitRoll: { flex: 1, minHeight: 0 },
  portraitBottom: { marginHorizontal: 16, marginTop: 12, marginBottom: 24, gap: 16 },
  transport: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 32 },
  round: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#32323d",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#23232a",
  },
  roundPressed: { backgroundColor: colors.primary, borderColor: colors.primary },
  play: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
  },
  pause: { flexDirection: "row", gap: 6 },
  pauseBar: { width: 6, height: 24, borderRadius: 2, backgroundColor: colors.fg },
  status: {
    minHeight: 36,
    flexShrink: 0,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#2b2b34",
    backgroundColor: "#19191f",
  },
  statusText: { flex: 1, minWidth: 0, color: colors.muted, fontSize: 13, lineHeight: 16 },
  notices: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  notice: { color: colors.fg, fontSize: 14, lineHeight: 20 },
  error: {
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
    lineHeight: 18,
  },
  dialogTitle: { color: colors.fg, fontSize: 20, lineHeight: 26, fontWeight: "700" },
  dialogText: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  exitActions: { gap: 10, paddingTop: 10 },
  exitRow: { flexDirection: "row", gap: 8 },
  exitSubButton: {
    flex: 1,
    height: 40,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#2e2e38",
    backgroundColor: "#16161b",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  exitSubText: { color: colors.muted, fontSize: 13, fontWeight: "500" },
  exitDangerButton: {
    height: 40,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(225, 29, 72, 0.4)",
    backgroundColor: "rgba(225, 29, 72, 0.16)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  exitDangerText: { color: "#fda4af", fontSize: 14, fontWeight: "600" },
});
