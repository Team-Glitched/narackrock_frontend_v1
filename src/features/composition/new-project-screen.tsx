import { sharedStyles } from "@/styles/shared.styles";
import { buttonVariants } from "@/styles/variants";
import { useEffect, useState, useSyncExternalStore } from "react";
import { createDraftProject, updateProjectMetadata, uploadMedia } from "@/lib/api/composition";
import { errorText, storedDraftId, subscribeToDraft } from "./studio-helpers";

export function NewProject({
  onCreated,
  onResume,
}: {
  onCreated: (id: number) => void;
  onResume: (id: number) => void;
  onBack: () => void;
}) {
  const savedDraftId = useSyncExternalStore(subscribeToDraft, storedDraftId, () => null);
  const [title, setTitle] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(
    () => () => {
      if (imageUrl) URL.revokeObjectURL(imageUrl);
    },
    [imageUrl],
  );
  async function start(event: React.FormEvent) {
    event.preventDefault();
    if (busy || !title.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const { projectId } = await createDraftProject();
      window.localStorage.setItem("glitched-composition-draft-id", String(projectId));
      const imageId = image ? await uploadMedia(image, "IMAGE") : null;
      await updateProjectMetadata(projectId, title.trim(), imageId);
      onCreated(projectId);
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className={sharedStyles.projectCreate} onSubmit={start}>
      <label className={sharedStyles.projectTitleField}>
        음악명
        <input
          aria-label="음악명"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          maxLength={100}
          required
        />
      </label>
      <label className={"project-artwork-field"}>
        앨범
        <span className={sharedStyles.projectArtworkPicker}>
          {imageUrl ? (
            <img src={imageUrl} alt="선택한 앨범" width={350} height={280} />
          ) : (
            <>
              <strong>앨범 추가</strong>
              <small>JPG, PNG, WEBP 최대 100MB</small>
            </>
          )}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            aria-label="앨범 추가"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              if (file.size > 100 * 1024 * 1024) {
                setError("100MB 이하의 이미지를 선택해 주세요.");
                return;
              }
              setImage(file);
              setImageUrl(URL.createObjectURL(file));
              setError(null);
            }}
          />
        </span>
      </label>
      {error && (
        <p className={sharedStyles.projectError} role="alert">
          {error}
        </p>
      )}
      <div className={sharedStyles.projectCreateActions}>
        <button
          className={buttonVariants({
            tone: "primary",
          })}
          type="submit"
          disabled={busy || !title.trim()}
        >
          {busy ? "만드는 중…" : "입력 완료"}
        </button>
        {savedDraftId && (
          <button
            className={sharedStyles.resumeDraft}
            type="button"
            onClick={() => onResume(savedDraftId)}
          >
            이전 작업 이어하기
          </button>
        )}
      </div>
    </form>
  );
}
