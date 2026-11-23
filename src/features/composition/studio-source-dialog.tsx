import { studioStyles } from "@/styles/studio.styles";
import { buttonVariants } from "@/styles/variants";
import { useId, useState, type ReactNode } from "react";
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
import { jsonNoteFormat } from "./json-note-import";
import { errorText } from "./studio-helpers";
import { SEARCH_QUERY_MAX_LENGTH, clampCodePoints } from "@/lib/content-limits";

type Tab = "saved" | "local" | "upload";

type SourceHandlers = {
  /** Imports a MIDI work kept in this browser. */
  onResource: (resource: Resource) => Promise<void>;
  /** Places a saved server open source on the edited layer; omitted where no own layer exists. */
  onOpenSource?: (source: OpenSourceSummary) => Promise<void>;
  /**
   * App only: picks a JSON note file and adds its notes (the web's "이 기기에서 업로드" tab);
   * resolves without change when the picker is cancelled.
   */
  onImportJson?: () => Promise<void>;
  /** True inside the piano roll: shows only MIDI-compatible samples and inserts notes directly. */
  midiOnly?: boolean;
};

/** Tab, search and the running import of one opening of the sample picker. */
function useSourcePicker({ onResource, onOpenSource, onImportJson }: SourceHandlers) {
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
    importJson: () => onImportJson && run("upload", onImportJson),
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
function savedRows(
  { state }: SavedSources,
  keyword: string,
  busy: string | null,
  midiOnly = false,
) {
  if (!state) return null;
  const sources = state.items.flatMap((item) =>
    item.availability === "AVAILABLE" &&
    item.source &&
    (!midiOnly || item.source.hasMidiNotes === true) &&
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
        button:
          busy === `saved:${source.openSourceId}`
            ? midiOnly
              ? "불러오는 중…"
              : "넣는 중…"
            : midiOnly
              ? "노트 가져오기"
              : "내 레이어에 넣기",
        disabled: busy !== null,
      }),
    ),
    empty:
      !sources.length && state.next === null && !state.error
        ? keyword
          ? "검색 결과가 없습니다."
          : midiOnly
            ? "보관한 샘플 중 피아노롤(MIDI)로 불러올 수 있는 샘플이 없습니다. MIDI로 만든 샘플을 보관하거나 로컬 MIDI·JSON을 이용해 보세요."
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
        : "이 기기에 저장된 MIDI 작업이 없습니다.",
  };
}

const pickerText: Record<Tab, { description: string; placeholder: string }> = {
  saved: {
    description: "보관한 샘플을 타임라인 아래 새 트랙으로 추가할 수 있습니다.",
    placeholder: "보관한 샘플 검색",
  },
  local: {
    description: "이 기기에 저장된 MIDI 작업에서 음표를 가져올 수 있습니다.",
    placeholder: "MIDI 작업 검색",
  },
  upload: {
    description: `JSON 파일(.json)을 가져올 수 있습니다. 형식: ${jsonNoteFormat}`,
    placeholder: "",
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
  midiOnly = false,
  ...handlers
}: SourceHandlers & { open: boolean; onOpen: () => void; onClose: () => void }): {
  model: NativeSourcePicker | null;
  act: (action: NativeSourcePickerAction) => void;
} {
  const picker = useSourcePicker(handlers);
  const saved = useSavedSources(open && picker.showSaved);
  const { resources } = useWorkspace();
  const list =
    picker.tab === "upload"
      ? { rows: [], empty: null, failed: false, more: null }
      : picker.showSaved
        ? savedRows(saved, picker.keyword, picker.busy, midiOnly)
        : { ...localRows(resources, picker.keyword, picker.busy), failed: false, more: null };
  const tabCopy =
    picker.tab === "saved" && midiOnly
      ? {
          ...pickerText.saved,
          description: "보관한 MIDI 샘플의 음표를 현재 피아노롤에 바로 추가할 수 있습니다.",
        }
      : pickerText[picker.tab];
  return {
    model: open
      ? {
          tabs: [
            ...(handlers.onOpenSource ? (["saved"] as const) : []),
            ...(handlers.onOpenSource || handlers.onImportJson ? (["local"] as const) : []),
            ...(handlers.onImportJson ? (["upload"] as const) : []),
          ],
          uploading: picker.busy === "upload",
          tab: picker.tab,
          ...tabCopy,
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
          if (
            picker.busy === null &&
            (action.tab === "local" ||
              (action.tab === "saved" && handlers.onOpenSource) ||
              (action.tab === "upload" && handlers.onImportJson))
          )
            picker.setTab(action.tab);
          return;
        case "source-upload":
          if (picker.busy === null && picker.tab === "upload") void picker.importJson();
          return;
        case "source-query":
          return picker.setQuery(action.query);
        case "source-more":
          if (picker.busy === null) saved.more();
          return;
        case "source-pick": {
          if (picker.busy !== null) return;
          if (picker.showSaved) {
            const source = savedRows(saved, picker.keyword, null, midiOnly)?.sources.find(
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
  localFileImport,
  midiOnly = false,
  ...handlers
}: SourceHandlers & {
  onClose: () => void;
  /** The "이 기기에서 업로드" tab's content (JSON note import); omitted where it does not apply. */
  localFileImport?: ReactNode;
}) {
  const id = useId();
  const picker = useSourcePicker(handlers);
  const { tab, busy } = picker;
  const description =
    tab === "saved" && midiOnly
      ? "보관한 MIDI 샘플의 음표를 현재 피아노롤에 바로 추가할 수 있습니다."
      : pickerText[tab].description;
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
      {(handlers.onOpenSource || localFileImport) && (
        <div className="flex flex-wrap items-start gap-2" role="group" aria-label="가져올 자료">
          {(
            [
              ...(handlers.onOpenSource ? ([["saved", "보관한 샘플"]] as const) : []),
              ["local", "이 기기의 MIDI 작업"],
              ...(localFileImport ? ([["upload", "이 기기에서 업로드"]] as const) : []),
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
      {tab === "upload" ? (
        localFileImport
      ) : (
        <>
          <p>{description}</p>
          <label>
            <input
              aria-label="샘플 검색"
              placeholder={pickerText[tab].placeholder}
              value={picker.query}
              onChange={(event) =>
                picker.setQuery(clampCodePoints(event.target.value, SEARCH_QUERY_MAX_LENGTH))
              }
            />
          </label>
          <div className={studioStyles.studioSourceResults}>
            {picker.showSaved ? (
              <SavedSourceRows
                keyword={picker.keyword}
                busy={busy}
                midiOnly={midiOnly}
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
        </>
      )}
      {picker.error && <p role="alert">{picker.error}</p>}
    </CanvasDialog>
  );
}

function SavedSourceRows({
  keyword,
  busy,
  midiOnly,
  onPick,
}: {
  keyword: string;
  busy: string | null;
  midiOnly: boolean;
  onPick: (source: OpenSourceSummary) => void;
}) {
  const saved = useSavedSources(true);
  const list = savedRows(saved, keyword, busy, midiOnly);
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
