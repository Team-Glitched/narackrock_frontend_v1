import { useState } from "react";
import { Image, ScrollView, StyleSheet, Text, View } from "react-native";

import {
  SONG_TITLE_MAX_LENGTH,
  clampCodePoints,
  codePointLength,
  hasVisibleText,
} from "../../../src/lib/content-limits";
import type { NativeAbyssMetadata } from "../../../src/lib/native-screens";
import { Cover } from "../../ui/cards";
import { Button, TextField, Touchable } from "../../ui/kit";
import { KeyboardAvoiding } from "../../ui/keyboard-avoiding";
import { useScreen } from "../../ui/screen-context";
import { colors, type } from "../../ui/theme";

/** 112px (the web's `size-28`) previews of the current and the applied cover. */
const PREVIEW = 112;

/**
 * The web's ProjectMetadataEditor (src/features/composition/project-metadata-editor.tsx): the song's title and
 * an optional new cover through the same album field as the studio (ImageCropInput: picker, crop dialog,
 * "크기·위치 조절"). The crop dialog itself is drawn over the screen (AlbumCropDialog).
 */
export function MetadataEditor({ metadata }: { metadata: NativeAbyssMetadata }) {
  const { act } = useScreen();
  const [title, setTitle] = useState(metadata.title);
  const { busy, album } = metadata;
  const save = () => {
    if (!busy && hasVisibleText(title)) act({ type: "abyss-metadata-save", title });
  };
  return (
    // The title field focuses on open; the keyboard must not cover 취소/저장 and the error.
    <KeyboardAvoiding style={styles.flex}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.form}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={type.title} accessibilityRole="header">
          곡 정보 수정
        </Text>
        <View style={styles.field}>
          <Text style={type.body}>곡 제목</Text>
          <TextField
            autoFocus
            accessibilityLabel="곡 제목"
            value={title}
            editable={!busy}
            returnKeyType="done"
            onChangeText={(value) => setTitle(clampCodePoints(value, SONG_TITLE_MAX_LENGTH))}
            onSubmitEditing={save}
          />
          <Text style={[type.caption, styles.counter]}>
            {codePointLength(title)}/{SONG_TITLE_MAX_LENGTH}자
          </Text>
        </View>
        {!album.url && metadata.albumImageUrl && (
          <View style={styles.center} accessible accessibilityLabel="앨범 이미지 미리보기">
            <Cover url={metadata.albumImageUrl} size={PREVIEW} radius={8} />
          </View>
        )}
        <View style={styles.album}>
          {album.url && (
            <Image
              source={{ uri: album.url }}
              style={styles.preview}
              accessibilityLabel="선택한 앨범 이미지"
            />
          )}
          <View style={styles.field}>
            <Text style={type.body}>앨범 이미지 (선택)</Text>
            <Button
              label={album.url ? "다른 이미지 선택" : "이미지 선택"}
              tone="secondary"
              disabled={busy}
              onPress={() => act({ type: "abyss-metadata-image" })}
            />
          </View>
          {album.canEdit && (
            <Touchable
              accessibilityRole="button"
              accessibilityState={{ disabled: busy }}
              disabled={busy}
              style={[styles.center, busy && styles.disabled]}
              onPress={() => act({ type: "album-edit" })}
            >
              <Text style={[type.muted, styles.underline]}>크기·위치 조절</Text>
            </Touchable>
          )}
          {album.error && (
            <Text accessibilityRole="alert" style={[type.body, styles.imageError]}>
              {album.error}
            </Text>
          )}
        </View>
        <Text style={type.caption}>새 이미지를 선택하지 않으면 현재 표지를 유지합니다.</Text>
        {metadata.error && (
          <Text accessibilityRole="alert" style={[type.caption, styles.error]}>
            {metadata.error}
          </Text>
        )}
        <View style={styles.buttons}>
          <Button
            label="취소"
            tone="secondary"
            disabled={busy}
            onPress={() => act({ type: "abyss-metadata-close" })}
          />
          <Button
            label={busy ? "저장 중..." : "저장"}
            disabled={busy || !hasVisibleText(title)}
            onPress={save}
          />
        </View>
      </ScrollView>
    </KeyboardAvoiding>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  form: { gap: 16, padding: 16 },
  field: { gap: 8 },
  counter: { textAlign: "right", fontVariant: ["tabular-nums"] },
  center: { alignSelf: "center" },
  /** The web's ImageCropInput: `flex-col gap-3`. */
  album: { gap: 12 },
  preview: {
    alignSelf: "center",
    width: PREVIEW,
    height: PREVIEW,
    borderRadius: 8,
    backgroundColor: colors.surface,
  },
  underline: { textDecorationLine: "underline" },
  disabled: { opacity: 0.5 },
  imageError: { color: "#fca5a5" },
  error: { color: colors.fg },
  buttons: { flexDirection: "row", justifyContent: "flex-end", gap: 8 },
});
