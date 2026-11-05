import { studioStyles } from "@/styles/studio.styles";
import { buttonVariants } from "@/styles/variants";
import { useId, useState } from "react";
import { CanvasDialog } from "@/components/canvas-dialog";
import { Asset } from "@/components/asset";
import { useWorkspace, type Resource } from "@/features/workspace/workspace-store";

export function StudioSourceDialog({
  onClose,
  onResource,
}: {
  midiOnly?: boolean;
  onClose: () => void;
  onResource: (resource: Resource) => Promise<void>;
}) {
  const id = useId();
  const { resources } = useWorkspace();
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState("");
  const midi = resources.filter((resource) =>
    resource.title.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
  );
  return (
    <CanvasDialog
      className={studioStyles.studioSourceDialog}
      titleId={id}
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <header>
        <h2 id={id}>이 브라우저의 MIDI 복구 자료</h2>
        <button aria-label="가져오기 닫기" disabled={busy !== null} onClick={onClose}>
          <Asset name="search-close.svg" />
        </button>
      </header>
      <p>개인 초안으로 가져옵니다. 서버 오픈소스의 프로젝트 삽입은 현재 지원하지 않습니다.</p>
      <label>
        <input
          aria-label="로컬 MIDI 검색"
          placeholder="로컬 MIDI 검색"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      <div className={studioStyles.studioSourceResults}>
        {midi.map((resource) => (
          <div className={studioStyles.studioSourceRow} key={resource.id}>
            <span>
              <strong>{resource.title}</strong>
              <small>이 브라우저의 MIDI · {resource.description}</small>
            </span>
            <button
              className={buttonVariants({ tone: "primary" })}
              disabled={
                busy !== null ||
                resource.composition.tracks.some((track) =>
                  track.clips.some((clip) => clip.clipType !== "MIDI"),
                )
              }
              onClick={async () => {
                setBusy(resource.id);
                setError("");
                try {
                  await onResource(resource);
                } catch (cause) {
                  setError(cause instanceof Error ? cause.message : "가져오지 못했습니다.");
                } finally {
                  setBusy(null);
                }
              }}
            >
              {busy === resource.id ? "가져오는 중…" : "개인 초안으로 가져오기"}
            </button>
          </div>
        ))}
        {!midi.length && <p>이 브라우저에 저장한 MIDI가 없습니다.</p>}
      </div>
      {error && <p role="alert">{error}</p>}
    </CanvasDialog>
  );
}
