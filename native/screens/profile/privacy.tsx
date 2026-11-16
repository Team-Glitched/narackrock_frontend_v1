import { Linking, StyleSheet, Text, View } from "react-native";

import { AppHeader } from "../../ui/header";
import { Touchable } from "../../ui/kit";
import { ScreenScroll } from "../../ui/screen";
import { useScreen } from "../../ui/screen-context";
import { colors, gutter } from "../../ui/theme";
import type { ScreenProps } from "../types";

/** The web privacy policy (src/features/settings/privacy-policy-screen.tsx). */
export function PrivacyScreen({ model, header }: ScreenProps<"profile-privacy">) {
  const { act } = useScreen();
  return (
    <>
      {header && <AppHeader header={header} />}
      <ScreenScroll>
        <View style={styles.article}>
          <Touchable
            accessibilityRole="link"
            accessibilityLabel="Narackrock 홈으로 이동"
            style={styles.homeLink}
            onPress={() => act({ type: "home" })}
          >
            <Text style={styles.link}>Narackrock</Text>
          </Touchable>
          <Text style={styles.eyebrow}>{model.eyebrow}</Text>
          <Text style={styles.title} accessibilityRole="header">
            {model.title}
          </Text>
          <Text style={styles.text}>{model.intro}</Text>
          <Text style={styles.effective}>{model.effective}</Text>
          <View style={styles.sections}>
            {model.sections.map((section) => (
              <View key={section.title}>
                <Text style={styles.sectionTitle} accessibilityRole="header">
                  {section.title}
                </Text>
                {section.blocks.map((block, index) =>
                  "ul" in block ? (
                    <View key={index}>
                      {block.ul.map((item) => (
                        <View key={item} style={styles.bullet}>
                          <Text style={styles.text}>•</Text>
                          <Text style={[styles.text, styles.flex]}>{item}</Text>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <Text key={index} style={styles.text}>
                      {block.p}
                      {block.email && (
                        <Text
                          accessibilityRole="link"
                          style={styles.link}
                          onPress={() => void Linking.openURL(`mailto:${block.email}`)}
                        >
                          {block.email}
                        </Text>
                      )}
                    </Text>
                  ),
                )}
              </View>
            ))}
          </View>
          <View style={styles.footer}>
            <Text style={styles.text}>{model.closing}</Text>
            <Touchable
              accessibilityRole="link"
              style={styles.back}
              onPress={() => act({ type: "home" })}
            >
              <Text style={styles.link}>Narackrock으로 돌아가기</Text>
            </Touchable>
          </View>
        </View>
      </ScreenScroll>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  article: { paddingHorizontal: gutter, paddingTop: 16 },
  homeLink: { alignSelf: "flex-start" },
  link: { color: colors.accent, textDecorationLine: "underline", fontSize: 16, lineHeight: 28 },
  eyebrow: { marginTop: 24, color: colors.muted, fontSize: 14, lineHeight: 20 },
  title: { marginVertical: 12, color: colors.fg, fontSize: 20, lineHeight: 32, fontWeight: "700" },
  text: { color: colors.fg, fontSize: 16, lineHeight: 28 },
  effective: { marginTop: 12, color: colors.muted, fontSize: 14, lineHeight: 20 },
  sections: { marginTop: 32, gap: 28 },
  sectionTitle: {
    marginBottom: 12,
    color: colors.fg,
    fontSize: 16,
    lineHeight: 28,
    fontWeight: "600",
  },
  bullet: { flexDirection: "row", gap: 8, paddingLeft: 4, marginBottom: 8 },
  footer: {
    marginTop: 32,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: colors.surface,
  },
  back: { alignSelf: "flex-start", marginTop: 16 },
});
