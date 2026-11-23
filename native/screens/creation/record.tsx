import { useEffect, useState } from "react";
import { AppState, ScrollView, StyleSheet, Text, View } from "react-native";
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from "react-native-svg";

import {
  beatIntervalMs,
  beatsPerBarFromSignature,
  isAccentBeat,
} from "../../../src/features/composition/metronome-timing";
import PlayIcon from "../../../public/figma/play.svg";
import { useRecordingLevels } from "../../audio";
import { runningContext } from "../../audio/graph";
import { clickSamples } from "../../audio/logic";
import { AppHeader } from "../../ui/header";
import { Button, Touchable } from "../../ui/kit";
import { useScreen } from "../../ui/screen-context";
import { colors } from "../../ui/theme";
import { InstrumentSheet, TimingSheet } from "../studio/parts";
import { MetronomeGlyph } from "../studio/toolbar";
import type { ScreenProps } from "../types";
import { CreationTimingBar } from "./timing-bar";
import { AudioTrim, formatTrimTime } from "./trim";

const columnWidth = 2;
const meterFloorDb = -45;

function meterLevel(peak: number): number {
  if (peak <= 0) return 0;
  return Math.max(0, Math.min(1, 1 - (20 * Math.log10(peak)) / meterFloorDb));
}

function RetryGlyph() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5"
        stroke="#F2F4F6"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function MicGlyph() {
  return (
    <Svg width={26} height={26} viewBox="0 0 24 24" fill="none">
      <Rect x={9} y={2} width={6} height={11} rx={3} fill="#ffffff" />
      <Path
        d="M5 10a7 7 0 0 0 14 0M12 19v3M8 22h8"
        stroke="#ffffff"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

const idleBarHeights = Array.from(
  { length: 28 },
  (_, index) => Math.round(14 + Math.abs(Math.sin((index + 1) * 0.65)) * 42),
);

/** Unified Native Record Screen with Portrait Piano Roll-style bottom transport bar. */
export function CreationRecordScreen({ model, header }: ScreenProps<"creation-record">) {
  const { act, bottomInset, active } = useScreen();
  const [metronomeOn, setMetronomeOn] = useState(false);
  const [activeBeat, setActiveBeat] = useState<number | null>(null);
  const [appActive, setAppActive] = useState(AppState.currentState === "active");
  const [elapsedMs, setElapsedMs] = useState(0);

  const bpm = model.bpm ?? 120;
  const timeSignature = model.timeSignature ?? "4/4";
  const beatsPerBar = beatsPerBarFromSignature(timeSignature);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) =>
      setAppActive(state === "active"),
    );
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!active) setMetronomeOn(false);
  }, [active]);

  // Auto-start isolated metronome click ONLY while recording; never included in hardware mic recording.
  useEffect(() => {
    if (!metronomeOn || !model.recording || !active || !appActive) return;
    let cancelled = false;
    let beat = 0;
    const intervalMs = beatIntervalMs(bpm, timeSignature);
    const playBeat = () => {
      if (cancelled) return;
      const current = beat % beatsPerBar;
      const accent = isAccentBeat(beat, beatsPerBar);
      setActiveBeat(current);
      beat += 1;
      void runningContext()
        .then((ctx) => {
          if (cancelled) return;
          const samples = clickSamples(ctx.sampleRate);
          const buffer = ctx.createBuffer(1, samples.length, ctx.sampleRate);
          buffer.copyToChannel(samples, 0);
          const src = ctx.createBufferSource();
          src.buffer = buffer;
          src.playbackRate.value = accent ? 1.25 : 0.9;
          const gain = ctx.createGain();
          gain.gain.value = accent ? 1.3 : 0.85;
          src.connect(gain);
          gain.connect(ctx.destination);
          src.start();
        })
        .catch(() => {});
    };
    playBeat();
    const timer = setInterval(playBeat, intervalMs);
    return () => {
      cancelled = true;
      clearInterval(timer);
      setActiveBeat(null);
    };
  }, [metronomeOn, model.recording, active, appActive, bpm, timeSignature, beatsPerBar]);

  const recorded = model.recorded && !model.recording;
  const canRetry = !model.pending && (model.recording || recorded);

  return (
    <>
      {header && <AppHeader header={header} />}
      <View style={[styles.view, { paddingBottom: Math.max(bottomInset, 16) }]}>
        {model.notice && (
          <Text accessibilityRole="alert" style={styles.error}>
            {model.notice}
          </Text>
        )}

        <CreationTimingBar
          bpm={bpm}
          timeSignature={timeSignature}
          timingMode={model.timingMode}
          disabled={model.recording || model.pending}
        />

        <ScrollView style={styles.center} contentContainerStyle={styles.centerContent}>
          {model.error && (
            <Text accessibilityRole="alert" style={styles.error}>
              {model.error}
            </Text>
          )}

          {!recorded ? (
            <View style={styles.card}>
              <View style={styles.cardTopRow}>
                <View style={styles.statusWrap}>
                  <View style={[styles.statusDot, model.recording && styles.statusDotLive]} />
                  <Text style={styles.statusText}>{model.status || "녹음 대기"}</Text>
                </View>

                <View style={[styles.metroBadge, metronomeOn && styles.metroBadgeOn]}>
                  <Text style={[styles.metroBadgeText, metronomeOn && styles.metroBadgeTextOn]}>
                    {model.recording && metronomeOn
                      ? "메트로놈 재생 중"
                      : metronomeOn
                        ? "메트로놈 ON · 시작 시 자동 재생"
                        : "메트로놈 OFF"}
                  </Text>
                  {metronomeOn && model.recording && (
                    <View style={styles.beatRow}>
                      {Array.from({ length: beatsPerBar }, (_, index) => (
                        <View
                          key={index}
                          style={[
                            styles.beatDot,
                            activeBeat === index
                              ? index === 0
                                ? styles.beatDotAccent
                                : styles.beatDotOn
                              : styles.beatDotInactiveOn,
                          ]}
                        />
                      ))}
                    </View>
                  )}
                </View>
              </View>

              <View style={styles.timerRow}>
                <Text style={styles.timerMain}>
                  {formatTrimTime(model.recording ? elapsedMs : 0)}
                </Text>
                <Text style={styles.timerCap}>/ 01:00.0</Text>
              </View>

              <View style={styles.waveBox}>
                {model.recording ? (
                  <RecordingMeter onElapsedMs={setElapsedMs} />
                ) : (
                  <View style={styles.idleWaveWrap}>
                    <View style={styles.idleCenterLine} />
                    <View style={styles.idleBars}>
                      {idleBarHeights.map((h, index) => (
                        <View key={index} style={[styles.idleBar, { height: `${h}%` }]} />
                      ))}
                    </View>
                    <View style={styles.idlePrompt}>
                      <Text style={styles.idlePromptText}>아래 녹음 버튼을 눌러 시작하세요</Text>
                    </View>
                  </View>
                )}
              </View>

              <Text style={styles.note}>
                메트로놈 소리는 최종 녹음에 포함되지 않습니다 · 이어폰 착용 시 더 깔끔하게 녹음됩니다
              </Text>
            </View>
          ) : (
            <View style={styles.card}>
              <AudioTrim trim={model.trim ?? null} />
              {model.transform && (
                <View style={styles.convert}>
                  <Text style={styles.convertLabel}>변환 방식</Text>
                  <View style={styles.convertOptions}>
                    {(
                      [
                        ["AUTO", "자동 판별"],
                        ["HUMMING", "허밍 · 한 음씩"],
                        ["INSTRUMENT", "악기 · 화음"],
                      ] as const
                    ).map(([kind, label]) => {
                      const selected = model.soundKind === kind;
                      return (
                        <Touchable
                          key={kind}
                          accessibilityRole="button"
                          accessibilityState={{ selected, disabled: model.pending }}
                          disabled={model.pending}
                          style={[
                            styles.convertOption,
                            selected && styles.convertOptionSelected,
                            model.pending && styles.disabled,
                          ]}
                          onPress={() => act({ type: "creation-record-sound-kind", kind })}
                        >
                          <Text
                            numberOfLines={1}
                            style={[styles.convertText, selected && styles.convertTextSelected]}
                          >
                            {label}
                          </Text>
                        </Touchable>
                      );
                    })}
                  </View>
                </View>
              )}
              <View style={styles.actions}>
                {model.transform && (
                  <Button
                    tone="secondary"
                    label="MIDI로 변환"
                    disabled={model.pending}
                    style={styles.actionButton}
                    onPress={() => act({ type: "creation-record-transform" })}
                  />
                )}
                <Button
                  label={model.saveLabel}
                  disabled={model.pending}
                  style={styles.actionButton}
                  onPress={() => act({ type: "creation-record-save" })}
                />
              </View>
            </View>
          )}
        </ScrollView>

        <View style={styles.transport}>
          <View style={styles.transportCol}>
            <Touchable
              accessibilityRole="button"
              accessibilityLabel="다시 녹음"
              accessibilityState={{ disabled: !canRetry }}
              disabled={!canRetry}
              style={[styles.roundBtn, !canRetry && styles.disabled]}
              onPress={() => {
                setElapsedMs(0);
                act({ type: "creation-record-retry" });
              }}
            >
              <RetryGlyph />
            </Touchable>
            <Text style={styles.transportCaptionMuted}>다시 녹음</Text>
          </View>

          <View style={styles.transportCol}>
            {recorded ? (
              <Touchable
                accessibilityRole="button"
                accessibilityLabel={model.previewing ? "일시정지" : "미리 듣기"}
                accessibilityState={{ disabled: model.pending }}
                disabled={model.pending}
                style={[styles.mainBtn, model.pending && styles.disabled]}
                onPress={() => act({ type: "creation-record-preview" })}
              >
                {model.previewing ? (
                  <View style={styles.pause}>
                    <View style={styles.pauseBar} />
                    <View style={styles.pauseBar} />
                  </View>
                ) : (
                  <PlayIcon width={28} height={28} />
                )}
              </Touchable>
            ) : (
              <Touchable
                accessibilityRole="button"
                accessibilityLabel={model.recording ? "녹음 종료" : "녹음 시작"}
                accessibilityState={{ disabled: model.pending }}
                disabled={model.pending}
                style={[
                  styles.mainBtn,
                  model.recording && styles.mainBtnLive,
                  model.pending && styles.disabled,
                ]}
                onPress={() => {
                  if (!model.recording) setElapsedMs(0);
                  act({ type: "creation-record-toggle" });
                }}
              >
                {model.recording ? <View style={styles.stopSquare} /> : <MicGlyph />}
              </Touchable>
            )}
            <Text style={styles.transportCaption}>
              {recorded
                ? model.previewing
                  ? "일시정지"
                  : "미리 듣기"
                : model.recording
                  ? "녹음 종료"
                  : "녹음 시작"}
            </Text>
          </View>

          <View style={styles.transportCol}>
            <Touchable
              accessibilityRole="button"
              accessibilityLabel={metronomeOn ? "메트로놈 끄기" : "메트로놈 켜기"}
              accessibilityState={{ checked: metronomeOn, disabled: model.pending }}
              disabled={model.pending}
              style={[styles.roundBtn, metronomeOn && styles.roundBtnActive, model.pending && styles.disabled]}
              onPress={() => setMetronomeOn((current) => !current)}
            >
              <MetronomeGlyph active={false} size={22} />
            </Touchable>
            <Text style={[styles.transportCaptionMuted, metronomeOn && styles.transportCaptionPurple]}>
              {metronomeOn ? "메트로놈 ON" : "메트로놈 OFF"}
            </Text>
          </View>
        </View>
      </View>
      <InstrumentSheet picker={model.instrument} />
      <TimingSheet sheet={model.timing ?? null} />
    </>
  );
}

