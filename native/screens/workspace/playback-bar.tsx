import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Rect } from "react-native-svg";

import PlayIcon from "../../../public/figma/play.svg";
import MutedIcon from "../../../public/figma/sound-muted.svg";
import SoundIcon from "../../../public/figma/sound.svg";
import type { NativePlayback } from "../../../src/lib/native-screens";
import { Touchable } from "../../ui/kit";
import { useSmoothPlaybackMs } from "../../ui/smooth-playback";
import { colors } from "../../ui/theme";

function clock(ms: number) {
  const value = Number.isFinite(ms) ? Math.max(0, Math.floor(ms / 1000)) : 0;
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, "0")}`;
}

/**
 * The web's AudioPlaybackBar drawn from the page's player state; the audio plays in the web page.
 * Tapping the track seeks there.
 */
export function PlaybackBar({
  player,
  onToggle,
  onSeek,
  onMute,
}: {
  player: NativePlayback;
  onToggle: () => void;
  onSeek: (ms: number) => void;
  onMute: () => void;
}) {
  const [width, setWidth] = useState(0);
  const { durationMs, label } = player;
  // The clamped display position; it moves only while the audio actually plays (not while loading).
  const position = useSmoothPlaybackMs(
    player.positionMs,
    durationMs,
    player.playing && !player.loading,
  );
  const elapsed = clock(position);
  const total = durationMs === null ? "‒:‒" : clock(durationMs);
  const seekDisabled = player.disabled || player.loading || !durationMs;
  const fraction = durationMs ? position / durationMs : 0;
  return (
    <View style={styles.bar} accessibilityLabel={`${label} 재생바`}>
      <Touchable
        accessibilityRole="button"
        accessibilityLabel={`${label} ${player.playing ? "일시정지" : "재생"}`}
        accessibilityState={{
          disabled: player.disabled || player.loading,
          busy: player.loading,
          checked: player.playing,
        }}
        disabled={player.disabled || player.loading}
        hitSlop={8}
        style={[styles.toggle, (player.disabled || player.loading) && styles.disabled]}
        onPress={onToggle}
      >
        {player.loading ? (
          <ActivityIndicator size="small" color={colors.fg} />
        ) : player.playing ? (
          <Svg width={18} height={18} viewBox="0 0 24 24" fill={colors.fg}>
            <Rect x={6} y={4} width={4} height={16} rx={1} />
            <Rect x={14} y={4} width={4} height={16} rx={1} />
          </Svg>
        ) : (
          <PlayIcon width={15} height={18} />
        )}
      </Touchable>
      <Text style={styles.time}>
        {elapsed} / {total}
      </Text>
      <Pressable
        accessibilityRole="adjustable"
        accessibilityLabel={`${label} 재생 위치`}
        accessibilityValue={{
          text: `${elapsed} / ${durationMs === null ? "재생 시간 정보 없음" : total}`,
        }}
        accessibilityState={{ disabled: seekDisabled }}
        disabled={seekDisabled}
        style={styles.track}
        onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
        onPress={(event) => {
          if (durationMs && width > 0)
            onSeek(
              Math.round(
                Math.min(1, Math.max(0, event.nativeEvent.locationX / width)) * durationMs,
              ),
            );
        }}
      >
        <View style={styles.rail}>
          <View style={[styles.fill, { width: `${fraction * 100}%` }]} />
        </View>
        <View style={[styles.thumb, { left: Math.max(0, fraction * width - 5) }]} />
      </Pressable>
      <Touchable
        accessibilityRole="button"
        accessibilityLabel={player.muted ? `${label} 소리 켜기` : `${label} 음소거`}
        accessibilityState={{ disabled: player.disabled, checked: player.muted }}
        disabled={player.disabled}
        hitSlop={8}
        style={[styles.mute, player.disabled && styles.disabled]}
        onPress={onMute}
      >
        {player.muted ? <MutedIcon width={20} height={18} /> : <SoundIcon width={20} height={18} />}
      </Touchable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    height: 40,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    borderRadius: 10,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
  },
  toggle: { width: 24, height: "100%", alignItems: "center", justifyContent: "center" },
  disabled: { opacity: 0.5 },
  time: { color: colors.fg, fontSize: 14, lineHeight: 20, fontVariant: ["tabular-nums"] },
  track: { flex: 1, height: "100%", justifyContent: "center" },
  rail: { height: 4, borderRadius: 2, overflow: "hidden", backgroundColor: colors.line },
  fill: { height: 4, backgroundColor: colors.primary },
  thumb: {
    position: "absolute",
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.fg,
  },
  mute: { width: 24, height: 32, alignItems: "center", justifyContent: "center" },
});
