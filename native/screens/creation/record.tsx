import { useEffect, useState } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from "react-native-svg";

import MetronomeIcon from "../../../public/figma/metronome-large.svg";
import RecordStartIcon from "../../../public/figma/record-start.svg";
import { useRecordingLevels } from "../../audio";
import { AppHeader } from "../../ui/header";
import { Button, Touchable } from "../../ui/kit";
import { useScreen } from "../../ui/screen-context";
import { colors } from "../../ui/theme";
import { InstrumentSheet } from "../studio/parts";
import type { ScreenProps } from "../types";

const formatRecordingTime = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

/** Horizontal pixels per level column; the waveform scrolls right to left like the web's meter. */
const columnWidth = 2;

/** Quietest peak the meter shows (dBFS); the meter spans it to full scale. */
const meterFloorDb = -45;

/**
 * A peak (0–1) as meter height (0–1) on a decibel scale. The web draws the raw waveform, which the
 * browser's automatic gain control keeps large; the app's microphone has none, so speech peaks
 * around -15 dBFS and a linear drawing stays nearly flat.
 */
function meterLevel(peak: number): number {
  if (peak <= 0) return 0;
  return Math.max(0, Math.min(1, 1 - (20 * Math.log10(peak)) / meterFloorDb));
}

/** The web's CompositionRecordScreen; the app records and draws the live meter. */
export function CreationRecordScreen({ model, header }: ScreenProps<"creation-record">) {
  const { act, bottomInset } = useScreen();
  return (
    <>
      {header && <AppHeader header={header} />}
      <View style={[styles.view, { paddingBottom: bottomInset }]}>
        {model.notice && (
          <Text accessibilityRole="alert" style={styles.notice}>
            {model.notice}
          </Text>
        )}
        <MetronomeIcon width={137} height={200} style={styles.symbol} />
        <View style={styles.output}>
          {model.error && (
            <Text accessibilityRole="alert" style={styles.text}>
              {model.error}
            </Text>
          )}
          {model.recorded && !model.recording && (
            <Touchable
              accessibilityRole="button"
              accessibilityLabel={model.previewing ? "미리 듣기 정지" : "녹음 미리 듣기"}
              disabled={model.pending}
              style={[styles.play, model.pending && styles.disabled]}
              onPress={() => act({ type: "creation-record-preview" })}
            >
              <Text style={styles.playText}>{model.previewing ? "■" : "▶"}</Text>
            </Touchable>
          )}
          {model.recording && <RecordingMeter />}
          <Text accessibilityLiveRegion="polite" style={styles.status}>
            {model.status}
          </Text>
          {model.recorded && (
            <View style={styles.actions}>
              <Button
                label={model.saveLabel}
                disabled={model.pending}
                onPress={() => act({ type: "creation-record-save" })}
              />
              {model.transform && (
                <Button
                  tone="secondary"
                  label="HTI로 MIDI 변환"
                  disabled={model.pending}
                  onPress={() => act({ type: "creation-record-transform" })}
                />
              )}
            </View>
          )}
        </View>
        <Touchable
          accessibilityRole="button"
          accessibilityLabel={model.recording ? "녹음 종료" : "녹음 시작"}
          accessibilityState={{ disabled: model.pending }}
          disabled={model.pending}
          style={[
            styles.recordButton,
            { bottom: bottomInset + 48 },
            model.pending && styles.disabled,
          ]}
          onPress={() => act({ type: "creation-record-toggle" })}
        >
          {model.recording ? (
            <Svg width={82} height={82} viewBox="0 0 82 82">
              <Circle cx={41} cy={41} r={41} fill="#F2F4F6" />
              <Rect x={29} y={29} width={24} height={24} rx={4} fill="#1D1D1D" />
            </Svg>
          ) : (
            <RecordStartIcon width={82} height={82} />
          )}
        </Touchable>
      </View>
      <InstrumentSheet picker={model.instrument} />
    </>
  );
}

/** Elapsed time and the live microphone levels, scrolling from right to left. */
function RecordingMeter() {
  const levels = useRecordingLevels();
  const [startedAt] = useState(() => Date.now());
  const [now, setNow] = useState(startedAt);
  const [width, setWidth] = useState(0);
  const [pulse] = useState(() => new Animated.Value(1));
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 250);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.5, duration: 500, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 500, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => {
      clearInterval(timer);
      loop.stop();
    };
  }, [pulse]);
  const seconds = Math.floor((now - startedAt) / 1000);
  const height = 80;
  const middle = height / 2;
  const shown = levels.slice(-(Math.ceil(width / columnWidth) + 1));
  const x = (index: number) => width - (shown.length - 1 - index) * columnWidth;
  const level = (value: number) => Math.max(0.75, meterLevel(value) * (middle - 1));
  const path = shown.length
    ? `M${shown.map((value, index) => `${x(index)},${middle - level(value)}`).join("L")}L${shown
        .map((value, index) => `${x(index)},${middle + level(value)}`)
        .reverse()
        .join("L")}Z`
    : "";
  return (
    <View style={styles.meter}>
      <View style={styles.elapsed}>
        <Animated.View style={[styles.dot, { opacity: pulse }]} />
        <Text accessibilityLabel={`녹음 시간 ${seconds}초`} style={styles.elapsedText}>
          {formatRecordingTime(seconds)}
        </Text>
      </View>
      <View
        style={styles.wave}
        importantForAccessibility="no-hide-descendants"
        onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      >
        {width > 0 && (
          <Svg width={width} height={height}>
            <Defs>
              <LinearGradient id="fade" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor={colors.primary} stopOpacity={0} />
                <Stop offset="0.25" stopColor={colors.primary} stopOpacity={1} />
                <Stop offset="1" stopColor={colors.primary} stopOpacity={1} />
              </LinearGradient>
            </Defs>
            <Rect
              x={0}
              y={middle - 0.5}
              width={width}
              height={1}
              fill={colors.primary}
              opacity={0.35}
            />
            {path && <Path d={path} fill="url(#fade)" />}
          </Svg>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  view: { flex: 1, alignItems: "center" },
  notice: {
    position: "absolute",
    top: 8,
    left: 20,
    right: 20,
    color: colors.error,
    fontSize: 14,
    lineHeight: 20,
  },
  symbol: { position: "absolute", top: 120 },
  output: {
    position: "absolute",
    top: 345,
    width: 350,
    maxWidth: "100%",
    alignItems: "center",
    gap: 16,
  },
  text: { color: colors.fg, fontSize: 14, lineHeight: 20, textAlign: "center" },
  status: { color: colors.muted, fontSize: 14, lineHeight: 20, textAlign: "center" },
  play: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    paddingLeft: 2,
    backgroundColor: "#ffffff",
  },
  playText: { color: "#15161a", fontSize: 14 },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  recordButton: { position: "absolute", width: 82, height: 82 },
  disabled: { opacity: 0.5 },
  meter: { width: "100%", alignItems: "center", gap: 12 },
  elapsed: { flexDirection: "row", alignItems: "center", gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#ff4d4f" },
  elapsedText: {
    color: colors.fg,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  wave: { width: "100%", height: 80 },
});
