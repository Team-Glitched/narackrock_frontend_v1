import { workspaceStyles } from "@/styles/workspace.styles";
import { useEffect, useState } from "react";
import { SourceAudioPlayer } from "./source-audio-player";
import { readSavedSourceAudio, removeSavedSource, type SavedSource } from "./saved-sources";
export function SavedSourceCard({ source, scope }: { source: SavedSource; scope: string }) {
  const [media, setMedia] = useState<string | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true,
      url: string | null = null;
    void readSavedSourceAudio(source)
      .then((file) => {
        if (!active) return;
        if (file) {
          url = URL.createObjectURL(file);
          setMedia(url);
        } else if (source.mediaKey) setError("저장된 오디오를 찾을 수 없습니다.");
      })
      .catch(() => {
        if (active) setError("저장된 오디오를 불러오지 못했습니다.");
      });
    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [source]);
  return (
    <article className={workspaceStyles.workspaceCard}>
      <span className={workspaceStyles.workspaceStatus}>저장한 오픈소스</span>
      <h2>{source.title}</h2>
      <p>{source.description}</p>
      <small>{source.author}</small>
      <SourceAudioPlayer src={media} />
      {error && <p role="alert">{error}</p>}
      <div className={workspaceStyles.workspaceActions}>
        <button
          onClick={() => {
            try {
              removeSavedSource(scope, source.id);
            } catch {
              setError("저장 해제에 실패했습니다.");
            }
          }}
        >
          저장 해제
        </button>
      </div>
    </article>
  );
}
