import { useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import Logo from "../../../public/figma/auth-logo.svg";
import type { NativeOnboarding } from "../../../src/lib/native-screens";
import {
  INSTRUMENT_MAX_LENGTH,
  NICKNAME_MAX_LENGTH,
  PROFILE_BIO_MAX_LENGTH,
  clampCodePoints,
  codePointLength,
} from "../../../src/lib/content-limits";
import { Touchable } from "../../ui/kit";
import { useScreen } from "../../ui/screen-context";
import { colors, gutter, type } from "../../ui/theme";
import type { ScreenProps } from "../types";
import { authStyles, errorColor } from "./styles";

const steps = [
  {
    field: "nickname",
    title: "당신의 이름은 무엇인가요?",
    hint: "이름을 알려주세요",
    label: "이름",
    placeholder: undefined,
    limit: NICKNAME_MAX_LENGTH,
  },
  {
    field: "instrument",
    title: "당신의 주 악기는 무엇인가요?",
    hint: "악기를 알려주세요",
    label: "악기",
    placeholder: "피아노, 기타",
    limit: INSTRUMENT_MAX_LENGTH,
  },
  {
    field: "explanation",
    title: "당신을 설명해주세요",
    hint: "당신은 어떤 사람인가요?",
    label: "설명",
    placeholder: undefined,
    limit: PROFILE_BIO_MAX_LENGTH,
  },
] as const;

/**
 * The web's first-login profile setup (src/features/auth/initial-profile-setup.tsx): one field per
 * step; the page validates each step and saves after the last.
 */
export function OnboardingScreen({ model }: ScreenProps<"auth-onboarding">) {
  return (
    <View style={authStyles.screen}>
      <View style={authStyles.header}>
        <Logo width={68} height={43} accessibilityLabel="Narackrock" />
      </View>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        bounces={false}
      >
        {/* A new step starts from the page's value for its field, like the web's keyed step. */}
        <Step key={model.step} model={model} />
      </ScrollView>
    </View>
  );
}

function Step({ model }: { model: NativeOnboarding }) {
  const { act } = useScreen();
  const step = steps[model.step];
  const [text, setText] = useState(model.values[step.field]);
  const submit = () => act({ type: "advance", value: text });
  return (
    <View style={styles.content}>
      <Text style={styles.title} accessibilityRole="header">
        {step.title}
      </Text>
      <Text style={styles.hint}>{step.hint}</Text>
      <View style={styles.field}>
        <Text style={styles.label}>{step.label}</Text>
        <TextInput
          value={text}
          onChangeText={(value) => setText(clampCodePoints(value, step.limit))}
          onSubmitEditing={submit}
          submitBehavior="submit"
          returnKeyType={model.step === 2 ? "done" : "next"}
          placeholder={step.placeholder}
          placeholderTextColor="rgba(170, 182, 194, 0.7)"
          selectionColor={colors.accent}
          autoFocus
          editable={!model.saving}
          accessibilityLabel={step.label}
          style={styles.input}
        />
        <Text style={[type.caption, { textAlign: "right", marginTop: 4 }]}>
          {codePointLength(text)}/{step.limit}자
        </Text>
      </View>
      {model.error && (
        <Text accessibilityRole="alert" style={styles.error}>
          {model.error}
        </Text>
      )}
      <Touchable
        accessibilityRole="button"
        accessibilityState={{ disabled: model.saving, busy: model.saving }}
        disabled={model.saving}
        style={[styles.next, model.saving && styles.dimmed]}
        onPress={submit}
      >
        <Text style={styles.nextText}>
          {model.saving ? "저장 중..." : model.step === 2 ? "시작하기" : "다음"}
        </Text>
      </Touchable>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, justifyContent: "center", paddingHorizontal: gutter },
  // The web lifts the centred block by 24px.
  content: { transform: [{ translateY: -24 }] },
  title: { color: colors.fg, fontSize: 24, lineHeight: 33.6, letterSpacing: -0.48 },
  hint: {
    marginTop: 10,
    marginBottom: 22,
    color: "rgba(255, 255, 255, 0.55)",
    fontSize: 14,
    lineHeight: 21,
  },
  field: { gap: 10 },
  label: { color: colors.fg, fontSize: 14, lineHeight: 21, fontWeight: "600" },
  input: {
    height: 42,
    paddingHorizontal: 10,
    paddingVertical: 0,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: colors.surface,
    color: colors.fg,
    fontSize: 14,
    fontWeight: "600",
  },
  error: { color: errorColor, fontSize: 14, lineHeight: 21 },
  next: {
    marginTop: 22,
    height: 44,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
  },
  nextText: { color: colors.fg, fontSize: 14, lineHeight: 21, fontWeight: "600" },
  dimmed: { opacity: 0.55 },
});
