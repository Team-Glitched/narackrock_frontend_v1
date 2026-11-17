import { useEffect, useRef, useState } from "react";
import {
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ScrollViewInstance,
} from "react-native";
import Svg, { Path, Rect } from "react-native-svg";

import { rulerLabels, signatureGrid } from "../../../src/features/composition/time-signature";
import { snappedClipStart } from "../../../src/features/composition/timeline-move";
import type {
  NativeStudio,
  NativeStudioClip,
  NativeStudioTrack,
} from "../../../src/lib/native-screens";
import SoundMutedIcon from "../../../public/figma/sound-muted.svg";
import SoundIcon from "../../../public/figma/sound.svg";
import { Avatar, Touchable } from "../../ui/kit";
import { useScreen } from "../../ui/screen-context";
import { colors } from "../../ui/theme";
import type { ScreenProps } from "../types";
import { AudioTrim } from "../creation/trim";
import {
  CanvasState,
  Dialog,
  DialogButton,
  InstrumentSheet,
  Landscape,
  SourceSheet,
  TimingSheet,
  VolumeSheet,
  landscapeDelta,
  useLandscape,
} from "./parts";
import { AddButton, StudioToolbar, ToolbarTextButton, useTransport } from "./toolbar";

/** Web layout constants of the design canvas (studio.styles.ts). */
const sidebar = 98;
const rulerHeight = 25;
const laneHeight = 46;
const layerHeight = 40;

/** The studio timeline (the web's StudioScreen), drawn landscape like the web's canvas. */
export function StudioTimelineScreen({ model }: ScreenProps<"studio-timeline">) {
  const { act } = useScreen();
  return (
    <Landscape>
      {model.state ? (
        <CanvasState
          message={model.state.message}
          failed={model.state.failed}
          actionLabel={model.state.failed ? "돌아가기" : undefined}
          onAction={() => act({ type: "studio-exit" })}
        />
      ) : (
        <Studio model={model} />
      )}
    </Landscape>
  );
}

