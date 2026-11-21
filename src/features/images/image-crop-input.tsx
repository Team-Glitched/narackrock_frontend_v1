import { useEffect, useRef } from "react";
import { buttonVariants } from "@/styles/variants";
import { useImageCrop } from "./use-image-crop";

function ImagePreview({ file }: { file: File }) {
  const image = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const url = URL.createObjectURL(file);
    if (image.current) image.current.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);
  return (
    <img
      ref={image}
      className="size-28 self-center rounded-lg object-cover"
      alt="선택한 앨범 이미지"
    />
  );
}

export function ImageCropInput({
  file,
  onChange,
  disabled = false,
}: {
  file: File | null;
  onChange: (file: File) => void;
  disabled?: boolean;
}) {
  const crop = useImageCrop({ file, onApply: onChange });
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="flex flex-col gap-3">
      {file && <ImagePreview file={file} />}
      <div className="flex flex-col gap-2">
        <span>앨범 이미지 (선택)</span>
        <input
          ref={input}
          className="!hidden"
          type="file"
          aria-label="앨범 이미지 (선택)"
          accept="image/jpeg,image/png,image/webp,image/gif"
          disabled={disabled}
          onChange={(event) => {
            const selected = event.currentTarget.files?.[0];
            event.currentTarget.value = "";
            if (selected) crop.select(selected);
          }}
        />
        <button
          type="button"
          className={buttonVariants({ tone: "secondary", size: "compact" })}
          disabled={disabled}
          onClick={() => input.current?.click()}
        >
          {file ? "다른 이미지 선택" : "이미지 선택"}
        </button>
      </div>
      {crop.canEdit && (
        <button
          type="button"
          className="self-center text-body text-app-muted underline"
          disabled={disabled}
          onClick={crop.edit}
        >
          크기·위치 조절
        </button>
      )}
      {crop.error && (
        <p role="alert" className="m-0 text-body text-red-300">
          {crop.error}
        </p>
      )}
      {crop.dialog}
    </div>
  );
}
