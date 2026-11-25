import { useEffect, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import Svg, { Defs, Ellipse, RadialGradient, Stop } from "react-native-svg";

import { DEFAULT_LOADING_DELAY_MS } from "../../src/components/shark-member";
import { useReducedMotion } from "./reduced-motion";
import { SharkBandLoader } from "./shark-band-loader";

export type LoadingOverlayProps = {
  message?: string;
  submessage?: string | null;
  /** Wait before showing so short loads never flash (ms). Default 1000ms, like the web. */
  delayMs?: number;
};

/**
 * The web's LoadingOverlay (#157): a full-screen dim layer with an animated shark band member, a
 * violet glow and a progress message that blocks touches on the screen below while a slow task
 * runs.
 * Render it only while busy, as the last child of the screen's root view.
 */
export function LoadingOverlay({
  message = "불러오는 중입니다.",
  submessage,
  delayMs = DEFAULT_LOADING_DELAY_MS,
}: LoadingOverlayProps) {
  const [ready, setReady] = useState(delayMs <= 0);
  useEffect(() => {
    if (delayMs <= 0) return;
    const timer = setTimeout(() => setReady(true), delayMs);
    return () => clearTimeout(timer);
  }, [delayMs]);

  // The layer exists and sits above every sibling from the first frame, so touches are blocked
  // during the delay too (transparent until ready; collapsable={false} keeps Fabric from flattening
  // it away). Only the visuals wait: the dim fades in with the content once ready.
  return (
    <View
      collapsable={false}
      style={styles.layer}
      accessible={ready}
      accessibilityRole="progressbar"
      accessibilityLabel={ready ? [message, submessage].filter(Boolean).join(" ") : undefined}
      accessibilityLiveRegion="polite"
      accessibilityState={{ busy: true }}
    >
      {ready ? <OverlayContent message={message} submessage={submessage} /> : null}
    </View>
  );
}

function OverlayContent({ message, submessage }: { message: string; submessage?: string | null }) {
  const reducedMotion = useReducedMotion();
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reducedMotion === null) return;
    if (reducedMotion) {
      opacity.setValue(1);
      return;
    }
    // The web fades the overlay in over 180ms ease-out.
    const fade = Animated.timing(opacity, {
      toValue: 1,
      duration: 180,
      easing: Easing.bezier(0, 0, 0.58, 1),
      useNativeDriver: true,
    });
    fade.start();
    return () => fade.stop();
  }, [opacity, reducedMotion]);

  return (
    <Animated.View style={[styles.dim, { opacity }]}>
      <View style={styles.column}>
        <Glow />
        <SharkBandLoader />
        <View style={styles.copy}>
          <Text allowFontScaling={false} style={styles.message}>
            {message}
          </Text>
          {submessage ? (
            <Text allowFontScaling={false} style={styles.submessage}>
              {submessage}
            </Text>
          ) : null}
        </View>
      </View>
    </Animated.View>
  );
}

const GLOW_WIDTH = 188;
const GLOW_HEIGHT = 156;

/**
 * The web glow: a 188 x 156 ellipse filled with
 * radial-gradient(ellipse at 50% 56%, violet 24% 0%, white 6% 44%, transparent 72%). The CSS
 * farthest-corner ellipse from (94, 87.36) keeps the closest-side aspect (94 / 68.64), so it
 * reaches the corners at rx 152.15 / ry 111.1.
 */
function Glow() {
  return (
    <View pointerEvents="none" style={styles.glow}>
      <Svg width={GLOW_WIDTH} height={GLOW_HEIGHT}>
        <Defs>
          <RadialGradient
            id="shark-loading-glow"
            cx={94}
            cy={87.36}
            fx={94}
            fy={87.36}
            rx={152.15}
            ry={111.1}
            gradientUnits="userSpaceOnUse"
          >
            <Stop offset={0} stopColor="#7c4dff" stopOpacity={0.24} />
            <Stop offset={0.44} stopColor="#ffffff" stopOpacity={0.06} />
            <Stop offset={0.72} stopColor="#ffffff" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Ellipse
          cx={GLOW_WIDTH / 2}
          cy={GLOW_HEIGHT / 2}
          rx={GLOW_WIDTH / 2}
          ry={GLOW_HEIGHT / 2}
          fill="url(#shark-loading-glow)"
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "transparent",
    zIndex: 120,
    elevation: 120,
  },
  dim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  column: {
    width: "100%",
    maxWidth: 320,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  // Centred on the column at 50% / 42%, like the web's translate(-50%, -50%).
  glow: {
    position: "absolute",
    left: "50%",
    top: "42%",
    width: GLOW_WIDTH,
    height: GLOW_HEIGHT,
    marginLeft: -GLOW_WIDTH / 2,
    marginTop: -GLOW_HEIGHT / 2,
  },
  copy: { alignItems: "center", gap: 4 },
  message: {
    color: "#ffffff",
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "600",
    letterSpacing: -0.16,
    textAlign: "center",
  },
  submessage: {
    color: "rgba(255, 255, 255, 0.7)",
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
  },
});
