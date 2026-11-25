import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, ScrollView, StyleSheet, Text, View } from "react-native";
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from "react-native-svg";

import {
  beatIntervalMs,
  beatsPerBarFromSignature,
  isAccentBeat,
} from "../../../src/features/composition/metronome-timing";
import {
  RECORD_COUNTDOWN_START,
  countdownBeatMs,
  countdownCaption,
  nativeCountInBlocker,
} from "../../../src/features/composition/record-countdown";
import PlayIcon from "../../../public/figma/play.svg";
import {
  microphoneGranted,
  prepareRecording,
  releasePreparedRecording,
  useRecordingLevels,
} from "../../audio";
import { runningContext } from "../../audio/graph";
import { clickSamples } from "../../audio/logic";
import { AppHeader } from "../../ui/header";
import { Button, Touchable } from "../../ui/kit";
import { LoadingOverlay } from "../../ui/loading-overlay";
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

type CountInPhase = "idle" | "preparing" | "counting";

/** Unified Native Record Screen with Portrait Piano Roll-style bottom transport bar. */
export function CreationRecordScreen({ model, header }: ScreenProps<"creation-record">) {
  const { act, bottomInset, active } = useScreen();
  const [metronomeOn, setMetronomeOn] = useState(false);
  const [appActive, setAppActive] = useState(AppState.currentState === "active");
  const [elapsedMs, setElapsedMs] = useState(0);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [countInError, setCountInError] = useState<string | null>(null);
  const countdownTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  // Bumped by every start and cancel; an async step of an older count-in sees the change and stops.
  const countInRef = useRef(0);
  // "counting" means prepareRecording switched the session and Start has not been dispatched yet.
  const countInPhaseRef = useRef<CountInPhase>("idle");
  const activeRef = useRef(active);

  const bpm = model.bpm ?? 120;
  const timeSignature = model.timeSignature ?? "4/4";
  const beatsPerBar = beatsPerBarFromSignature(timeSignature);

  const playIsolatedClick = useCallback((accent: boolean) => {
    void runningContext()
      .then((ctx) => {
        const samples = clickSamples(ctx.sampleRate);
        const buffer = ctx.createBuffer(1, samples.length, ctx.sampleRate);
        buffer.copyToChannel(samples, 0);
        const src = ctx.createBufferSource();
        src.buffer = buffer;
        src.playbackRate.value = accent ? 1.25 : 0.9;
        const gain = ctx.createGain();
        gain.gain.value = accent ? 1.3 : 0.9;
        src.connect(gain);
        gain.connect(ctx.destination);
        src.start();
      })
      .catch(() => {});
  }, []);

  const cancelCountdown = useCallback(() => {
    countInRef.current += 1;
    for (const timer of countdownTimersRef.current) clearTimeout(timer);
    countdownTimersRef.current = [];
    setCountdown(null);
    setPreparing(false);
    if (countInPhaseRef.current === "counting") releasePreparedRecording();
    countInPhaseRef.current = "idle";
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      setAppActive(state === "active");
      // A count-in must not survive foreground loss and dispatch Start on resume. While preparing,
      // the permission prompt itself makes iOS inactive, so only a running count is cancelled here.
      if (state !== "active" && countInPhaseRef.current === "counting") cancelCountdown();
    });
    return () => subscription.remove();
  }, [cancelCountdown]);

  useEffect(() => () => cancelCountdown(), [cancelCountdown]);

  useEffect(() => {
    activeRef.current = active;
    if (!active) {
      cancelCountdown();
      setMetronomeOn(false);
    }
  }, [active, cancelCountdown]);

  // Auto-start isolated metronome click ONLY while recording; never included in hardware mic recording.
  useEffect(() => {
    if (!metronomeOn || !model.recording || !active || !appActive) return;
    let cancelled = false;
    let beat = 0;
    const intervalMs = beatIntervalMs(bpm, timeSignature);
    const playBeat = () => {
      if (cancelled) return;
      const accent = isAccentBeat(beat, beatsPerBar);
      beat += 1;
      playIsolatedClick(accent);
    };
    playBeat();
    const timer = setInterval(playBeat, intervalMs);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [metronomeOn, model.recording, active, appActive, bpm, timeSignature, beatsPerBar, playIsolatedClick]);

  const startCountdown = useCallback(async () => {
    cancelCountdown();
    const session = countInRef.current;
    countInPhaseRef.current = "preparing";
    setCountInError(null);
    setElapsedMs(0);
    setPreparing(true);
    // Permission and the recording session first, so the last click is not spent on them.
    try {
      await prepareRecording();
    } catch (cause) {
      if (session !== countInRef.current) return;
      countInPhaseRef.current = "idle";
      setPreparing(false);
      setCountInError(cause instanceof Error ? cause.message : "마이크 권한을 확인해 주세요.");
      return;
    }
    if (session !== countInRef.current) {
      // Cancelled while preparing; hand the session back unless a newer count-in is using it. (The
      // cast drops the "preparing" narrowing TS keeps across the await.)
      if ((countInPhaseRef.current as CountInPhase) === "idle") releasePreparedRecording();
      return;
    }
    countInPhaseRef.current = "counting";
    if (!activeRef.current || AppState.currentState === "background") {
      cancelCountdown();
      return;
    }
    setPreparing(false);
    const beatMs = countdownBeatMs(bpm, timeSignature);
    setCountdown(RECORD_COUNTDOWN_START);
    playIsolatedClick(false);
    for (let step = 1; step < RECORD_COUNTDOWN_START; step += 1) {
      const nextCount = RECORD_COUNTDOWN_START - step;
      const timer = setTimeout(() => {
        setCountdown(nextCount);
        playIsolatedClick(false);
      }, beatMs * step);
      countdownTimersRef.current.push(timer);
    }
    const finishTimer = setTimeout(() => {
      countdownTimersRef.current = [];
      void nativeCountInBlocker({
        screenActive: () => activeRef.current,
        appActive: () => AppState.currentState === "active",
        microphoneGranted,
      }).then((blocker) => {
        if (session !== countInRef.current) return;
        if (blocker !== null) {
          cancelCountdown();
          if (blocker) setCountInError(blocker);
          return;
        }
        // The recorder owns the prepared session from here.
        countInPhaseRef.current = "idle";
        setCountdown(null);
        setElapsedMs(0);
        act({ type: "creation-record-toggle" });
      });
    }, beatMs * RECORD_COUNTDOWN_START);
    countdownTimersRef.current.push(finishTimer);
  }, [act, bpm, cancelCountdown, playIsolatedClick, timeSignature]);

  const countingDown = preparing || countdown !== null;
  const recorded = model.recorded && !model.recording;
  const shownElapsedMs = model.recording ? elapsedMs : 0;
  const canRetry = !model.pending && (countingDown || model.recording || recorded);

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
          disabled={model.recording || countingDown || model.pending}
        />

        <ScrollView
          style={styles.center}
          contentContainerStyle={styles.centerContent}
          showsVerticalScrollIndicator={false}
        >
          {model.error && (
            <Text accessibilityRole="alert" style={styles.error}>
              {model.error}
            </Text>
          )}
          {countInError && (
            <Text accessibilityRole="alert" style={styles.error}>
              {countInError}
            </Text>
          )}

          {!recorded ? (
            countdown !== null ? (
              <View style={styles.countdownWrap}>
                <View style={styles.countdownRing}>
                  <Text
                    accessibilityLiveRegion="assertive"
                    accessibilityLabel={countdownCaption(countdown)}
                    style={styles.countdownText}
                  >
                    {countdown}
                  </Text>
                </View>
                <Text importantForAccessibility="no" style={styles.countdownCaption}>
                  {countdownCaption(countdown)}
                </Text>
              </View>
            ) : (
              <View style={styles.stage}>
                <Text
                  accessibilityLabel={`녹음 경과 시간 ${Math.floor(shownElapsedMs / 1000)}초`}
                  style={styles.timerMain}
                >
                  {formatTrimTime(shownElapsedMs)}
                </Text>

                <View style={styles.waveWrap}>
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
                    </View>
                  )}
                </View>
              </View>
            )
          ) : (
            <View style={styles.recordedWrap}>
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
          <Touchable
            accessibilityRole="button"
            accessibilityLabel="다시 녹음"
            accessibilityState={{ disabled: !canRetry }}
            disabled={!canRetry}
            style={[styles.roundBtn, !canRetry && styles.disabled]}
            onPress={() => {
              if (countingDown) {
                cancelCountdown();
                setElapsedMs(0);
                return;
              }
              setElapsedMs(0);
              act({ type: "creation-record-retry" });
            }}
          >
            <RetryGlyph />
          </Touchable>

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
              accessibilityLabel={countingDown ? "카운트다운 취소" : model.recording ? "녹음 종료" : "녹음 시작"}
              accessibilityState={{ disabled: model.pending }}
              disabled={model.pending}
              style={[
                styles.mainBtn,
                (model.recording || countingDown) && styles.mainBtnLive,
                model.pending && styles.disabled,
              ]}
              onPress={() => {
                if (countingDown) {
                  cancelCountdown();
                  return;
                }
                if (model.recording) {
                  act({ type: "creation-record-toggle" });
                  return;
                }
                void startCountdown();
              }}
            >
              {model.recording || countingDown ? <View style={styles.stopSquare} /> : <MicGlyph />}
            </Touchable>
          )}

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
        </View>
      </View>
      <InstrumentSheet picker={model.instrument} />
      <TimingSheet sheet={model.timing ?? null} />
      {model.loading && (
        <LoadingOverlay message={model.loading.message} submessage={model.loading.submessage} />
      )}
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
  view: { flex: 1, gap: 20, paddingHorizontal: 16, paddingTop: 16 },
  center: { flex: 1 },
  centerContent: { flexGrow: 1, justifyContent: "center", gap: 20, paddingVertical: 8 },
  countdownWrap: { alignItems: "center", justifyContent: "center" },
  countdownRing: {
    width: 112,
    height: 112,
    borderRadius: 56,
    borderWidth: 2,
    borderColor: colors.primary,
    backgroundColor: "rgba(76, 0, 229, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  countdownText: {
    color: "#ffffff",
    fontSize: 56,
    lineHeight: 62,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  countdownCaption: {
    marginTop: 12,
    color: "rgba(255, 255, 255, 0.7)",
    fontSize: 13,
    lineHeight: 18,
  },
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
  stage: {
    alignItems: "center",
    gap: 20,
  },
  timerMain: { color: "#ffffff", fontSize: 32, fontWeight: "700", fontVariant: ["tabular-nums"], textAlign: "center" },
  waveWrap: {
    width: "100%",
    height: 112,
    overflow: "hidden",
    justifyContent: "center",
  },
  waveCanvas: { width: "100%", height: 112 },
  idleWaveWrap: { flex: 1, justifyContent: "center", alignItems: "center" },
  idleCenterLine: { position: "absolute", left: 0, right: 0, height: 1, backgroundColor: "rgba(76, 0, 229, 0.25)" },
  idleBars: { flexDirection: "row", alignItems: "center", gap: 6, opacity: 0.45, height: "100%" },
  idleBar: { width: 3, borderRadius: 99, backgroundColor: "#7c3aed" },
  recordedWrap: { gap: 20 },
  convert: {
    gap: 8,
    paddingVertical: 4,
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
  actions: { flexDirection: "row", alignItems: "center", gap: 12, paddingTop: 4 },
  actionButton: { flex: 1, paddingHorizontal: 12 },
  transport: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 32, paddingTop: 14, paddingBottom: 8 },
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
  disabled: { opacity: 0.4 },
});
