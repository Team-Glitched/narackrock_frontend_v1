import { studioStyles } from "@/styles/studio.styles";
import { buttonVariants } from "@/styles/variants";
import { useId, useState } from "react";
import { CanvasDialog } from "@/components/canvas-dialog";
import { Asset } from "@/components/asset";
import { useWorkspace, type Resource } from "@/features/workspace/workspace-store";
import { loadSavedSources, savedSourcesScope } from "@/features/sources/source-queries";
import { usePagedItems } from "@/hooks/use-paged-items";
import type { OpenSourceSummary } from "@/lib/api/open-sources";
import type {
  NativeSourcePicker,
  NativeSourcePickerAction,
  NativeSourcePickerRow,
} from "@/lib/native-screens";
import { errorText } from "./studio-helpers";

type Tab = "saved" | "local";

type SourceHandlers = {
  /** Imports a MIDI work kept in this browser. */
  onResource: (resource: Resource) => Promise<void>;
  /** Places a saved server open source on the edited layer; omitted where no own layer exists. */
  onOpenSource?: (source: OpenSourceSummary) => Promise<void>;
};

/** Tab, search and the running import of one opening of the sample picker. */
function useSourcePicker({ onResource, onOpenSource }: SourceHandlers) {
  const [tab, setTab] = useState<Tab>(onOpenSource ? "saved" : "local");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
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
  return {
    tab,
    setTab,
    query,
    setQuery,
    busy,
    error,
    keyword: query.trim().toLocaleLowerCase(),
    showSaved: tab === "saved" && onOpenSource !== undefined,
    pickSaved: (source: OpenSourceSummary) =>
      onOpenSource && run(`saved:${source.openSourceId}`, () => onOpenSource(source)),
    pickLocal: (resource: Resource) => run(`local:${resource.id}`, () => onResource(resource)),
    reset() {
      setTab(onOpenSource ? "saved" : "local");
      setQuery("");
      setError("");
    },
  };
}

type SavedSources = ReturnType<typeof useSavedSources>;

function useSavedSources(enabled: boolean) {
  return usePagedItems(savedSourcesScope, 0, loadSavedSources, enabled);
}

/** Saved samples matching the search, with the web's row texts. */
function savedRows({ state }: SavedSources, keyword: string, busy: string | null) {
  if (!state) return null;
  const sources = state.items.flatMap((item) =>
    item.availability === "AVAILABLE" &&
    item.source &&
    `${item.source.title} ${item.source.description ?? ""}`.toLocaleLowerCase().includes(keyword)
      ? [item.source]
      : [],
  );
  return {
    sources,
    rows: sources.map(
      (source): NativeSourcePickerRow => ({
        key: `saved:${source.openSourceId}`,
        title: source.title,
        subtitle: source.writer.nickname,
        button: busy === `saved:${source.openSourceId}` ? "넣는 중…" : "내 레이어에 넣기",
        disabled: busy !== null,
      }),
    ),
    empty:
      !sources.length && state.next === null && !state.error
        ? keyword
          ? "검색 결과가 없습니다."
          : "보관한 샘플이 없습니다. 샘플 화면에서 마음에 드는 소리를 보관해 보세요."
        : null,
    failed: state.error !== null,
    more:
      state.next !== null
        ? {
            label: state.busy ? "불러오는 중…" : state.error ? "다시 시도" : "더보기",
            disabled: state.busy || busy !== null,
          }
        : null,
  };
}

/** MIDI works kept on this device matching the search, with the web's row texts. */
function localRows(resources: Resource[], keyword: string, busy: string | null) {
  const midi = resources.filter((resource) => resource.title.toLocaleLowerCase().includes(keyword));
  return {
    midi,
    rows: midi.map(
      (resource): NativeSourcePickerRow => ({
        key: `local:${resource.id}`,
        title: resource.title,
        subtitle: `이 기기의 MIDI 작업 · ${resource.description}`,
        button: busy === `local:${resource.id}` ? "가져오는 중…" : "노트 가져오기",
        disabled:
          busy !== null ||
          resource.composition.tracks.some((track) =>
            track.clips.some((clip) => clip.clipType !== "MIDI"),
          ),
      }),
    ),
    empty: midi.length
      ? null
      : keyword
        ? "검색 결과가 없습니다."
        : "이 기기에 남아 있는 MIDI 작업이 없습니다.",
  };
}

const pickerText = {
  saved: {
    description: "보관한 샘플을 내 레이어에 오디오로 넣습니다. 현재 재생 위치부터 들어갑니다.",
    placeholder: "보관한 샘플 검색",
  },
  local: {
    description: "이 기기에 남아 있는 MIDI 작업의 노트를 지금 편집 중인 초안에 넣습니다.",
    placeholder: "MIDI 작업 검색",
  },
};

/**
 * The app's sample picker over the same data and rules as StudioSourceDialog. The caller owns
 * whether it is open: `source-open` calls `onOpen`, closing calls `onClose`.
 */
