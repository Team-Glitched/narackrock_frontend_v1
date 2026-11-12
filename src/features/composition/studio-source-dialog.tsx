import { studioStyles } from "@/styles/studio.styles";
import { buttonVariants } from "@/styles/variants";
import { useId, useState } from "react";
import { CanvasDialog } from "@/components/canvas-dialog";
import { Asset } from "@/components/asset";
import { useWorkspace, type Resource } from "@/features/workspace/workspace-store";
import { loadSavedSources, savedSourcesScope } from "@/features/sources/source-queries";
import { usePagedItems } from "@/hooks/use-paged-items";
import type { OpenSourceSummary } from "@/lib/api/open-sources";
import { errorText } from "./studio-helpers";

type Tab = "saved" | "local";

export function StudioSourceDialog({
  onClose,
  onResource,
  onOpenSource,
}: {
  onClose: () => void;
  /** Imports a MIDI work kept in this browser. */
  onResource: (resource: Resource) => Promise<void>;
  /** Places a saved server open source on the edited layer; omitted where no own layer exists. */
  onOpenSource?: (source: OpenSourceSummary) => Promise<void>;
}) {
  const id = useId();
  const [tab, setTab] = useState<Tab>(onOpenSource ? "saved" : "local");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const keyword = query.trim().toLocaleLowerCase();
  async function run(key: string, task: () => Promise<void>) {
    setBusy(key);
    setError("");
    try {
      await task();
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setBusy(null);
    }
  }
  return (
    <CanvasDialog
      className={studioStyles.studioSourceDialog}
      titleId={id}
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <header>
        <h2 id={id}>샘플 추가</h2>
        <button aria-label="가져오기 닫기" disabled={busy !== null} onClick={onClose}>
          <Asset name="search-close.svg" />
        </button>
      </header>
      {onOpenSource && (
        <div className="flex gap-2" role="group" aria-label="가져올 자료">
          {([
            ["saved", "보관한 샘플"],
            ["local", "이 기기의 MIDI 작업"],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={tab === value}
              className={buttonVariants({ tone: tab === value ? "primary" : "secondary", size: "compact" })}
              disabled={busy !== null}
              onClick={() => setTab(value)}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      <p>
        {tab === "saved"
          ? "보관한 샘플을 내 레이어에 오디오로 넣습니다. 현재 재생 위치부터 들어갑니다."
          : "이 기기에 남아 있는 MIDI 작업의 노트를 지금 편집 중인 초안에 넣습니다."}
      </p>
      <label>
        <input
          aria-label="샘플 검색"
          placeholder={tab === "saved" ? "보관한 샘플 검색" : "MIDI 작업 검색"}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      <div className={studioStyles.studioSourceResults}>
        {tab === "saved" && onOpenSource ? (
          <SavedSourceRows
            keyword={keyword}
            busy={busy}
            onPick={(source) => run(`saved:${source.openSourceId}`, () => onOpenSource(source))}
          />
        ) : (
          <LocalResourceRows
            keyword={keyword}
            busy={busy}
            onPick={(resource) => run(`local:${resource.id}`, () => onResource(resource))}
          />
        )}
      </div>
      {error && <p role="alert">{error}</p>}
    </CanvasDialog>
  );
}

function SavedSourceRows({ keyword, busy, onPick }: {
  keyword: string;
  busy: string | null;
  onPick: (source: OpenSourceSummary) => void;
}) {
  const { state, more } = usePagedItems(savedSourcesScope, 0, loadSavedSources);
  if (!state) return <p role="status">보관한 샘플을 불러오는 중...</p>;
  const sources = state.items.flatMap((item) =>
    item.availability === "AVAILABLE" && item.source &&
    `${item.source.title} ${item.source.description ?? ""}`.toLocaleLowerCase().includes(keyword)
      ? [item.source]
      : [],
  );
  return (
    <>
      {sources.map((source) => (
        <div className={studioStyles.studioSourceRow} key={source.openSourceId}>
          <span>
            <strong>{source.title}</strong>
            <small>{source.writer.nickname}</small>
          </span>
          <button
            className={buttonVariants({ tone: "primary" })}
            disabled={busy !== null}
            onClick={() => onPick(source)}
          >
            {busy === `saved:${source.openSourceId}` ? "넣는 중…" : "내 레이어에 넣기"}
          </button>
        </div>
      ))}
      {!sources.length && state.next === null && !state.error && (
        <p>{keyword ? "검색 결과가 없습니다." : "보관한 샘플이 없습니다. 샘플 화면에서 마음에 드는 소리를 보관해 보세요."}</p>
      )}
      {state.error && <p role="alert">보관한 샘플을 불러오지 못했습니다.</p>}
      {state.next !== null && (
        <button disabled={state.busy || busy !== null} onClick={more}>
          {state.busy ? "불러오는 중…" : state.error ? "다시 시도" : "더보기"}
        </button>
      )}
    </>
  );
}

function LocalResourceRows({ keyword, busy, onPick }: {
  keyword: string;
  busy: string | null;
  onPick: (resource: Resource) => void;
}) {
  const { resources } = useWorkspace();
  const midi = resources.filter((resource) => resource.title.toLocaleLowerCase().includes(keyword));
  return (
    <>
      {midi.map((resource) => (
        <div className={studioStyles.studioSourceRow} key={resource.id}>
          <span>
            <strong>{resource.title}</strong>
            <small>이 기기의 MIDI 작업 · {resource.description}</small>
          </span>
          <button
            className={buttonVariants({ tone: "primary" })}
            disabled={
              busy !== null ||
              resource.composition.tracks.some((track) =>
                track.clips.some((clip) => clip.clipType !== "MIDI"),
              )
            }
            onClick={() => onPick(resource)}
          >
            {busy === `local:${resource.id}` ? "가져오는 중…" : "노트 가져오기"}
          </button>
        </div>
      ))}
      {!midi.length && <p>{keyword ? "검색 결과가 없습니다." : "이 기기에 남아 있는 MIDI 작업이 없습니다."}</p>}
    </>
  );
}
