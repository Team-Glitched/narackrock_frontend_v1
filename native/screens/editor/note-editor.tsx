import type { ReactNode } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import type { NativeNoteEditor, NativeTransport } from "../../../src/lib/native-screens";
import MetronomeIcon from "../../../public/figma/metronome.svg";
import PlayIcon from "../../../public/figma/play.svg";
import ReturnIcon from "../../../public/figma/return.svg";
import SoundIcon from "../../../public/figma/sound.svg";
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
  Slider,
  SourceSheet,
  TimingSheet,
} from "../studio/parts";
import { AddButton, StudioToolbar, useTransport } from "../studio/toolbar";
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
        <View style={styles.portraitVolume}>
          <SoundIcon width={20} height={17} />
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
        {model.instrument && (
          <Readout
            small="악기"
            value={model.instrument.label}
            label="악기 선택"
            onPress={() => act({ type: "editor-instrument-open" })}
          />
        )}
      </ScrollView>
      {model.editable && <NoteControls roll={model.roll} tools={false} />}
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
        <Text style={styles.rewind}>|&lt;</Text>
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
        <MetronomeIcon width={15} height={22} />
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

/** Draft status ("변경 없음", "개인 초안 저장됨", …). */
function StatusRow({ model }: { model: Ready }) {
  return (
    <View style={styles.status}>
      {model.statusText !== null && (
        <Text accessibilityLiveRegion="polite" style={styles.statusText} numberOfLines={1}>
          {model.statusText}
        </Text>
      )}
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
            <DialogButton
              label="버리기"
              wide
              tone="secondary"
              disabled={model.exit.busy}
              onPress={() => act({ type: "editor-exit-discard" })}
            />
            <DialogButton
              label="복구본 내보내기"
              wide
              tone="secondary"
              onPress={() => act({ type: "editor-export" })}
            />
            <DialogButton
              label="계속 편집"
              wide
              tone="secondary"
              disabled={model.exit.busy}
              onPress={() => act({ type: "editor-exit-cancel" })}
            />
          </View>
        </Dialog>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  page: { flex: 1, backgroundColor: colors.bg },
  srOnly: { position: "absolute", width: 1, height: 1, opacity: 0 },
  portraitTop: { height: 56, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16 },
  portraitIcon: { width: 36, height: 36, alignItems: "center", justifyContent: "center", borderRadius: 10 },
  portraitVolume: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 },
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
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: colors.surface,
  },
  readoutSmall: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  readoutPlus: { color: colors.fg, fontSize: 14, lineHeight: 20 },
  readoutValue: { color: colors.fg, fontSize: 14, lineHeight: 20, fontVariant: ["tabular-nums"] },
  portraitRoll: { flex: 1, minHeight: 0 },
  portraitBottom: { marginHorizontal: 16, marginTop: 12, marginBottom: 24, gap: 16 },
  transport: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 32 },
  round: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  roundPressed: { backgroundColor: colors.primary },
  rewind: { color: colors.fg, fontSize: 20, lineHeight: 26, fontWeight: "700" },
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
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 2,
  },
  statusText: { flex: 1, minWidth: 0, color: colors.muted, fontSize: 14, lineHeight: 16 },
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
  exitActions: { gap: 8, paddingTop: 8 },
});
