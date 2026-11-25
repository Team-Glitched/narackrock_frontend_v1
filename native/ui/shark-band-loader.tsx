import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Animated, Easing, StyleSheet, View, useWindowDimensions } from "react-native";

import {
  SHARK_MEMBER_SPECS,
  pickNextSharkMember,
  type SharkMember,
} from "../../src/components/shark-member";
import {
  SHARK_LOOP_MS,
  SHARK_MEMBER_PARTS,
  SHARK_MOTIONS,
  type SharkPart,
  type SharkTrack,
  type SharkTransformOp,
} from "./shark-band-loader-parts";
import { useReducedMotion } from "./reduced-motion";

type StaticTransform =
  | { translateX: number }
  | { translateY: number }
  | { rotate: string }
  | { skewX: string }
  | { scaleX: number }
  | { scaleY: number };

type MotionTransform =
  | { translateX: Animated.AnimatedInterpolation<number> }
  | { translateY: Animated.AnimatedInterpolation<number> }
  | { rotate: Animated.AnimatedInterpolation<string> };

function staticTransform(op: SharkTransformOp, k: number): StaticTransform {
  if ("translateX" in op) return { translateX: op.translateX * k };
  if ("translateY" in op) return { translateY: op.translateY * k };
  if ("rotate" in op) return { rotate: `${op.rotate}deg` };
  if ("skewX" in op) return { skewX: `${op.skewX}deg` };
  if ("scaleX" in op) return { scaleX: op.scaleX };
  return { scaleY: op.scaleY };
}

function lengthTrack(progress: Animated.Value, track: SharkTrack, k: number) {
  return progress.interpolate({ inputRange: track.at, outputRange: track.v.map((v) => v * k) });
}

/** The web keyframes run on the motion box around its centre: translate, then rotate. */
function motionTransform(progress: Animated.Value, id: string, k: number): MotionTransform[] {
  const motion = SHARK_MOTIONS[id];
  const ops: MotionTransform[] = [];
  if (motion.x) ops.push({ translateX: lengthTrack(progress, motion.x, k) });
  if (motion.y) ops.push({ translateY: lengthTrack(progress, motion.y, k) });
  if (motion.r) {
    const { at, v } = motion.r;
    ops.push({
      rotate: progress.interpolate({ inputRange: at, outputRange: v.map((deg) => `${deg}deg`) }),
    });
  }
  return ops;
}

/** Renders parts laid out in a w x h parent box; every Figma length is scaled by k. */
function renderParts(
  parts: SharkPart[],
  w: number,
  h: number,
  k: number,
  progress: Animated.Value,
): ReactNode[] {
  return parts.map((part, index) => {
    if ("s" in part) {
      const Art = part.s;
      return <Art key={index} width={w * k} height={h * k} style={StyleSheet.absoluteFill} />;
    }
    const style = {
      position: "absolute" as const,
      left: part.x * k,
      top: part.y * k,
      width: part.w * k,
      height: part.h * k,
      backgroundColor: part.bg,
      borderRadius: part.r === undefined ? undefined : part.r * k,
    };
    const fixed = part.t?.map((op) => staticTransform(op, k)) ?? [];
    const children = part.c ? renderParts(part.c, part.w, part.h, k, progress) : null;
    if (!part.m) {
      return (
        <View key={index} style={[style, fixed.length ? { transform: fixed } : null]}>
          {children}
        </View>
      );
    }
    return (
      <Animated.View
        key={index}
        style={[style, { transform: [...fixed, ...motionTransform(progress, part.m, k)] }]}
      >
        {children}
      </Animated.View>
    );
  });
}

const STAGE_WIDTH = 176;
const STAGE_HEIGHT = 144;

/**
 * The web SharkBandLoader: one shark band member (picked like the web, never the same twice in a
 * row) playing the Figma 2s loop in a 176 x 144 stage. Only the chosen member's parts are mounted.
 */
export function SharkBandLoader({ member }: { member?: SharkMember }) {
  const [pickedMember] = useState<SharkMember>(() => member ?? pickNextSharkMember());
  const activeMember = member ?? pickedMember;
  const spec = SHARK_MEMBER_SPECS[activeMember];
  const reducedMotion = useReducedMotion();
  const progress = useRef(new Animated.Value(0)).current;
  // The web shrinks the stage to 0.85 in landscape and on viewports up to 440px tall.
  const { width, height } = useWindowDimensions();
  const k = spec.scale * (width > height || height <= 440 ? 0.85 : 1);

  useEffect(() => {
    if (reducedMotion !== false) {
      progress.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.timing(progress, {
        toValue: 1,
        duration: SHARK_LOOP_MS,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [progress, reducedMotion]);

  const art = useMemo(
    () => renderParts(SHARK_MEMBER_PARTS[activeMember], 0, 0, k, progress),
    [activeMember, k, progress],
  );

  return (
    <View
      style={styles.stage}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View style={{ width: spec.inkWidth * k, height: spec.inkHeight * k }}>
        <View style={{ position: "absolute", left: -spec.inkLeft * k, top: -spec.inkTop * k }}>
          {art}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stage: {
    width: STAGE_WIDTH,
    height: STAGE_HEIGHT,
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
    overflow: "visible",
  },
});