export function useNativeSourcePicker({
  open,
  onOpen,
  onClose,
  ...handlers
}: SourceHandlers & { open: boolean; onOpen: () => void; onClose: () => void }): {
  model: NativeSourcePicker | null;
  act: (action: NativeSourcePickerAction) => void;
} {
  const picker = useSourcePicker(handlers);
  const saved = useSavedSources(open && picker.showSaved);
  const { resources } = useWorkspace();
  const list = picker.showSaved
    ? savedRows(saved, picker.keyword, picker.busy)
    : { ...localRows(resources, picker.keyword, picker.busy), failed: false, more: null };
  return {
    model: open
      ? {
          tabs: handlers.onOpenSource !== undefined,
          tab: picker.tab,
          ...pickerText[picker.tab],
          query: picker.query,
          rows: list?.rows ?? null,
          empty: list?.empty ?? null,
          failed: list?.failed ?? false,
          more: list?.more ?? null,
          busy: picker.busy !== null,
          error: picker.error || null,
        }
      : null,
    act(action) {
      switch (action.type) {
        case "source-open":
          picker.reset();
          return onOpen();
        case "source-close":
          if (picker.busy === null) onClose();
          return;
        case "source-tab":
          if (picker.busy === null && handlers.onOpenSource) picker.setTab(action.tab);
          return;
        case "source-query":
          return picker.setQuery(action.query);
        case "source-more":
          if (picker.busy === null) saved.more();
          return;
        case "source-pick": {
          if (picker.busy !== null) return;
          if (picker.showSaved) {
            const source = savedRows(saved, picker.keyword, null)?.sources.find(
              (item) => `saved:${item.openSourceId}` === action.key,
            );
            if (source) void picker.pickSaved(source);
          } else {
            const resource = localRows(resources, picker.keyword, null).midi.find(
              (item) => `local:${item.id}` === action.key,
            );
            if (
              resource &&
              !resource.composition.tracks.some((track) =>
                track.clips.some((clip) => clip.clipType !== "MIDI"),
              )
            )
              void picker.pickLocal(resource);
          }
          return;
        }
      }
    },
  };
}

export function StudioSourceDialog({
  onClose,
  ...handlers
}: SourceHandlers & { onClose: () => void }) {
  const id = useId();
  const picker = useSourcePicker(handlers);
  const { tab, busy } = picker;
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
      {handlers.onOpenSource && (
        <div className="flex gap-2" role="group" aria-label="가져올 자료">
          {(
            [
              ["saved", "보관한 샘플"],
              ["local", "이 기기의 MIDI 작업"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={tab === value}
              className={buttonVariants({
                tone: tab === value ? "primary" : "secondary",
                size: "compact",
              })}
              disabled={busy !== null}
              onClick={() => picker.setTab(value)}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      <p>{pickerText[tab].description}</p>
      <label>
        <input
          aria-label="샘플 검색"
          placeholder={pickerText[tab].placeholder}
          value={picker.query}
          onChange={(event) => picker.setQuery(event.target.value)}
        />
      </label>
      <div className={studioStyles.studioSourceResults}>
        {picker.showSaved ? (
          <SavedSourceRows
            keyword={picker.keyword}
            busy={busy}
            onPick={(source) => void picker.pickSaved(source)}
          />
        ) : (
          <LocalResourceRows
            keyword={picker.keyword}
            busy={busy}
            onPick={(resource) => void picker.pickLocal(resource)}
          />
        )}
      </div>
      {picker.error && <p role="alert">{picker.error}</p>}
    </CanvasDialog>
  );
}

function SavedSourceRows({
  keyword,
  busy,
  onPick,
}: {
  keyword: string;
  busy: string | null;
  onPick: (source: OpenSourceSummary) => void;
}) {
  const saved = useSavedSources(true);
  const list = savedRows(saved, keyword, busy);
  if (!list) return <p role="status">보관한 샘플을 불러오는 중...</p>;
  return (
    <>
      {list.sources.map((source, index) => (
        <div className={studioStyles.studioSourceRow} key={source.openSourceId}>
          <span>
            <strong>{source.title}</strong>
            <small>{source.writer.nickname}</small>
          </span>
          <button
            className={buttonVariants({ tone: "primary" })}
            disabled={list.rows[index].disabled}
            onClick={() => onPick(source)}
          >
            {list.rows[index].button}
          </button>
        </div>
      ))}
      {list.empty && <p>{list.empty}</p>}
      {list.failed && <p role="alert">보관한 샘플을 불러오지 못했습니다.</p>}
      {list.more && (
        <button disabled={list.more.disabled} onClick={saved.more}>
          {list.more.label}
        </button>
      )}
    </>
  );
}

function LocalResourceRows({
  keyword,
  busy,
  onPick,
}: {
  keyword: string;
  busy: string | null;
  onPick: (resource: Resource) => void;
}) {
  const { resources } = useWorkspace();
  const list = localRows(resources, keyword, busy);
  return (
    <>
      {list.midi.map((resource, index) => (
        <div className={studioStyles.studioSourceRow} key={resource.id}>
          <span>
            <strong>{resource.title}</strong>
            <small>{list.rows[index].subtitle}</small>
          </span>
          <button
            className={buttonVariants({ tone: "primary" })}
            disabled={list.rows[index].disabled}
            onClick={() => onPick(resource)}
          >
            {list.rows[index].button}
          </button>
        </div>
      ))}
      {list.empty && <p>{list.empty}</p>}
    </>
  );
}
