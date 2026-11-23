import { useState } from "react";
import { Image, StyleSheet, Text, TextInput, View } from "react-native";

import {
  SONG_TITLE_MAX_LENGTH,
  clampCodePoints,
  codePointLength,
  hasVisibleText,
  sanitizeSingleLine,
} from "../../../src/lib/content-limits";
import { Button, Touchable } from "../../ui/kit";
import { ScreenScroll } from "../../ui/screen";
import { useScreen } from "../../ui/screen-context";
import { colors, gutter } from "../../ui/theme";
import { CreationChoiceList } from "../creation/choose";
import type { ScreenProps } from "../types";
import { InstrumentSheet } from "./parts";

/** /studio/new (the web's NewProject form). */
export function StudioNewScreen({ model }: ScreenProps<"studio-new">) {
  const { act } = useScreen();
  const [title, setTitle] = useState(model.suggestion);
  // A new suggestion ("다른 제목") replaces the title and is selected again on focus.
  const [suggestionCount, setSuggestionCount] = useState(model.suggestionCount);
  const [selectOnFocus, setSelectOnFocus] = useState(true);
  if (suggestionCount !== model.suggestionCount) {
    setSuggestionCount(model.suggestionCount);
    setTitle(model.suggestion);
    setSelectOnFocus(true);
  }
  const start = () => {
    const cleanTitle = sanitizeSingleLine(title);
    if (!model.busy && cleanTitle && hasVisibleText(cleanTitle)) {
      act({ type: "studio-new-start", title: cleanTitle });
    }
  };
  return (
    <ScreenScroll>
      <View style={styles.form}>
        <View style={styles.field}>
          <View style={styles.titleRow}>
            <Text style={styles.label}>음악명</Text>
            <Touchable
              accessibilityRole="button"
              accessibilityState={{ disabled: model.busy }}
              disabled={model.busy}
              style={[styles.suggest, model.busy && styles.disabled]}
              onPress={() => act({ type: "studio-new-suggest" })}
            >
              <Text style={styles.suggestText}>다른 제목</Text>
            </Touchable>
          </View>
          <TextInput
            accessibilityLabel="음악명"
            value={title}
            onChangeText={(value) => setTitle(clampCodePoints(value, SONG_TITLE_MAX_LENGTH))}
            selectTextOnFocus={selectOnFocus}
            onFocus={() => setSelectOnFocus(false)}
            selectionColor={colors.accent}
            returnKeyType="done"
            onSubmitEditing={start}
            style={styles.input}
          />
          <Text style={styles.counter}>
            {codePointLength(title)}/{SONG_TITLE_MAX_LENGTH}자
          </Text>
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>앨범</Text>
          <Touchable
            accessibilityRole="button"
            accessibilityLabel="앨범 추가"
            accessibilityState={{ disabled: model.busy }}
            disabled={model.busy}
            style={styles.artwork}
            onPress={() => act({ type: "studio-new-image" })}
          >
            {model.imageUrl ? (
              <Image
                source={{ uri: model.imageUrl }}
                style={StyleSheet.absoluteFill}
                resizeMode="cover"
                accessibilityLabel="선택한 앨범"
              />
            ) : (
              <>
                <Text style={styles.artworkTitle}>앨범 추가</Text>
                <Text style={styles.artworkHint}>JPG, PNG, WEBP 최대 100MB</Text>
              </>
            )}
          </Touchable>
        </View>
        {model.error && (
          <Text accessibilityRole="alert" style={styles.error}>
            {model.error}
          </Text>
        )}
        <View style={styles.actions}>
          <Button
            label={model.busy ? "만드는 중…" : "입력 완료"}
            disabled={model.busy || !hasVisibleText(title)}
            style={styles.submit}
            onPress={start}
          />
          {model.canResume && (
            <Touchable
              accessibilityRole="button"
              accessibilityState={{ disabled: model.busy }}
              disabled={model.busy}
              onPress={() => act({ type: "studio-new-resume" })}
            >
              <Text style={styles.resume}>이전 작업 이어하기</Text>
            </Touchable>
          )}
        </View>
      </View>
    </ScreenScroll>
  );
}

/** /studio/:projectId/layers/new: upload, record or piano roll; the piano roll asks for an instrument. */
export function StudioLayerChoiceScreen({ model }: ScreenProps<"studio-layer-choice">) {
  const { act } = useScreen();
  return (
    <View style={styles.flex}>
      <ScreenScroll>
        {model.invalid ? (
          <Text accessibilityRole="alert" style={styles.invalid}>
            올바르지 않은 페이지 주소입니다.
          </Text>
        ) : (
          <CreationChoiceList
            busy={model.busy}
            error={model.error}
            onChoose={(method) => act({ type: "studio-layer-choose", method })}
          />
        )}
      </ScreenScroll>
      <InstrumentSheet picker={model.instrument} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  disabled: { opacity: 0.5 },
  form: { gap: 30, paddingTop: 22, paddingHorizontal: gutter },
  field: { gap: 10 },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  label: { color: colors.fg, fontSize: 16, lineHeight: 22, fontWeight: "700" },
  suggest: { minHeight: 36, borderRadius: 8, paddingHorizontal: 10, justifyContent: "center" },
  suggestText: { color: colors.muted, fontSize: 14, fontWeight: "500" },
  input: {
    height: 44,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.fg,
    fontSize: 16,
  },
  artwork: {
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    overflow: "hidden",
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.muted,
    backgroundColor: colors.surface,
  },
  artworkTitle: { color: colors.fg, fontSize: 16, fontWeight: "500" },
  artworkHint: { color: colors.muted, fontSize: 14 },
  counter: { color: colors.muted, fontSize: 12, textAlign: "right" },
  error: { color: "#ff9494", fontSize: 14, lineHeight: 20 },
  actions: { alignItems: "center", gap: 10 },
  submit: { alignSelf: "stretch" },
  resume: { color: colors.muted, fontSize: 14, textDecorationLine: "underline" },
  link: { color: colors.fg, fontSize: 14, textDecorationLine: "underline", textAlign: "center" },
  invalid: { padding: 32, textAlign: "center", color: colors.error, fontSize: 14 },
});
