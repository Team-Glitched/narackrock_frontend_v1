import type { FC } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import type { SvgProps } from "react-native-svg";

import AbyssOff from "../public/figma/nav-abyss-off.svg";
import AbyssOn from "../public/figma/nav-abyss-on.svg";
import HomeOff from "../public/figma/nav-home-off.svg";
import HomeOn from "../public/figma/nav-home-on.svg";
import SourcesOff from "../public/figma/nav-opensource-off.svg";
import SourcesOn from "../public/figma/nav-opensource-on.svg";
import SocialOff from "../public/figma/nav-social-off.svg";
import SocialOn from "../public/figma/nav-social-on.svg";
import type {
  NativeFooter,
  NativeFooterPress,
  NativeFooterTab,
} from "../src/lib/native-bridge-protocol";
import { designTokens } from "../src/styles/tokens";

type Tab = { id: NativeFooterTab; label: string; on: FC<SvgProps>; off: FC<SvgProps> };

const leadingTabs: Tab[] = [
  { id: "home", label: "홈", on: HomeOn, off: HomeOff },
  { id: "abyss", label: "어비스", on: AbyssOn, off: AbyssOff },
];
const trailingTabs: Tab[] = [
  { id: "social", label: "소셜", on: SocialOn, off: SocialOff },
  { id: "opensource", label: "샘플", on: SourcesOn, off: SourcesOff },
];

// The web renders a fixed 390×844 canvas scaled to fit the WebView (src/components/design-viewport.tsx)
// and keeps the footer's 44px row (sharedStyles.appFooter) as a placeholder at the canvas bottom.
// The bar is laid out in canvas px and multiplied by the same scale so it covers that row exactly.
const CANVAS = { width: 390, height: 844 };
const FOOTER = { height: 44, paddingX: 17, gap: 34, item: 44, icon: 20, labelGap: 4 };
const CREATE = { circle: 40, plus: 20, stroke: 2 };
const CREATE_COLORS = { circle: designTokens.colors["blue-gray"], plus: "#d7dce2" };
const RIPPLE = "rgba(255, 255, 255, 0.16)";

export function TabBar({
  footer,
  viewport,
  onPress,
}: {
  footer: NativeFooter;
  /** Size of the WebView the web canvas is fitted into. */
  viewport: { width: number; height: number };
  onPress: (press: NativeFooterPress) => void;
}) {
  const scale = Math.min(viewport.width / CANVAS.width, viewport.height / CANVAS.height, 1);
  const canvasBottom = (viewport.height + CANVAS.height * scale) / 2;
  const px = (value: number) => value * scale;

  const renderTab = ({ id, label, on: On, off: Off }: Tab) => {
    const selected = footer.activeTab === id;
    const Icon = selected ? On : Off;
    return (
      <Pressable
        key={id}
        accessibilityRole="tab"
        accessibilityLabel={label}
        accessibilityState={{ selected }}
        android_ripple={{ color: RIPPLE, borderless: true, radius: px(FOOTER.item / 2 + 4) }}
        style={({ pressed }) => [
          styles.item,
          { width: px(FOOTER.item), height: px(FOOTER.item), gap: px(FOOTER.labelGap) },
          pressed && Platform.OS === "ios" && styles.pressed,
        ]}
        onPress={() => onPress(id)}
      >
        <Icon
          width={px(FOOTER.icon)}
          height={px(FOOTER.icon)}
          preserveAspectRatio="xMidYMid meet"
        />
        <Text
          allowFontScaling={false}
          style={[styles.label, { fontSize: px(10), lineHeight: px(12) }]}
        >
          {label}
        </Text>
      </Pressable>
    );
  };

  return (
    <View
      style={[styles.bar, { top: canvasBottom - px(FOOTER.height), height: px(FOOTER.height) }]}
    >
      <View style={[styles.row, { gap: px(FOOTER.gap), paddingHorizontal: px(FOOTER.paddingX) }]}>
        {leadingTabs.map(renderTab)}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={footer.createLabel}
          android_ripple={{ color: RIPPLE, borderless: true, radius: px(CREATE.circle / 2) }}
          style={({ pressed }) => [
            styles.item,
            { width: px(FOOTER.item), height: px(FOOTER.item) },
            pressed && Platform.OS === "ios" && styles.pressed,
          ]}
          onPress={() => onPress("create")}
        >
          <View
            style={[
              styles.item,
              {
                width: px(CREATE.circle),
                height: px(CREATE.circle),
                borderRadius: px(CREATE.circle / 2),
                backgroundColor: CREATE_COLORS.circle,
              },
            ]}
          >
            <View
              style={[
                styles.plus,
                {
                  width: px(CREATE.plus),
                  height: px(CREATE.stroke),
                  borderRadius: px(CREATE.stroke),
                },
              ]}
            />
            <View
              style={[
                styles.plus,
                {
                  width: px(CREATE.stroke),
                  height: px(CREATE.plus),
                  borderRadius: px(CREATE.stroke),
                },
              ]}
            />
          </View>
        </Pressable>
        {trailingTabs.map(renderTab)}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: designTokens.colors.bg,
  },
  row: { flexDirection: "row", alignItems: "center" },
  item: { alignItems: "center", justifyContent: "center" },
  label: { color: designTokens.colors.fg, fontWeight: "500" },
  plus: { position: "absolute", backgroundColor: CREATE_COLORS.plus },
  pressed: { opacity: 0.6 },
});