function Studio({ model }: { model: NativeStudio }) {
  const { act } = useScreen();
  const [comment, setComment] = useState("");
  const { primary } = model;
  const error = model.submit ? null : model.error;
  return (
    <View style={styles.flex}>
      <StudioToolbar
        transport={model.transport}
        title={model.title}
        timingEditable={model.timingEditable}
        onBack={() => act({ type: "studio-exit" })}
        onSample={model.canImportSource ? () => act({ type: "source-open" }) : undefined}
      >
        {primary.kind === "submit" ? (
          <ToolbarTextButton
            label="제출하기"
            disabled={primary.disabled}
            onPress={() => act({ type: "studio-primary" })}
          />
        ) : (
          <AddButton
            label={primary.kind === "publish" ? "곡 올리기" : "레이어 추가"}
            disabled={primary.disabled}
            onPress={() => act({ type: "studio-primary" })}
          />
        )}
      </StudioToolbar>
      {model.selectMidiLayer && (
        <Text style={styles.notice}>피아노롤에서 열 MIDI 레이어를 선택하세요.</Text>
      )}
      {model.contribution && (
        <View style={styles.contribution} accessibilityLiveRegion="polite">
          <Text style={styles.contributionText}>{model.contribution.text}</Text>
          {model.contribution.retry && (
            <Touchable
              accessibilityRole="button"
              onPress={() => act({ type: "studio-retry-contribution" })}
            >
              <Text style={styles.contributionText}>다시 시도</Text>
            </Touchable>
          )}
        </View>
      )}
      <Timeline model={model} />
      {error && (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      )}
      {model.status && (
        <Text accessibilityLiveRegion="polite" style={styles.status}>
          {model.status}
        </Text>
      )}
      {model.submit && (
        <SubmitForm submit={model.submit} comment={comment} onComment={setComment} />
      )}
      {model.publishForm && <PublishForm form={model.publishForm} />}
      {model.publishConfirm && (
        <Dialog
          label="정말로 올리시겠습니까?"
          onClose={() => act({ type: "studio-publish-close" })}
          style={styles.confirm}
        >
          <Text style={styles.confirmTitle} accessibilityRole="header">
            정말로 올리시겠습니까?
          </Text>
          <Touchable
            accessibilityRole="button"
            style={styles.confirmButton}
            onPress={() => act({ type: "studio-publish-confirm" })}
          >
            <Text style={styles.confirmButtonText}>확인</Text>
          </Touchable>
        </Dialog>
      )}
      {model.trackSettings && (
        <VolumeSheet
          identity={{ name: model.trackSettings.name, part: model.trackSettings.part }}
          value={model.trackSettings.volume}
          onChange={(value) =>
            act({ type: "studio-track-volume", trackId: model.trackSettings!.trackId, value })
          }
          onClose={() => act({ type: "studio-track-close" })}
          onChangeInstrument={
            model.trackSettings.canChangeInstrument
              ? () => act({ type: "studio-change-instrument" })
              : undefined
          }
        />
      )}
      <InstrumentSheet picker={model.instrument} />
      <TimingSheet sheet={model.timing} />
      <SourceSheet picker={model.sources} />
      {model.audioTrim && (
        <Modal
          transparent
          animationType="fade"
          onRequestClose={() => {
            if (!model.audioTrim?.picker.busy) act({ type: "trim-cancel" });
          }}
        >
          <View style={styles.trimBackdrop}>
            <View style={styles.trimDialog} accessibilityViewIsModal>
              <ScrollView>
                <Text style={styles.formTitle} accessibilityRole="header">
                  파일 구간 선택
                </Text>
                <Text style={styles.formText}>{model.audioTrim.fileName}</Text>
                <AudioTrim trim={model.audioTrim.picker} />
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

/** Ruler, track sidebar and clip lanes; the ruler and the sidebar stay put while the lanes scroll. */
function Timeline({ model }: { model: NativeStudio }) {
  const { act } = useScreen();
  const sidebarScroll = useRef<ScrollViewInstance>(null);
  const actionsScroll = useRef<ScrollViewInstance>(null);
  const signature = {
    numerator: model.transport.numerator,
    denominator: model.transport.denominator,
  };
  const width = model.width;
  // Empty lanes fill the visible area below the tracks, like the web's grid fill.
  const [visibleHeight, setVisibleHeight] = useState(0);
  const lanes = Math.max(model.tracks.length, Math.floor(visibleHeight / laneHeight));
  return (
    <View style={styles.timeline}>
      <View style={styles.sidebar}>
        <View style={styles.corner} />
        <ScrollView ref={sidebarScroll} scrollEnabled={false} showsVerticalScrollIndicator={false}>
          {model.tracks.map((track) => (
            <TrackPerson key={track.trackId} track={track} />
          ))}
        </ScrollView>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.flex}>
        <View style={{ width }}>
          <Ruler model={model} />
          <ScrollView
            showsVerticalScrollIndicator={false}
            scrollEventThrottle={16}
            onLayout={(event) => setVisibleHeight(event.nativeEvent.layout.height)}
            onScroll={(event) => {
              const offset = { y: event.nativeEvent.contentOffset.y, animated: false };
              sidebarScroll.current?.scrollTo(offset);
              actionsScroll.current?.scrollTo(offset);
            }}
          >
            <View style={{ width, height: lanes * laneHeight }}>
              <Grid
                width={width}
                lanes={lanes}
                cellPx={signatureGrid(signature).cellPx}
                signature={signature}
              />
              {model.tracks.map((track, index) => (
                <View
                  key={track.trackId}
                  style={[styles.lane, { top: index * laneHeight, width }]}
                  accessibilityLabel={
                    track.highlighted ? `${track.name} · 이 요청으로 추가된 트랙` : undefined
                  }
                >
                  {track.clips.map((clip) => (
                    <Clip
                      key={clip.clipId}
                      clip={clip}
                      track={track}
                      model={model}
                      onMove={(startTick) =>
                        act({
                          type: "studio-move-clip",
                          trackId: track.trackId,
                          clipId: clip.clipId,
                          startTick,
                        })
                      }
                    />
                  ))}
                  {track.highlighted && <View pointerEvents="none" style={styles.highlight} />}
                </View>
              ))}
            </View>
          </ScrollView>
          <Playhead model={model} />
        </View>
      </ScrollView>
      {model.tracks.some((track) => track.add !== null) && (
        <View style={styles.trackActions}>
          <View style={styles.corner} />
          <ScrollView
            ref={actionsScroll}
            scrollEnabled={false}
            showsVerticalScrollIndicator={false}
          >
            {model.tracks.map((track) => (
              <View key={track.trackId} style={styles.trackActionRow}>
                {track.add?.notes && (
                  <Touchable
                    accessibilityRole="button"
                    accessibilityLabel={`${track.name} 노트 추가`}
                    onPress={() => act({ type: "studio-track-notes", trackId: track.trackId })}
                  >
                    <Text style={styles.trackActionText}>+ 노트</Text>
                  </Touchable>
                )}
                {track.add && (
                  <Touchable
                    accessibilityRole="button"
                    accessibilityLabel={`${track.name} 오디오 파일 추가`}
                    accessibilityState={{ disabled: track.add.audioDisabled }}
                    disabled={track.add.audioDisabled}
                    onPress={() => act({ type: "studio-track-audio", trackId: track.trackId })}
                  >
                    <Text
                      style={[styles.trackActionText, track.add.audioDisabled && styles.disabled]}
                    >
                      + 파일
                    </Text>
                  </Touchable>
                )}
              </View>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

function TrackPerson({ track }: { track: NativeStudioTrack }) {
  const { act } = useScreen();
  return (
    <View style={styles.person}>
      <Touchable
        accessibilityRole="button"
        accessibilityLabel={track.settingsLabel}
        style={styles.personButton}
        onPress={() => act({ type: "studio-track", trackId: track.trackId })}
      >
        <Avatar uri={null} size={32} />
      </Touchable>
      <Touchable
        accessibilityRole="button"
        accessibilityLabel={`${track.name} ${track.muted ? "소리 켜기" : "음소거"}`}
        accessibilityState={{ checked: track.muted }}
        style={styles.personButton}
        onPress={() => act({ type: "studio-mute", trackId: track.trackId })}
      >
        {track.muted ? (
          <SoundMutedIcon width={22} height={18.6} />
        ) : (
          <SoundIcon width={22} height={18.6} />
        )}
      </Touchable>
      {track.highlighted && (
        <>
          <View pointerEvents="none" style={styles.highlight} />
          <Text style={styles.badge}>추가 트랙</Text>
        </>
      )}
    </View>
  );
}

/** Bars/beats/cells and the lane stripes (the web's timelineGridFill). */
function Grid({
  width,
  lanes,
  cellPx,
  signature,
}: {
  width: number;
  lanes: number;
  cellPx: number;
  signature: { numerator: number; denominator: number };
}) {
  const height = lanes * laneHeight;
  const { beatPx, barPx } = signatureGrid(signature);
  const lines = (step: number) =>
    step > 0
      ? Array.from(
          { length: Math.floor(width / step) + 1 },
          (_, i) => `M${i * step} 0V${height}`,
        ).join("")
      : "";
  return (
    <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
      {Array.from({ length: lanes }, (_, lane) => (
        <Rect
          key={lane}
          x={0}
          y={lane * laneHeight}
          width={width}
          height={layerHeight + 2}
          fill={lane % 2 ? colors["grid-row-alt"] : colors["grid-row"]}
          stroke={colors["grid-cell"]}
          strokeWidth={1}
        />
      ))}
      <Path d={lines(cellPx)} stroke={colors["grid-cell"]} strokeWidth={Math.min(1, cellPx / 3)} />
      <Path d={lines(beatPx)} stroke={colors["grid-beat"]} strokeWidth={Math.min(1, beatPx / 3)} />
      <Path d={lines(barPx)} stroke={colors["grid-bar"]} strokeWidth={Math.min(1.5, barPx / 3)} />
    </Svg>
  );
}

/** Bar numbers and marks; a tap seeks there (the web's "타임라인 재생 위치" slider). */
function Ruler({ model }: { model: NativeStudio }) {
  const { act } = useScreen();
  const signature = {
    numerator: model.transport.numerator,
    denominator: model.transport.denominator,
  };
  const { beatPx, barPx, cellPx } = signatureGrid(signature);
  const width = model.width;
  const marks = (step: number, top: number) =>
    step > 0
      ? Array.from(
          { length: Math.floor(width / step) + 1 },
          (_, i) => `M${i * step} ${top}V${rulerHeight - 2}`,
        ).join("")
      : "";
  const seek = (x: number) =>
    act({
      type: "transport-seek",
      positionMs: Math.max(0, Math.min(1, x / width)) * model.maxDurationMs,
    });
  const step = (direction: 1 | -1) =>
    act({
      type: "transport-seek",
      positionMs: model.transport.positionMs + (direction * 30000) / model.transport.bpm,
    });
  return (
    <Pressable
      style={[styles.ruler, { width }]}
      accessibilityRole="adjustable"
      accessibilityLabel="타임라인 재생 위치"
      accessibilityValue={{ min: 0, max: model.maxDurationMs, now: model.transport.positionMs }}
      accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
      onAccessibilityAction={(event) => step(event.nativeEvent.actionName === "increment" ? 1 : -1)}
      onPress={(event) => seek(event.nativeEvent.locationX)}
    >
      <Svg width={width} height={rulerHeight} style={StyleSheet.absoluteFill} pointerEvents="none">
        <Path d={marks(cellPx, rulerHeight - 10)} stroke={colors["grid-beat"]} strokeWidth={1} />
        <Path d={marks(beatPx, rulerHeight - 20)} stroke={colors["grid-bar"]} strokeWidth={1} />
        <Path d={marks(barPx, 0)} stroke={colors.muted} strokeWidth={1.5} />
      </Svg>
      {rulerLabels(signature, width).map((label) => (
        <Text key={label.bar} style={[styles.rulerLabel, { left: label.left }]}>
          {label.bar}
        </Text>
      ))}
    </Pressable>
  );
}

/** The play position from the native engine, every frame while playing. */
function Playhead({ model }: { model: NativeStudio }) {
  const { playing, positionMs } = useTransport(model.transport);
  if (!playing && positionMs === 0) return null;
  return (
    <View
      pointerEvents="none"
      style={[
        styles.playhead,
        { left: (Math.min(positionMs, model.maxDurationMs) / model.maxDurationMs) * model.width },
      ]}
    />
  );
}

/**
 * A clip (the web's TimelineClip): a tap opens the track settings, a double tap (or a tap while
 * choosing a MIDI layer) the piano roll; movable clips drag along the grid and send the final start.
 */
function Clip({
  clip,
  track,
  model,
  onMove,
}: {
  clip: NativeStudioClip;
  track: NativeStudioTrack;
  model: NativeStudio;
  onMove: (startTick: number) => void;
}) {
  const { act } = useScreen();
  const { rotated } = useLandscape();
  const [position, setPosition] = useState<number | null>(null);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      clearTimeout(tapTimer.current ?? undefined);
    },
    [],
  );
  // The model's start moved (saved or re-read): drop the local drag position.
  const [shownStart, setShownStart] = useState(clip.startTick);
  if (shownStart !== clip.startTick) {
    setShownStart(clip.startTick);
    setPosition(null);
  }
  // A sent move ends when the page's save finished (busy came and went), even when it failed.
  const [saving, setSaving] = useState<"sent" | "busy" | null>(null);
  if (saving === "sent" && model.busy) setSaving("busy");
  if (saving === "busy" && !model.busy) {
    setSaving(null);
    setPosition(null);
  }
  const latest = useRef({ clip, model, rotated, onMove });
  latest.current = { clip, model, rotated, onMove };
  const drag = useRef({ tick: clip.startTick, moved: false });

  const tap = () => {
    const { clip: current, model: studio } = latest.current;
    const select = () =>
      act({ type: "studio-clip", trackId: track.trackId, clipId: current.clipId, edit: false });
    const edit = () =>
      act({ type: "studio-clip", trackId: track.trackId, clipId: current.clipId, edit: true });
    if (!current.opensEditor) return select();
    if (studio.selectMidiLayer) return edit();
    if (tapTimer.current) {
      clearTimeout(tapTimer.current);
      tapTimer.current = null;
      return edit();
    }
    tapTimer.current = setTimeout(() => {
      tapTimer.current = null;
      select();
    }, 240);
  };

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        drag.current = { tick: latest.current.clip.startTick, moved: false };
      },
      onPanResponderMove: (_, gesture) => {
        const { clip: current, model: studio, rotated: turned } = latest.current;
        if (!current.movable) return;
        const { dx } = landscapeDelta(turned, gesture.dx, gesture.dy);
        if (Math.abs(dx) > 3) drag.current.moved = true;
        if (!drag.current.moved) return;
        drag.current.tick = snappedClipStart(
          current.startTick,
          dx,
          studio.stepTick,
          studio.maxTick,
          current.durationTick,
          studio.cellPx,
        );
        setPosition(drag.current.tick);
      },
      onPanResponderRelease: (_, gesture) => {
        const { clip: current, onMove: move } = latest.current;
        if (drag.current.moved) {
          if (drag.current.tick !== current.startTick) {
            setSaving("sent");
            move(drag.current.tick);
          } else setPosition(null);
        } else if (Math.abs(gesture.dx) < 10 && Math.abs(gesture.dy) < 10) {
          setPosition(null);
          tap();
        }
      },
      onPanResponderTerminate: () => setPosition(null),
      onPanResponderTerminationRequest: () => !latest.current.clip.movable,
      onShouldBlockNativeResponder: () => latest.current.clip.movable,
    }),
  ).current;

  const start = position ?? clip.startTick;
  const left = (start / model.maxTick) * model.width;
  const clipWidth = Math.max(
    0.001 * model.width,
    (clip.durationTick / model.maxTick) * model.width,
  );
  const wide = clipWidth >= 64;
  const tint = clip.midi ? "#c7a9f4" : "#8bd8cc";
  return (
    <View
      accessible
      accessibilityRole="button"
      accessibilityLabel={clip.accessibilityLabel}
      accessibilityActions={
        clip.opensEditor ? [{ name: "activate" }, { name: "longpress" }] : undefined
      }
      onAccessibilityAction={(event) =>
        act({
          type: "studio-clip",
          trackId: track.trackId,
          clipId: clip.clipId,
          edit: event.nativeEvent.actionName === "longpress" || model.selectMidiLayer,
        })
      }
      style={[
        styles.clip,
        clip.midi ? styles.clipMidi : styles.clipAudio,
        { left, width: clipWidth },
        position !== null && styles.clipDragging,
      ]}
      {...responder.panHandlers}
    >
      {wide && (
        <View style={styles.clipLabel} pointerEvents="none">
          <ClipIcon midi={clip.midi} color={tint} />
          {clip.label && (
            <Text style={styles.clipLabelText} numberOfLines={1}>
              {clip.label}
            </Text>
          )}
        </View>
      )}
      <View style={[styles.clipPreview, { top: wide ? 18 : 5 }]} pointerEvents="none">
        <ClipPreview
          clip={clip}
          width={clipWidth - 2}
          height={layerHeight - (wide ? 23 : 10)}
          color={tint}
        />
      </View>
    </View>
  );
}

/** lucide Music2 / AudioLines at 11px. */
function ClipIcon({ midi, color }: { midi: boolean; color: string }) {
  return (
    <Svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8}>
      {midi ? (
        <Path
          d="M9 18V5l12-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm12-2a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : (
        <Path
          d="M2 10v3M6 6v11M10 3v18M14 8v7M18 5v13M22 10v3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </Svg>
  );
}

/** MIDI note bars or the audio waveform (the web's TimelineClipPreview). */
function ClipPreview({
  clip,
  width,
  height,
  color,
}: {
  clip: NativeStudioClip;
  width: number;
  height: number;
  color: string;
}) {
  if (width <= 0 || height <= 0) return null;
  if (!clip.midi) {
    const peaks = clip.peaks;
    if (!peaks?.length) return null;
    const bars = peaks.length;
    const upper = peaks.map((peak, index) => `L${index + 0.5} ${(16 - peak * 13).toFixed(2)}`);
    const lower = peaks.map((peak, index) => `L${index + 0.5} ${(16 + peak * 13).toFixed(2)}`);
    const envelope = `M0 16${upper.join("")}L${bars} 16${lower.reverse().join("")}Z`;
    return (
      <Svg width={width} height={height} viewBox={`0 0 ${bars} 32`} preserveAspectRatio="none">
        <Path d={`M0 16H${bars}`} stroke={color} strokeOpacity={0.4} strokeWidth={0.3} />
        <Path d={envelope} fill={color} fillOpacity={0.86} />
      </Svg>
    );
  }
  const bars: { x: number; w: number; y: number }[] = [];
  for (let index = 0; index + 2 < clip.notes.length; index += 3)
    bars.push({ x: clip.notes[index], w: clip.notes[index + 1], y: clip.notes[index + 2] });
  if (!bars.length) return null;
  const barHeight = (4.5 / 32) * height;
  return (
    <Svg width={width} height={height}>
      {bars.map((bar, index) => (
        <Rect
          key={index}
          x={bar.x * width}
          y={bar.y * height - barHeight / 2}
          width={Math.max(1, bar.w * width)}
          height={barHeight}
          rx={Math.min((bar.w * width) / 2, width * 0.016)}
          ry={1.25}
          fill={color}
        />
      ))}
    </Svg>
  );
}

/** "작업 제출" (the web's studio-submit-form over the timeline). */
function SubmitForm({
  submit,
  comment,
  onComment,
}: {
  submit: NonNullable<NativeStudio["submit"]>;
  comment: string;
  onComment: (comment: string) => void;
}) {
  const { act } = useScreen();
  const send = () => {
    if (!submit.busy && comment.trim()) act({ type: "studio-submit", comment });
  };
  return (
    <View style={styles.form} accessibilityViewIsModal accessibilityLabel="작업 제출">
      <Text style={styles.formTitle} accessibilityRole="header">
        작업 제출
      </Text>
      <Text style={styles.formText}>
        추가한 레이어를 원곡자에게 보냅니다. 승인되면 숏폼에 반영됩니다.
      </Text>
      <View style={styles.formField}>
        <Text style={styles.formLabel}>한 줄 코멘트</Text>
        <TextInput
          accessibilityLabel="한 줄 코멘트"
          value={comment}
          onChangeText={onComment}
          maxLength={120}
          placeholder="어떤 작업을 추가했나요?"
          placeholderTextColor="#9692a6"
          selectionColor={colors.accent}
          autoFocus
          returnKeyType="send"
          onSubmitEditing={send}
          style={styles.formInput}
        />
      </View>
      {submit.error && (
        <Text accessibilityRole="alert" style={styles.formError}>
          {submit.error}
        </Text>
      )}
      <View style={styles.formButtons}>
        <FormButton
          label="취소"
          disabled={submit.busy}
          onPress={() => act({ type: "studio-submit-close" })}
        />
        <FormButton
          label={submit.busy ? "제출 중..." : "제출하기"}
          disabled={submit.busy || !comment.trim()}
          onPress={send}
        />
      </View>
    </View>
  );
}

/** "곡 올리기": title and optional album image before publishing an untitled song. */
function PublishForm({ form }: { form: NonNullable<NativeStudio["publishForm"]> }) {
  const { act } = useScreen();
  const [title, setTitle] = useState("");
  const save = () => {
    if (!form.busy && title.trim()) act({ type: "studio-publish-save", title });
  };
  return (
    <View style={styles.form} accessibilityViewIsModal accessibilityLabel="곡 올리기">
      <Text style={styles.formTitle} accessibilityRole="header">
        곡 올리기
      </Text>
      <Text style={styles.formText}>곡 제목을 등록하세요. 앨범 이미지는 선택사항입니다.</Text>
      <View style={styles.formField}>
        <Text style={styles.formLabel}>곡 제목</Text>
        <TextInput
          accessibilityLabel="곡 제목"
          value={title}
          onChangeText={setTitle}
          maxLength={100}
          selectionColor={colors.accent}
          returnKeyType="done"
          onSubmitEditing={save}
          style={styles.formInput}
        />
      </View>
      <View style={styles.formField}>
        <Text style={styles.formLabel}>앨범 이미지 (선택)</Text>
        <View style={styles.formFile}>
          <DialogButton
            label="파일 선택"
            tone="secondary"
            onPress={() => act({ type: "studio-publish-image" })}
          />
          <Text style={styles.formText} numberOfLines={1}>
            {form.imageName ?? "선택된 파일 없음"}
          </Text>
        </View>
      </View>
      <View style={styles.formButtons}>
        <FormButton label="취소" onPress={() => act({ type: "studio-publish-form-close" })} />
        <FormButton
          label={form.busy ? "저장 중..." : "정보 저장"}
          disabled={form.busy || !title.trim()}
          onPress={save}
        />
      </View>
    </View>
  );
}

function FormButton({
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
      style={[styles.formButton, disabled && styles.disabled]}
      onPress={onPress}
    >
      <Text style={styles.formButtonText}>{label}</Text>
    </Touchable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  disabled: { opacity: 0.5 },
  notice: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    color: colors.muted,
    fontSize: 14,
    lineHeight: 18,
  },
  contribution: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  contributionText: { color: colors["primary-soft"], fontSize: 14, lineHeight: 18 },
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
  status: {
    position: "absolute",
    right: 60,
    bottom: 12,
    zIndex: 8,
    color: "#ffffff",
    fontSize: 14,
    lineHeight: 18,
  },
  timeline: { flex: 1, flexDirection: "row", backgroundColor: colors.bg },
  sidebar: { width: sidebar, backgroundColor: colors.bg },
  corner: { height: rulerHeight, backgroundColor: colors.bg },
  trackActions: { width: 112, backgroundColor: colors.bg },
  trackActionRow: {
    height: laneHeight,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-evenly",
  },
  trackActionText: { color: colors.fg, fontSize: 13, paddingVertical: 10 },
  trimBackdrop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.65)",
  },
  trimDialog: {
    width: "94%",
    maxWidth: 600,
    maxHeight: "90%",
    padding: 16,
    borderRadius: 12,
    backgroundColor: colors.bg,
  },
  person: {
    height: laneHeight,
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 1,
    paddingBottom: 5,
    paddingLeft: 10,
  },
  personButton: { width: 44, height: layerHeight, alignItems: "center", justifyContent: "center" },
  highlight: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    zIndex: 3,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors["primary-soft"],
  },
  badge: {
    position: "absolute",
    right: 4,
    bottom: 0,
    zIndex: 3,
    borderRadius: 4,
    paddingHorizontal: 4,
    backgroundColor: colors.primary,
    color: "#ffffff",
    fontSize: 9,
    lineHeight: 12,
  },
  ruler: {
    height: rulerHeight,
    backgroundColor: colors.panel,
    borderBottomWidth: 2,
    borderBottomColor: colors.border,
  },
  rulerLabel: {
    position: "absolute",
    top: 1,
    paddingLeft: 3,
    color: colors.fg,
    fontSize: 14,
    lineHeight: 14,
  },
  lane: { position: "absolute", left: 0, height: laneHeight },
  playhead: {
    position: "absolute",
    top: rulerHeight,
    bottom: 0,
    width: 2,
    zIndex: 3,
    backgroundColor: colors.accent,
  },
  clip: {
    position: "absolute",
    top: 1,
    height: layerHeight,
    overflow: "hidden",
    borderRadius: 6,
    borderWidth: 1,
  },
  clipMidi: { backgroundColor: "#2e2440", borderColor: "#59466f" },
  clipAudio: { backgroundColor: "#21373d", borderColor: "#416369" },
  clipDragging: { opacity: 0.8, borderColor: colors.fg },
  clipLabel: {
    position: "absolute",
    left: 8,
    right: 8,
    top: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  clipLabelText: {
    flexShrink: 1,
    color: colors.fg,
    fontSize: 10,
    lineHeight: 12,
    fontWeight: "600",
  },
  clipPreview: { position: "absolute", left: 1, right: 1, bottom: 5 },
  confirm: { width: 229, alignItems: "center", gap: 20 },
  confirmTitle: { color: colors.fg, fontSize: 20, fontWeight: "700" },
  confirmButton: {
    height: 40,
    paddingHorizontal: 20,
    borderRadius: 40,
    justifyContent: "center",
    backgroundColor: colors.primary,
  },
  confirmButtonText: { color: colors.fg, fontSize: 16, fontWeight: "500" },
  form: {
    position: "absolute",
    top: 44,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 20,
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    backgroundColor: "rgba(36, 42, 48, 0.96)",
  },
  formTitle: { color: "#ffffff", fontSize: 20, lineHeight: 26, fontWeight: "700" },
  formText: { color: "#bac4cd", fontSize: 14, lineHeight: 18, marginBottom: 3, flexShrink: 1 },
  formField: {
    width: 380,
    maxWidth: "90%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  formLabel: { color: "#ffffff", fontSize: 14, lineHeight: 18 },
  formInput: {
    width: "70%",
    maxWidth: 260,
    padding: 6,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: colors.panel,
    backgroundColor: colors.surface,
    color: "#ffffff",
    fontSize: 14,
  },
  formFile: { width: "70%", maxWidth: 260, flexDirection: "row", alignItems: "center", gap: 8 },
  formError: { color: colors.error, fontSize: 14, lineHeight: 18 },
  formButtons: { flexDirection: "row", gap: 8 },
  formButton: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 6,
    backgroundColor: colors.primary,
  },
  formButtonText: { color: "#ffffff", fontSize: 14, lineHeight: 20 },
});
