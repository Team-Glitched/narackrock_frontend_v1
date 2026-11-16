import { StyleSheet, Text, View } from "react-native";

import Logo from "../../../public/figma/auth-logo.svg";
import GoogleIcon from "../../../public/figma/google-g.svg";
import { Touchable } from "../../ui/kit";
import { useScreen } from "../../ui/screen-context";
import { colors, gutter } from "../../ui/theme";
import type { ScreenProps } from "../types";
import { authStyles, errorColor } from "./styles";

/** The web login page (src/features/auth/auth-screen.tsx AuthScreen) with the app's Google button. */
export function LoginScreen({ model }: ScreenProps<"auth-login">) {
  const { act } = useScreen();
  return (
    <View style={authStyles.screen} accessibilityLabel="로그인">
      <View style={authStyles.header}>
        <Touchable
          accessibilityRole="link"
          accessibilityLabel="나락락 홈으로 이동"
          onPress={() => act({ type: "home" })}
        >
          <Logo width={68} height={43} />
        </Touchable>
      </View>
      <View style={styles.content}>
        <View>
          <Text style={styles.title} accessibilityRole="header">
            {model.returning ? "다시 만나 반가워요" : "나만의 음악,\n여기서 시작해요"}
          </Text>
          <Text style={styles.intro}>
            {model.returning
              ? "나락락에 로그인하고\n당신만의 음악을 이어가세요."
              : "Google 계정 하나로 간편하게 가입하고\n나만의 곡을 만들고 나눠보세요."}
          </Text>
        </View>
        {!model.configured && <GoogleButton disabled busy={false} />}
        {model.error && (
          <Text accessibilityRole="alert" style={styles.error}>
            {model.error}
          </Text>
        )}
        {model.configured && (
          <GoogleButton
            disabled={model.busy}
            busy={model.busy}
            onPress={() => act({ type: "google" })}
          />
        )}
        <Touchable
          accessibilityRole="link"
          hitSlop={8}
          style={styles.privacy}
          onPress={() => act({ type: "privacy" })}
        >
          <Text style={styles.privacyText}>개인정보처리방침</Text>
        </Touchable>
      </View>
    </View>
  );
}

/**
 * The web's google-auth-button; without a client ID it is the disabled placeholder. Busy dims it
 * like the web's is-busy Google button.
 */
function GoogleButton({
  disabled,
  busy,
  onPress,
}: {
  disabled: boolean;
  busy: boolean;
  onPress?: () => void;
}) {
  return (
    <Touchable
      accessibilityRole="button"
      accessibilityLabel="Google로 로그인"
      accessibilityHint={onPress ? undefined : "Google 인증 설정이 필요합니다."}
      accessibilityState={{ disabled, busy }}
      disabled={disabled}
      style={[styles.google, busy && styles.busy]}
      onPress={onPress}
    >
      <GoogleIcon width={20} height={20} />
      <Text style={styles.googleText}>Google로 로그인</Text>
    </Touchable>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "flex-start",
    gap: 28,
    paddingHorizontal: gutter,
  },
  title: { color: colors.fg, fontSize: 30, lineHeight: 45, fontWeight: "700" },
  intro: { marginTop: 10, color: colors.muted, fontSize: 16, lineHeight: 24 },
  google: {
    alignSelf: "stretch",
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  busy: { opacity: 0.55 },
  googleText: { color: colors.fg, fontSize: 16, lineHeight: 25.6 },
  error: { alignSelf: "stretch", color: errorColor, fontSize: 14, lineHeight: 21 },
  privacy: { marginTop: 20 },
  privacyText: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
    textDecorationLine: "underline",
  },
});
