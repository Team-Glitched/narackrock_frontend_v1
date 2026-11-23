import { useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import Svg, { Path } from "react-native-svg";

import CloseIcon from "../../../public/figma/search-close.svg";
import type { NativePostCreate } from "../../../src/lib/native-screens";
import { AppHeader } from "../../ui/header";
import { Avatar, Button, Status, Touchable } from "../../ui/kit";
import { useScreen } from "../../ui/screen-context";
import { ScreenModal } from "../../ui/screen-modal";
import { SearchPill } from "../../ui/search-pill";
import { colors, gutter, type } from "../../ui/theme";
import type { ScreenProps } from "../types";

/**
 * The web create post page (src/features/posts/pages/create-post-page.tsx): its Header with the
 * community picker in place of the avatar, and the SocialCreate post form.
 */
export function PostCreateScreen({ model }: ScreenProps<"post-create">) {
  const { session } = useScreen();
  const signedIn = session.userId !== null;
  return (
    <>
      <View style={styles.headerRow}>
        <View style={styles.flex}>
          <AppHeader
            header={{
              left: "back",
              actions: [],
            }}
          />
        </View>
        {signedIn && <CommunityPicker communities={model.communities} />}
      </View>
      {model.restoring ? (
        <Text style={styles.restoring} accessibilityLiveRegion="polite">
          작성 중인 내용을 불러오는 중...
        </Text>
      ) : model.blocked ? (
        <Text style={styles.restoring} accessibilityLiveRegion="polite">
          {model.blocked}
        </Text>
      ) : (
        <PostForm model={model} />
      )}
    </>
  );
}

function PostForm({ model }: { model: NativePostCreate }) {
  const { act } = useScreen();
  // Typing stays here; every change goes to the page, which keeps the draft.
  const [title, setTitle] = useState(model.title);
  const [content, setContent] = useState(model.content);
  return (
    <ScrollView
      contentContainerStyle={styles.form}
      keyboardShouldPersistTaps="handled"
      accessibilityLabel="게시글 작성"
    >
      <View style={styles.fields}>
        <View style={styles.field}>
          <Text style={type.title}>제목</Text>
          <TextInput
            accessibilityLabel="게시글 제목"
            editable={!model.busy}
            value={title}
            maxLength={100}
            onChangeText={(value) => {
              setTitle(value);
              act({ type: "post-create-title", value });
            }}
            placeholderTextColor="#9692a6"
            selectionColor={colors.accent}
            style={styles.input}
          />
        </View>
        <View style={styles.field}>
          <Text style={type.title}>본문</Text>
          <TextInput
            accessibilityLabel="게시글 내용"
            editable={!model.busy}
            multiline
            value={content}
            onChangeText={(value) => {
              setContent(value);
              act({ type: "post-create-content", value });
            }}
            placeholderTextColor="#9692a6"
            selectionColor={colors.accent}
            style={[styles.input, styles.textarea]}
          />
        </View>
        <View style={styles.field}>
          <Text style={type.title}>사진</Text>
          <Touchable
            accessibilityRole="button"
            accessibilityLabel="사진 추가"
            accessibilityState={{ disabled: model.busy }}
            disabled={model.busy}
            style={styles.picker}
            onPress={() => act({ type: "post-create-image" })}
          >
            {model.image ? (
              model.image.preview ? (
                <Image
                  source={{ uri: model.image.preview }}
                  style={StyleSheet.absoluteFill}
                  resizeMode="cover"
                  accessibilityLabel="첨부 이미지 미리보기"
                />
              ) : null
            ) : (
              <View style={styles.pickerCopy}>
                <Text style={styles.pickerTitle}>사진 추가</Text>
                <Text style={type.caption}>JPG, PNG, WEBP 최대 100MB</Text>
              </View>
            )}
          </Touchable>
          {model.image && (
            <Touchable
              accessibilityRole="button"
              disabled={model.busy}
              style={styles.removeImage}
              onPress={() => act({ type: "post-create-remove-image" })}
            >
              <Text style={styles.mutedButtonText}>첨부 사진 삭제</Text>
            </Touchable>
          )}
        </View>
      </View>
      <Text style={styles.saveStatus} accessibilityLiveRegion="polite">
        {model.draftStatus}
      </Text>
      {model.targetNotice && (
        <Text
          style={styles.targetNotice}
          accessibilityRole={model.targetNotice.tone === "alert" ? "alert" : undefined}
        >
          {model.targetNotice.text}
        </Text>
      )}
      {model.error && <Alert text={model.error} />}
      {model.storageError && <Alert text={model.storageError} />}
      {model.restoreError && <Alert text={model.restoreError} />}
      {model.keepWithoutImage && (
        <Button
          label="앨범 이미지 없이 등록"
          tone="secondary"
          disabled={model.busy}
          onPress={() => act({ type: "post-create-keep-without-image" })}
        />
      )}
      <Touchable
        accessibilityRole="button"
        accessibilityState={{ disabled: !model.canSubmit, busy: model.busy }}
        disabled={!model.canSubmit}
        style={[styles.submit, !model.canSubmit && styles.disabled]}
        onPress={() => act({ type: "post-create-submit" })}
      >
        <Text style={styles.submitText}>{model.submitLabel}</Text>
      </Touchable>
      <Touchable
        accessibilityRole="button"
        accessibilityState={{ disabled: model.busy }}
        disabled={model.busy}
        style={styles.discard}
        onPress={() => act({ type: "post-create-discard" })}
      >
        <Text style={styles.mutedButtonText}>작성 취소</Text>
      </Touchable>
    </ScrollView>
  );
}

function Alert({ text }: { text: string }) {
  return (
    <Text accessibilityRole="alert" style={styles.alert}>
      {text}
    </Text>
  );
}

/** The header's community picker (the web's PostCommunityPicker) and its selection sheet. */
function CommunityPicker({ communities }: { communities: NativePostCreate["communities"] }) {
  const { act, uri } = useScreen();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const keyword = query.trim().toLocaleLowerCase();
  const matches = communities.items.filter((item) =>
    `${item.name} ${item.description}`.toLocaleLowerCase().includes(keyword),
  );
  const close = () => setOpen(false);
  return (
    <>
      <Touchable
        accessibilityRole="button"
        accessibilityLabel={`게시할 커뮤니티 선택${communities.selectedName ? `: ${communities.selectedName}` : ""}`}
        accessibilityState={{ expanded: open }}
        style={styles.pickerButton}
        onPress={() => {
          setQuery("");
          setOpen(true);
        }}
      >
        <Text style={styles.pickerName} numberOfLines={1}>
          {communities.selectedName ?? "커뮤니티 선택"}
        </Text>
        <Svg
          width={16}
          height={16}
          viewBox="0 0 24 24"
          fill="none"
          stroke={colors.fg}
          strokeWidth={1.5}
        >
          <Path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      </Touchable>
      <ScreenModal
        visible={open}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={close}
      >
        <View style={styles.sheetRoot}>
          <Pressable
            style={styles.backdrop}
            accessibilityRole="button"
            accessibilityLabel="닫기"
            onPress={close}
          />
          <View style={styles.sheet} accessibilityLabel="게시할 커뮤니티 선택">
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle} accessibilityRole="header">
                게시할 커뮤니티
              </Text>
              <Touchable
                accessibilityRole="button"
                accessibilityLabel="커뮤니티 선택 닫기"
                style={styles.sheetClose}
                onPress={close}
              >
                <CloseIcon width={16} height={16} />
              </Touchable>
            </View>
            <Text style={styles.sheetText}>게시글을 올릴 커뮤니티를 선택하세요.</Text>
            <SearchPill
              value={query}
              onChangeText={setQuery}
              onClear={() => setQuery("")}
              clearLabel="커뮤니티 검색어 지우기"
              placeholder="커뮤니티 검색"
              accessibilityLabel="게시할 커뮤니티 검색"
            />
            <ScrollView style={styles.sheetList} keyboardShouldPersistTaps="handled">
              {communities.status === "loading" && <Status>커뮤니티를 불러오는 중...</Status>}
              {communities.status === "error" && (
                <View style={styles.sheetError} accessibilityRole="alert">
                  <Text style={styles.sheetText}>커뮤니티를 불러오지 못했습니다.</Text>
                  <Button
                    label="다시 시도"
                    tone="secondary"
                    onPress={() => act({ type: "post-create-communities-retry" })}
                  />
                </View>
              )}
              {communities.status === "ready" && (
                <View style={styles.rows} accessibilityLabel="게시할 커뮤니티 목록">
                  {matches.map((item) => {
                    const selected = item.galleryId === communities.selectedId;
                    return (
                      <Touchable
                        key={item.galleryId}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                        style={[styles.row, selected && styles.rowSelected]}
                        onPress={() => {
                          act({ type: "post-create-community", galleryId: item.galleryId });
                          close();
                        }}
                      >
                        <Avatar uri={uri(item.imageUrl)} size={40} />
                        <View style={styles.rowCopy}>
                          <Text style={styles.rowName}>{item.name}</Text>
                          <Text style={type.caption}>{item.memberLabel}</Text>
                        </View>
                        {selected && <Text style={styles.selected}>선택됨</Text>}
                      </Touchable>
                    );
                  })}
                </View>
              )}
              {communities.status === "ready" && matches.length === 0 && (
                <Text style={styles.sheetText}>
                  {keyword ? "검색 결과가 없습니다." : "게시할 수 있는 커뮤니티가 없습니다."}
                </Text>
              )}
            </ScrollView>
          </View>
        </View>
      </ScreenModal>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  disabled: { opacity: 0.4 },
  headerRow: { flexDirection: "row", alignItems: "center" },
  restoring: {
    paddingVertical: 30,
    paddingHorizontal: gutter,
    color: colors.muted,
    fontSize: 14,
    lineHeight: 22,
  },
  form: {
    alignItems: "center",
    gap: 20,
    paddingTop: 20,
    paddingHorizontal: gutter,
    paddingBottom: 40,
  },
  fields: { width: "100%", maxWidth: 350, gap: 24 },
  field: { gap: 10 },
  input: {
    minHeight: 44,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.fg,
    fontSize: 16,
    lineHeight: 22,
  },
  textarea: { textAlignVertical: "top" },
  picker: {
    height: 224,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderRadius: 4,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.muted,
    backgroundColor: colors.surface,
  },
  pickerCopy: { alignItems: "center", gap: 6 },
  pickerTitle: { color: colors.fg, fontSize: 16, lineHeight: 22, fontWeight: "700" },
  removeImage: {
    alignSelf: "flex-end",
    minHeight: 32,
    paddingVertical: 4,
    justifyContent: "center",
  },
  mutedButtonText: { color: colors.muted, fontSize: 14, lineHeight: 20, fontWeight: "500" },
  saveStatus: { color: colors.muted, fontSize: 14, lineHeight: 18, textAlign: "center" },
  targetNotice: { marginVertical: 12, color: colors.muted, fontSize: 14, lineHeight: 18 },
  alert: { color: colors.error, fontSize: 14, lineHeight: 18, textAlign: "center" },
  submit: {
    height: 44,
    paddingHorizontal: 64,
    borderRadius: 37,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
  },
  submitText: { color: colors.fg, fontSize: 16, lineHeight: 20, fontWeight: "500" },
  discard: { minHeight: 40, paddingVertical: 8, paddingHorizontal: 20, justifyContent: "center" },
  pickerButton: {
    maxWidth: 168,
    height: 40,
    marginRight: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: colors.surface,
  },
  pickerName: { flexShrink: 1, color: colors.fg, fontSize: 16, lineHeight: 20, fontWeight: "600" },
  sheetRoot: { flex: 1, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(0, 0, 0, 0.6)" },
  sheet: {
    maxHeight: "85%",
    paddingTop: 12,
    paddingHorizontal: gutter,
    paddingBottom: 24,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    backgroundColor: colors.bg,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
  },
  sheetTitle: { color: colors.fg, fontSize: 16, lineHeight: 22, fontWeight: "700" },
  sheetClose: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  sheetText: { marginTop: 12, marginBottom: 24, color: colors.muted, fontSize: 14, lineHeight: 21 },
  sheetList: { marginTop: 20 },
  sheetError: { paddingTop: 20 },
  rows: { gap: 8 },
  row: {
    minHeight: 70,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 12,
  },
  rowSelected: { backgroundColor: colors.surface },
  rowCopy: { flex: 1, gap: 8 },
  rowName: { color: colors.fg, fontSize: 16, lineHeight: 20, fontWeight: "600" },
  selected: { color: colors["primary-soft"], fontSize: 14, lineHeight: 18, fontWeight: "500" },
});
