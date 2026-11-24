import { useState } from "react";
import { Image, StyleSheet, Text, TextInput, View } from "react-native";

import AddIcon from "../../../public/figma/profile-photo-add.svg";
import { profileInstrumentLabels } from "../../../src/features/composition/instrument-parts";
import type { NativeEditProfile } from "../../../src/lib/native-screens";
import {
  NICKNAME_MAX_LENGTH,
  PROFILE_BIO_MAX_LENGTH,
  clampCodePoints,
  codePointLength,
  sanitizeMultiline,
  sanitizeSingleLine,
} from "../../../src/lib/content-limits";
import { AppHeader } from "../../ui/header";
import { Avatar, Touchable } from "../../ui/kit";
import { ScreenScroll } from "../../ui/screen";
import { useScreen } from "../../ui/screen-context";
import { colors, gutter, type } from "../../ui/theme";
import type { ScreenProps } from "../types";
import { ProfileInstrumentDialog } from "./instrument-dialog";
import { CenterMessage, PreferenceRow } from "./parts";

/** The web profile editor (src/features/profile/profile-screens.tsx EditProfileScreen / ProfileForm). */
export function EditProfileScreen({ model, header }: ScreenProps<"profile-edit">) {
  return (
    <>
      {header && <AppHeader header={header} />}
      {model.initial ? (
        // A different account starts a fresh form.
        <Form key={model.initial.userId} model={model} initial={model.initial} />
      ) : (
        <CenterMessage tone={model.status === "error" ? "error" : "muted"}>
          {model.message}
        </CenterMessage>
      )}
    </>
  );
}

function Form({
  model,
  initial,
}: {
  model: NativeEditProfile;
  initial: NonNullable<NativeEditProfile["initial"]>;
}) {
  const { act, uri } = useScreen();
  const [nickname, setNickname] = useState(initial.nickname);
  const [instrument, setInstrument] = useState(initial.instrument);
  const [instrumentOpen, setInstrumentOpen] = useState(false);
  const [explanation, setExplanation] = useState(initial.explanation);
  const { saving, privacy } = model;
  const instrumentDisplay = profileInstrumentLabels(instrument).join(", ");
  return (
    <>
      <ScreenScroll>
        <View style={styles.form}>
          {privacy && (
            <View style={styles.privacy}>
              <PreferenceRow
                large
                title="비공개 계정"
                description="켜면 팔로우는 승인 후에만 이뤄지고 관계 목록이 숨겨집니다."
                value={privacy.isPrivate}
                disabled={privacy.busy}
                alert={privacy.error}
                onChange={(value) => act({ type: "privacy", value })}
              />
            </View>
          )}
          <Touchable
            accessibilityRole="button"
            accessibilityLabel="프로필 사진 변경"
            accessibilityState={{ disabled: saving }}
            disabled={saving}
            style={styles.avatar}
            onPress={() => act({ type: "pick-image" })}
          >
            <View style={styles.avatarRing}>
              {model.imagePreview ? (
                <Image
                  source={{ uri: model.imagePreview }}
                  style={styles.preview}
                  accessibilityLabel="프로필"
                />
              ) : (
                <Avatar uri={uri(initial.imageUrl)} size={136} />
              )}
            </View>
            <View style={styles.overlay} pointerEvents="none">
              <AddIcon width={48} height={48} />
            </View>
          </Touchable>
          <Field label="이름">
            <TextInput
              value={nickname}
              onChangeText={(value) => setNickname(clampCodePoints(value, NICKNAME_MAX_LENGTH))}
              editable={!saving}
              accessibilityLabel="이름"
              selectionColor={colors.accent}
              style={styles.input}
            />
            <Text style={[type.caption, { textAlign: "right" }]}>
              {codePointLength(nickname)}/{NICKNAME_MAX_LENGTH}자
            </Text>
          </Field>
          <Field label="악기">
            <Touchable
              accessibilityRole="button"
              accessibilityLabel="악기 선택"
              accessibilityState={{ disabled: saving, expanded: instrumentOpen }}
              disabled={saving}
              style={styles.selector}
              onPress={() => setInstrumentOpen(true)}
            >
              <Text
                numberOfLines={1}
                style={instrumentDisplay ? styles.selectorText : styles.selectorPlaceholder}
              >
                {instrumentDisplay || "악기를 선택하세요"}
              </Text>
            </Touchable>
          </Field>
          <Field label="설명">
            <TextInput
              value={explanation}
              onChangeText={(value) =>
                setExplanation(clampCodePoints(value, PROFILE_BIO_MAX_LENGTH))
              }
              editable={!saving}
              multiline
              accessibilityLabel="설명"
              selectionColor={colors.accent}
              style={[styles.input, styles.textarea]}
            />
            <Text style={[type.caption, { textAlign: "right" }]}>
              {codePointLength(explanation)}/{PROFILE_BIO_MAX_LENGTH}자
            </Text>
          </Field>
          {model.error && (
            <Text accessibilityRole="alert" style={styles.error}>
              {model.error}
            </Text>
          )}
          <Touchable
            accessibilityRole="button"
            accessibilityState={{ disabled: saving, busy: saving }}
            disabled={saving}
            style={[styles.save, saving && styles.saveDisabled]}
            onPress={() =>
              act({
                type: "save",
                nickname: sanitizeSingleLine(nickname),
                instrument: sanitizeSingleLine(instrument),
                explanation: sanitizeMultiline(explanation),
              })
            }
          >
            <Text style={styles.saveText}>{saving ? "저장 중..." : model.submitLabel}</Text>
          </Touchable>
          <Touchable
            accessibilityRole="link"
            style={styles.policy}
            onPress={() => act({ type: "open-privacy-policy" })}
          >
            <Text style={styles.policyText}>개인정보처리방침</Text>
          </Touchable>
        </View>
      </ScreenScroll>
      {instrumentOpen && (
        <ProfileInstrumentDialog
          value={instrument}
          allowEmpty
          onConfirm={(formatted) => setInstrument(formatted)}
          onClose={() => setInstrumentOpen(false)}
        />
      )}
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={type.title}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: 24, paddingHorizontal: gutter, paddingTop: 12 },
  privacy: {
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  avatar: { alignSelf: "center", width: 140, height: 140, marginBottom: 8 },
  avatarRing: { borderRadius: 70, overflow: "hidden" },
  preview: { width: 136, height: 136, borderRadius: 68 },
  overlay: {
    ...StyleSheet.absoluteFill,
    margin: 2,
    borderRadius: 70,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0, 0, 0, 0.44)",
  },
  field: { gap: 10 },
  selector: {
    height: 44,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    justifyContent: "center",
  },
  selectorText: { color: colors.fg, fontSize: 16, lineHeight: 20 },
  selectorPlaceholder: { color: "#9692a6", fontSize: 16, lineHeight: 20 },
  input: {
    height: 44,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.fg,
    fontSize: 16,
    lineHeight: 22,
  },
  textarea: { height: 110, paddingTop: 10, textAlignVertical: "top" },
  error: { color: "#ff9494", fontSize: 14, lineHeight: 20 },
  save: {
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
  },
  saveDisabled: { opacity: 0.55 },
  saveText: { color: colors.fg, fontSize: 16, fontWeight: "600" },
  policy: { alignSelf: "center", marginTop: -8, padding: 4 },
  policyText: { color: colors.muted, fontSize: 14, textDecorationLine: "underline" },
});
