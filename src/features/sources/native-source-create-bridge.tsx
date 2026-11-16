import { useEffect, useId, useState } from "react";
import { CanvasDialog } from "@/components/canvas-dialog";
import { useLoginPrompt } from "@/features/auth/login-prompt";
import {
  SocialCreateForm,
  useSocialCreate,
  type SocialCreateProps,
  type SocialCreateState,
} from "@/features/community/create-content";
import { useNativeScreen } from "@/features/navigation/use-native-screen";
import { Header } from "@/features/navigation/header";
import { pickNativeImage } from "@/lib/native-app";
import type { NativeSourceCreate } from "@/lib/native-screens";
import { buttonVariants } from "@/styles/variants";
import { ThumbnailCropper } from "./thumbnail-cropper";

type Navigation = { onBack: () => void; onSearch: () => void };
const header = { left: "back", actions: ["notifications", "search", "account"] } as const;

/** Browser-owned source form, draft and publication; only the details surface is native. */
export function NativeSourceCreateContent({
  onBack,
  onSearch,
  ...props
}: SocialCreateProps & Navigation) {
  const form = useSocialCreate(props);
  return <NativeSourceCreateBridge form={form} onBack={onBack} onSearch={onSearch} />;
}

export function NativeSignedOutSourceCreateBridge(nav: Navigation) {
  const { requestLogin } = useLoginPrompt();
  return useNativeScreen(
    "source-create",
    { state: "signed-out" },
    {
      header: { ...header, actions: [...header.actions] },
      ...nav,
      onAction: (action) => {
        if (action.type === "sign-in") requestLogin();
      },
    },
  );
}

/** Downscale only the bridge preview; publishing still uses the original file and crop. */
async function imagePreview(file: File) {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, 600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("앨범 이미지를 미리 볼 수 없습니다.");
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return {
      status: "ready" as const,
      uri: canvas.toDataURL("image/jpeg", 0.8),
      width: bitmap.width,
      height: bitmap.height,
    };
  } finally {
    bitmap.close();
  }
}

type Preview = NonNullable<Extract<NativeSourceCreate, { state: "form" }>["image"]>;
function NativeSourceCreateBridge({
  form,
  onBack,
  onSearch,
}: { form: SocialCreateState } & Navigation) {
  const [cropOpen, setCropOpen] = useState(false);
  const [pickError, setPickError] = useState<string | null>(null);
  const file = form.image?.file ?? null;
  const [preview, setPreview] = useState<{ file: File; image: Preview } | null>(null);
  const cropTitle = useId();
  const audioTitle = useId();
  useEffect(() => {
    if (!file) return;
    let active = true;
    void imagePreview(file).then(
      (image) => {
        if (active) setPreview({ file, image });
      },
      () => {
        if (active) setPreview({ file, image: { status: "failed" } });
      },
    );
    return () => {
      active = false;
    };
  }, [file]);
  const model: NativeSourceCreate = form.restoring
    ? { state: "restoring" }
    : form.draftExpired && !form.busy
      ? { state: "expired" }
      : {
          state: "form",
          title: form.title,
          description: form.content,
          audio: form.sourceAudioLocked ? "locked" : form.audio ? "selected" : "none",
          image: !file ? null : preview?.file === file ? preview.image : { status: "loading" },
          crop: form.imageCrop,
          visibility: form.sourceVisibility,
          busy: form.busy,
          error: pickError ?? form.error,
          storageError: form.storageError || null,
          restoreError: form.restoreError || null,
          imageRestoreFailed: form.imageRestoreFailed,
          draftStatus: form.draftStatus,
          canSubmit: form.canSubmit,
          submitLabel: form.submitLabel,
        };
  const node = useNativeScreen("source-create", model, {
    header: { ...header, actions: [...header.actions] },
    onBack,
    onSearch,
    onAction: (action) => {
      if (form.busy || form.restoring || form.draftExpired) return;
      switch (action.type) {
        case "source-create-title":
          return form.setTitle(action.value);
        case "source-create-description":
          return form.setContent(action.value);
        case "source-create-audio":
          if (!form.sourceAudioLocked) form.setAudioStage("choose");
          return;
        case "source-create-image":
          setPickError(null);
          void pickNativeImage().then(
            (picked) => {
              if (picked) {
                form.pickImage(picked);
                setCropOpen(true);
              }
            },
            (cause: unknown) =>
              setPickError(
                cause instanceof Error ? cause.message : "이미지를 추가하지 못했습니다.",
              ),
          );
          return;
        case "source-create-edit-image":
          return setCropOpen(true);
        case "source-create-remove-image":
          setCropOpen(false);
          return form.removeImage();
        case "source-create-visibility":
          return form.setSourceVisibility(action.visibility);
        case "source-create-keep-without-image":
          return form.keepWithoutImage();
        case "source-create-submit":
          setPickError(null);
          return void form.submit();
        case "source-create-discard":
          return form.setConfirmDiscard(true);
      }
    },
  });
  const audioOpen =
    form.audioStage !== "details" &&
    !form.sourceAudioLocked &&
    !form.restoring &&
    !form.draftExpired;
  return (
    <>
      {node}
      {audioOpen ? (
        <CanvasDialog
          className="flex h-full w-full flex-col overflow-auto bg-app-panel"
          titleId={audioTitle}
          onClose={() => form.setAudioStage(form.audioStage === "choose" ? "details" : "choose")}
        >
          <h2 id={audioTitle} className="sr-only">
            오디오 추가
          </h2>
          {form.audioStage !== "note" && (
            <Header
              onBack={() => form.setAudioStage(form.audioStage === "choose" ? "details" : "choose")}
              onSearch={onSearch}
            />
          )}
          <SocialCreateForm form={form} />
        </CanvasDialog>
      ) : (
        <SocialCreateForm form={form} />
      )}
      {cropOpen && form.image && (
        <CanvasDialog
          className="flex max-h-[90%] w-full max-w-[390px] flex-col gap-4 overflow-auto rounded-2xl bg-app-panel p-5"
          titleId={cropTitle}
          onClose={() => setCropOpen(false)}
        >
          <h2 id={cropTitle}>앨범</h2>
          <ThumbnailCropper
            file={form.image.file}
            crop={form.imageCrop}
            onChange={form.setImageCrop}
            disabled={form.busy}
          />
          <button
            type="button"
            className={buttonVariants({ tone: "primary" })}
            onClick={() => setCropOpen(false)}
          >
            완료
          </button>
        </CanvasDialog>
      )}
    </>
  );
}