/** Live microphone waveform scrolling from right to left and updating elapsed time. */
function RecordingMeter({ onElapsedMs }: { onElapsedMs: (ms: number) => void }) {
  const levels = useRecordingLevels();
  const [startedAt] = useState(() => Date.now());
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => onElapsedMs(Math.max(0, Date.now() - startedAt)), 100);
    return () => clearInterval(timer);
  }, [onElapsedMs, startedAt]);

  const height = 112;
  const middle = height / 2;
  const shown = levels.slice(-(Math.ceil(width / columnWidth) + 1));
  const x = (index: number) => width - (shown.length - 1 - index) * columnWidth;
  const level = (value: number) => Math.max(0.75, meterLevel(value) * (middle - 2));
  const path = shown.length
    ? `M${shown.map((value, index) => `${x(index)},${middle - level(value)}`).join("L")}L${shown
        .map((value, index) => `${x(index)},${middle + level(value)}`)
        .reverse()
        .join("L")}Z`
    : "";

  return (
    <View
      style={styles.waveCanvas}
      importantForAccessibility="no-hide-descendants"
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
    >
      {width > 0 && (
        <Svg width={width} height={height}>
          <Defs>
            <LinearGradient id="fade" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor={colors.primary} stopOpacity={0} />
              <Stop offset="0.25" stopColor={colors.primary} stopOpacity={1} />
              <Stop offset="1" stopColor="#a78bfa" stopOpacity={1} />
            </LinearGradient>
          </Defs>
          <Rect
            x={0}
            y={middle - 0.5}
            width={width}
            height={1}
            fill={colors.primary}
            opacity={0.25}
          />
          {path && <Path d={path} fill="url(#fade)" />}
        </Svg>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  view: { flex: 1, gap: 12, paddingHorizontal: 16, paddingTop: 12 },
  center: { flex: 1 },
  centerContent: { flexGrow: 1, justifyContent: "center", gap: 12, paddingVertical: 4 },
  error: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 77, 79, 0.35)",
    backgroundColor: "rgba(255, 77, 79, 0.1)",
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: "#ff9ca8",
    fontSize: 13,
    lineHeight: 18,
  },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#32323d",
    backgroundColor: "#1e1e26",
    padding: 16,
    gap: 14,
  },
  cardTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  statusWrap: { flexDirection: "row", alignItems: "center", gap: 8 },
  statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#606072" },
  statusDotLive: { backgroundColor: "#ff4d4f" },
  statusText: { color: colors.fg, fontSize: 12, fontWeight: "600" },
  metroBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#32323d",
    backgroundColor: "#23232a",
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  metroBadgeOn: { borderColor: "rgba(76, 0, 229, 0.6)", backgroundColor: "rgba(76, 0, 229, 0.2)" },
  metroBadgeText: { color: colors.muted, fontSize: 11, fontWeight: "500" },
  metroBadgeTextOn: { color: "#d8b4fe", fontWeight: "600" },
  beatRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  beatDot: { width: 6, height: 6, borderRadius: 3 },
  beatDotInactiveOn: { backgroundColor: "rgba(255, 255, 255, 0.25)" },
  beatDotOn: { backgroundColor: "#c4b5fd" },
  beatDotAccent: { backgroundColor: "#ffffff" },
  timerRow: { flexDirection: "row", alignItems: "baseline", justifyContent: "center", gap: 6, paddingVertical: 4 },
  timerMain: { color: "#ffffff", fontSize: 32, fontWeight: "700", fontVariant: ["tabular-nums"] },
  timerCap: { color: colors.muted, fontSize: 14, fontVariant: ["tabular-nums"] },
  waveBox: {
    height: 112,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2a2a35",
    backgroundColor: "#14141a",
    overflow: "hidden",
    justifyContent: "center",
  },
  waveCanvas: { width: "100%", height: 112 },
  idleWaveWrap: { flex: 1, justifyContent: "center", alignItems: "center" },
  idleCenterLine: { position: "absolute", left: 0, right: 0, height: 1, backgroundColor: "rgba(76, 0, 229, 0.25)" },
  idleBars: { flexDirection: "row", alignItems: "center", gap: 6, opacity: 0.4, height: "100%" },
  idleBar: { width: 3, borderRadius: 99, backgroundColor: "#7c3aed" },
  idlePrompt: { position: "absolute", borderRadius: 999, backgroundColor: "rgba(20, 20, 26, 0.85)", paddingHorizontal: 12, paddingVertical: 4 },
  idlePromptText: { color: colors.muted, fontSize: 12 },
  note: { color: colors.muted, fontSize: 11, lineHeight: 16, textAlign: "center" },
  convert: {
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2c2c38",
    backgroundColor: "#16161d",
    padding: 12,
  },
  convertLabel: { color: colors.fg, fontSize: 13, fontWeight: "600" },
  convertOptions: { flexDirection: "row", gap: 6 },
  convertOption: {
    flex: 1,
    minHeight: 36,
    paddingHorizontal: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#23232a",
    alignItems: "center",
    justifyContent: "center",
  },
  convertOptionSelected: { borderColor: colors.primary, backgroundColor: colors.primary },
  convertText: { color: colors.fg, fontSize: 12, fontWeight: "500" },
  convertTextSelected: { color: "#ffffff", fontWeight: "700" },
  actions: { flexDirection: "row", alignItems: "center", gap: 10 },
  actionButton: { flex: 1, paddingHorizontal: 12 },
  transport: { flexDirection: "row", alignItems: "flex-start", justifyContent: "center", gap: 32, paddingVertical: 4 },
  transportCol: { alignItems: "center", gap: 6 },
  roundBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#32323d",
    backgroundColor: "#23232a",
    alignItems: "center",
    justifyContent: "center",
  },
  roundBtnActive: { borderColor: colors.primary, backgroundColor: colors.primary },
  mainBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  mainBtnLive: { backgroundColor: "#ef4444" },
  stopSquare: { width: 22, height: 22, borderRadius: 4, backgroundColor: "#ffffff" },
  pause: { flexDirection: "row", gap: 5 },
  pauseBar: { width: 4, height: 20, borderRadius: 2, backgroundColor: "#ffffff" },
  transportCaption: { color: colors.fg, fontSize: 11, fontWeight: "500" },
  transportCaptionMuted: { color: colors.muted, fontSize: 11, fontWeight: "500" },
  transportCaptionPurple: { color: "#c4b5fd" },
  disabled: { opacity: 0.4 },
});
