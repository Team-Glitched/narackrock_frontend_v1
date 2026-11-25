import { useId, useRef, useState } from "react";
import { CanvasDialog } from "@/components/canvas-dialog";
import { buttonVariants } from "@/styles/variants";
import { ImageCropper } from "./image-cropper";
import { defaultCrop, renderThumbnail, type ThumbnailCrop } from "./image-crop";

export type ImageCropSelection = { file: File; crop: ThumbnailCrop };

/**
 * The crop editor's state without its dialog (shared by the web dialog and the app's native
 * editor). Keeps the original for re-editing; only `apply` replaces the form's selected upload file.
 */
export function useImageCropState({
  file,
  onApply,
  maxMB = 100,
}: {
  file: File | null;
  onApply: (file: File) => void;
  maxMB?: number;
}) {
  const [editing, setEditing] = useState<ImageCropSelection | null>(null);
  const [applied, setApplied] = useState<{ output: File; source: ImageCropSelection } | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const applying = useRef(false);
  const [error, setError] = useState<string | null>(null);

  function open(selection: ImageCropSelection) {
    setError(null);
    setEditing(selection);
  }

  const canEdit = Boolean(file && applied?.output === file);
  return {
    /** The open editor's original and framing; null while closed. */
    editing,
    busy,
    /** The selection or apply error (forms show it only while the editor is closed). */
    error,
    canEdit,
    select(source: File) {
      if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(source.type)) {
        setError("JPG, PNG, WEBP 또는 GIF 이미지를 선택해 주세요.");
        return;
      }
      if (source.size > maxMB * 1024 * 1024) {
        setError(`${maxMB}MB 이하의 이미지를 선택해 주세요.`);
        return;
      }
      open({ file: source, crop: defaultCrop() });
    },
    edit() {
      if (canEdit && applied) open(applied.source);
    },
    setCrop(crop: ThumbnailCrop) {
      setEditing((current) => current && { ...current, crop });
    },
    cancel() {
      if (!applying.current) setEditing(null);
    },
    /** Renders `selection` to the square upload file and hands it to `onApply`. */
    async apply(selection: ImageCropSelection) {
      if (applying.current) return;
      applying.current = true;
      setBusy(true);
      setError(null);
      try {
        const output = await renderThumbnail(selection.file, selection.crop);
        onApply(output);
        setApplied({ output, source: selection });
        setEditing(null);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "이미지를 편집하지 못했습니다.");
      } finally {
        applying.current = false;
        setBusy(false);
      }
    },
  };
}

/** Keeps the original for re-editing; only Apply replaces the form's selected upload file. */
export function useImageCrop({
  file,
  onApply,
  label = "앨범 이미지",
  shape = "square",
  maxMB = 100,
}: {
  file: File | null;
  onApply: (file: File) => void;
  label?: string;
  shape?: "circle" | "square";
  maxMB?: number;
}) {
  const titleId = useId();
  const state = useImageCropState({ file, onApply, maxMB });
  const { editing, busy, error } = state;
  const [ready, setReady] = useState(false);

  return {
    select(source: File) {
      setReady(false);
      state.select(source);
    },
    error: !editing ? error : null,
    canEdit: state.canEdit,
    edit: () => {
      setReady(false);
      state.edit();
    },
    dialog: editing && (
      <CanvasDialog
        className="flex w-[350px] flex-col gap-4 rounded-[20px] bg-app-bg p-5 text-app-fg shadow-2xl"
        titleId={titleId}
        onClose={state.cancel}
      >
        <div>
          <h2 id={titleId} className="m-0 text-title font-bold">
            {label} 편집
          </h2>
          <p className="mb-0 mt-2 text-body text-app-muted">
            한 손가락으로 이동하고 두 손가락으로 크기를 조절하세요.
          </p>
        </div>
        <ImageCropper
          file={editing.file}
          crop={editing.crop}
          onChange={state.setCrop}
          onReady={setReady}
          disabled={busy}
          label={label}
          shape={shape}
        />
        {editing.file.type === "image/gif" && (
          <p className="m-0 text-caption text-app-muted">
            GIF는 첫 프레임의 정지 이미지로 저장됩니다.
          </p>
        )}
        {error && (
          <p role="alert" className="m-0 text-body text-red-300">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            className={buttonVariants({ tone: "secondary", size: "compact" })}
            disabled={busy}
            onClick={state.cancel}
          >
            취소
          </button>
          <button
            type="button"
            className={buttonVariants({ size: "compact" })}
            disabled={!ready || busy}
            onClick={() => {
              if (ready) void state.apply(editing);
            }}
          >
            {busy ? "적용 중…" : "적용"}
          </button>
        </div>
      </CanvasDialog>
    ),
  };
}
