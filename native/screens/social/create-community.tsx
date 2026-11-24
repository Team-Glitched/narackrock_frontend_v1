import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import {
  COMMUNITY_DESCRIPTION_MAX_LENGTH,
  COMMUNITY_NAME_MAX_LENGTH,
  clampCodePoints,
  codePointLength,
} from "../../../src/lib/content-limits";
import type { NativeCreateCommunity } from "../../../src/lib/native-screens";
import { AppHeader } from "../../ui/header";
import { Button, Status, TextField, Touchable } from "../../ui/kit";
import { ScreenScroll } from "../../ui/screen";
import { useScreen } from "../../ui/screen-context";
import { colors, gutter, type } from "../../ui/theme";
import type { ScreenProps } from "../types";
import { SignInRequired } from "./friends";

type SignedInModel = Extract<NativeCreateCommunity, { signedIn: true }>;

/** /communities/new: the user's proposals and the "커뮤니티 생성" form (the web's SocialCreate). */
export function CreateCommunityScreen({ model, header }: ScreenProps<"social-create-community">) {
  return (
    <>
      {header && <AppHeader header={header} />}
      <ScreenScroll>
        {!model.signedIn ? (
          <SignInRequired message={model.message} />
        ) : (
          <>
            {model.proposals && <Proposals proposals={model.proposals} />}
            {model.blocked ? (
              <Status>{model.blocked}</Status>
            ) : (
              <ProposalForm key={model.formKey} model={model} />
            )}
          </>
        )}
      </ScreenScroll>
    </>
  );
}

function Proposals({ proposals }: { proposals: NonNullable<SignedInModel["proposals"]> }) {
  return (
    <View style={styles.proposals} accessibilityLabel="내 커뮤니티 개설 신청">
      {proposals.submitted && (
        <Text style={styles.note}>
          개설 신청이 접수되었습니다. 운영자 어드민 승인 후 커뮤니티가 만들어집니다.
        </Text>
      )}
      {proposals.failed && (
        <Text style={[styles.note, styles.alert]} accessibilityRole="alert">
          내 개설 신청을 불러오지 못했습니다.
        </Text>
      )}
      {proposals.items.map((item, index) => (
        <Text key={index} style={styles.note}>
          • {item}
        </Text>
      ))}
    </View>
  );
}

/** The fields keep their text natively (from the restored draft) and report every change to the page. */
function ProposalForm({ model }: { model: SignedInModel }) {
  const { act } = useScreen();
  const [title, setTitle] = useState(model.title);
  const [content, setContent] = useState(model.content);
  return (
    <View style={styles.form} accessibilityLabel="커뮤니티 생성">
      <View style={styles.field}>
        <Text style={styles.label}>커뮤니티 이름</Text>
        <TextField
          accessibilityLabel="커뮤니티 이름"
          editable={!model.busy}
          value={title}
          onChangeText={(value) => {
            const clamped = clampCodePoints(value, COMMUNITY_NAME_MAX_LENGTH);
            setTitle(clamped);
            act({ type: "title", value: clamped });
          }}
        />
        <Text style={[type.caption, { textAlign: "right" }]}>
          {codePointLength(title)}/{COMMUNITY_NAME_MAX_LENGTH}자
        </Text>
      </View>
      <View style={styles.field}>
        <Text style={styles.label}>설명</Text>
        <TextField
          accessibilityLabel="설명"
          multiline
          editable={!model.busy}
          value={content}
          onChangeText={(value) => {
            const clamped = clampCodePoints(value, COMMUNITY_DESCRIPTION_MAX_LENGTH);
            setContent(clamped);
            act({ type: "content", value: clamped });
          }}
        />
        <Text style={[type.caption, { textAlign: "right" }]}>
          {codePointLength(content)}/{COMMUNITY_DESCRIPTION_MAX_LENGTH}자
        </Text>
      </View>
      <Text style={styles.note}>
        커뮤니티 프로필 사진은 현재 서버에서 지원하지 않습니다. 이름과 설명으로 개설을 신청하면
        운영자 어드민 승인 후 커뮤니티가 만들어집니다.
      </Text>
      <Text style={styles.note} accessibilityLiveRegion="polite">
        {model.draftStatus}
      </Text>
      {model.errors.map((message) => (
        <Text key={message} style={[styles.note, styles.alert]} accessibilityRole="alert">
          {message}
        </Text>
      ))}
      {model.keepWithoutImage && (
        <Touchable accessibilityRole="button" onPress={() => act({ type: "keep-without-image" })}>
          <Text style={styles.link}>앨범 이미지 없이 등록</Text>
        </Touchable>
      )}
      <Button
        label={model.submitLabel}
        disabled={!model.canSubmit}
        style={styles.submit}
        onPress={() => act({ type: "submit" })}
      />
      <Touchable
        accessibilityRole="button"
        accessibilityState={{ disabled: model.busy }}
        disabled={model.busy}
        style={styles.discard}
        onPress={() => act({ type: "discard" })}
      >
        <Text style={[type.muted, model.busy && { opacity: 0.4 }]}>작성 취소</Text>
      </Touchable>
    </View>
  );
}

const styles = StyleSheet.create({
  proposals: { paddingHorizontal: gutter, paddingTop: 12, gap: 4 },
  form: { paddingHorizontal: gutter, paddingTop: 20, paddingBottom: 40, gap: 20 },
  field: { gap: 10 },
  label: { color: colors.fg, fontSize: 20, lineHeight: 26, fontWeight: "700" },
  note: { color: colors.muted, fontSize: 14, lineHeight: 18, textAlign: "center" },
  alert: { color: colors.error },
  link: { color: colors.muted, fontSize: 14, lineHeight: 20, textDecorationLine: "underline" },
  submit: { borderRadius: 37 },
  discard: { alignSelf: "center", paddingVertical: 8, paddingHorizontal: 16 },
});
