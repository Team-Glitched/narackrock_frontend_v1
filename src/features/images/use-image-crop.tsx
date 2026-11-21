import { useId, useRef, useState } from "react";
import { CanvasDialog } from "@/components/canvas-dialog";
import { buttonVariants } from "@/styles/variants";
import { ImageCropper } from "./image-cropper";
import { defaultCrop, renderThumbnail, type ThumbnailCrop } from "./image-crop";

type Selection = { file: File; crop: ThumbnailCrop };

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
  const [editing, setEditing] = useState<Selection | null>(null);
  const [applied, setApplied] = useState<{ output: File; source: Selection } | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const applying = useRef(false);
  const [error, setError] = useState<string | null>(null);

  function open(selection: Selection) {
    setError(null);
    setReady(false);
    setEditing(selection);
  }

  function select(source: File) {
    if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(source.type)) {
      setError("JPG, PNG, WEBP 또는 GIF 이미지를 선택해 주세요.");
      return;
    }
    if (source.size > maxMB * 1024 * 1024) {
      setError(`${maxMB}MB 이하의 이미지를 선택해 주세요.`);
      return;
    }
    open({ file: source, crop: defaultCrop() });
  }

  const canEdit = Boolean(file && applied?.output === file);
  return {
    select,
    error: !editing ? error : null,
    canEdit,
    edit: () => {
      if (canEdit && applied) open(applied.source);
    },
    dialog: editing && (
      <CanvasDialog
        className="flex w-[350px] flex-col gap-4 rounded-[20px] bg-app-bg p-5 text-app-fg shadow-2xl"
        titleId={titleId}
        onClose={() => {
          if (!applying.current) setEditing(null);
        }}
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
          onChange={(crop) => setEditing({ ...editing, crop })}
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
            onClick={() => setEditing(null)}
          >
            취소
          </button>
          <button
            type="button"
            className={buttonVariants({ size: "compact" })}
            disabled={!ready || busy}
            onClick={async () => {
              if (applying.current || !ready) return;
              applying.current = true;
              setBusy(true);
              setError(null);
              try {
                const output = await renderThumbnail(editing.file, editing.crop);
                onApply(output);
                setApplied({ output, source: editing });
                setEditing(null);
              } catch (cause) {
                setError(cause instanceof Error ? cause.message : "이미지를 편집하지 못했습니다.");
              } finally {
                applying.current = false;
                setBusy(false);
              }
            }}
          >
            {busy ? "적용 중…" : "적용"}
          </button>
        </div>
      </CanvasDialog>
    ),
  };
}
