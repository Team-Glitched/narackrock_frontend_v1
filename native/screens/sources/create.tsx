import { useState } from "react";
import { Image, Text, TextInput, View } from "react-native";
import type { NativeSourceCreate } from "../../../src/lib/native-screens";
import { AppHeader } from "../../ui/header";
import { Button, Status, Touchable } from "../../ui/kit";
import { ScreenScroll } from "../../ui/screen";
import { useScreen } from "../../ui/screen-context";
import { type } from "../../ui/theme";
import { Notice, Pill } from "../workspace/parts";
import type { ScreenProps } from "../types";
import { SourceLogin, styles } from "./parts";

export function SourceCreateScreen({ model, header }: ScreenProps<"source-create">) {
  return (
    <>
      {header && <AppHeader header={header} />}
      {model.state === "signed-out" ? (
        <SourceLogin>샘플 등록은 로그인 후 사용할 수 있습니다.</SourceLogin>
      ) : model.state === "restoring" ? (
        <Status>작성 중인 내용을 불러오는 중...</Status>
      ) : model.state === "expired" ? (
        <Status>다른 탭에서 이 초안을 등록하거나 삭제했습니다. 작성 화면을 다시 열어주세요.</Status>
      ) : model.state === "form" ? (
        <CreateForm model={model} />
      ) : null}
    </>
  );
}

function CreateForm({ model }: { model: Extract<NativeSourceCreate, { state: "form" }> }) {
  const { act, uri } = useScreen();
  const [title, setTitle] = useState(model.title);
  const [description, setDescription] = useState(model.description);
  const image = model.image?.status === "ready" ? model.image : null;
  const previewSize = 260;
  const scale = image ? (previewSize * model.crop.zoom) / Math.min(image.width, image.height) : 1;
  return (
    <ScreenScroll>
      <View style={styles.column}>
        <View style={styles.field}>
          <Text style={type.title}>샘플 이름</Text>
          <TextInput
            accessibilityLabel="샘플 이름"
            editable={!model.busy}
            value={title}
            style={styles.input}
            onChangeText={(value) => {
              setTitle(value);
              act({ type: "source-create-title", value });
            }}
          />
        </View>
        <View style={styles.field}>
          <Text style={type.title}>설명</Text>
          <TextInput
            accessibilityLabel="설명"
            editable={!model.busy}
            value={description}
            multiline
            style={[styles.input, { minHeight: 80, textAlignVertical: "top" }]}
            onChangeText={(value) => {
              setDescription(value);
              act({ type: "source-create-description", value });
            }}
          />
        </View>
        <View style={styles.field}>
          <Text style={type.title}>오디오</Text>
          <Button
            tone="secondary"
            label={
              model.audio === "locked"
                ? "업로드한 오디오 사용"
                : model.audio === "selected"
                  ? "오디오 선택됨 · 다시 선택"
                  : "오디오 추가"
            }
            disabled={model.busy || model.audio === "locked"}
            onPress={() => act({ type: "source-create-audio" })}
          />
          {model.audio === "locked" && (
            <Text style={type.caption}>
              등록 재시도에는 이미 업로드한 오디오를 사용합니다. 다른 오디오를 등록하려면 작성 취소
              후 새로 작성해주세요.
            </Text>
          )}
        </View>
        <View style={styles.field}>
          <Text style={type.title}>앨범</Text>
          {model.image ? (
            <>
              {image && (
                <Touchable
                  accessibilityRole="button"
                  accessibilityLabel="앨범 이미지 편집"
                  disabled={model.busy}
                  style={{
                    width: previewSize,
                    height: previewSize,
                    borderRadius: previewSize / 2,
                    overflow: "hidden",
                    alignSelf: "center",
                  }}
                  onPress={() => act({ type: "source-create-edit-image" })}
                >
                  <Image
                    source={{ uri: uri(image.uri)! }}
                    style={{
                      position: "absolute",
                      width: image.width * scale,
                      height: image.height * scale,
                      left: previewSize / 2 - model.crop.x * image.width * scale,
                      top: previewSize / 2 - model.crop.y * image.height * scale,
                    }}
                    accessibilityLabel="앨범 이미지 미리보기"
                  />
                </Touchable>
              )}
              {model.image.status === "loading" && <Status>앨범 이미지를 불러오는 중...</Status>}
              {model.image.status === "failed" && (
                <Notice alert>
                  앨범 이미지를 미리 볼 수 없습니다. 다른 이미지를 선택해주세요.
                </Notice>
              )}
              <Pill
                label="앨범 이미지 편집"
                disabled={model.busy}
                onPress={() => act({ type: "source-create-edit-image" })}
              />
              <Pill
                label="다른 이미지 선택"
                disabled={model.busy}
                onPress={() => act({ type: "source-create-image" })}
              />
              <Pill
                label="앨범 이미지 삭제"
                disabled={model.busy}
                onPress={() => act({ type: "source-create-remove-image" })}
              />
            </>
          ) : (
            <>
              <Button
                tone="secondary"
                label="앨범 추가"
                disabled={model.busy}
                onPress={() => act({ type: "source-create-image" })}
              />
              <Text style={type.caption}>JPG, PNG, WEBP 최대 100MB</Text>
            </>
          )}
        </View>
        <View style={styles.field}>
          <Text style={type.title}>등록 공개 설정</Text>
          <View style={styles.row}>
            {(
              [
                ["PUBLIC", "공개 등록"],
                ["PRIVATE", "비공개 등록"],
              ] as const
            ).map(([visibility, label]) => (
              <Pill
                key={visibility}
                label={label}
                pressed={model.visibility === visibility}
                disabled={model.busy}
                onPress={() => act({ type: "source-create-visibility", visibility })}
              />
            ))}
          </View>
          <Text style={type.caption}>
            비공개 등록은 내 등록에서만 관리하며, 나중에 공개할 수 있습니다.
          </Text>
        </View>
        <Text accessibilityLiveRegion="polite" style={type.caption}>
          {model.draftStatus}
        </Text>
        {model.error && <Notice alert>{model.error}</Notice>}
        {model.storageError && <Notice alert>{model.storageError}</Notice>}
        {model.imageRestoreFailed ? (
          <>
            <Notice alert>
              앨범 이미지를 복원하지 못했습니다. 다시 첨부하거나 이미지 없이 등록을 선택해주세요.
            </Notice>
            <Pill
              label="앨범 이미지 없이 등록"
              disabled={model.busy}
              onPress={() => act({ type: "source-create-keep-without-image" })}
            />
          </>
        ) : (
          model.restoreError && <Notice alert>{model.restoreError}</Notice>
        )}
        <Button
          label={model.submitLabel}
          disabled={!model.canSubmit}
          onPress={() => act({ type: "source-create-submit" })}
        />
        <Button
          tone="secondary"
          label="작성 취소"
          disabled={model.busy}
          onPress={() => act({ type: "source-create-discard" })}
        />
      </View>
    </ScreenScroll>
  );
}
