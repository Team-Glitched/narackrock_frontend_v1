import { sharedStyles } from "@/styles/shared.styles";
import { buttonVariants } from "@/styles/variants";
import { cn } from "@/lib/utils";
import { CanvasDialog } from "@/components/canvas-dialog";
import type { NativeInstrumentAction, NativeInstrumentPicker } from "@/lib/native-screens";
import { useEffect, useEffectEvent, useId, useState } from "react";
import { canonicalInstrumentId } from "./instrument-catalog";
import {
  formatProfileInstruments,
  instrumentGroups,
  parseProfileInstruments,
  tracksUsingInstrumentFamily,
  partLabel,
  supportsMidi,
  type PartTrack,
} from "./instrument-parts";

export type InstrumentChoice = {
  /** Current instrument/role of the track being changed, or null when choosing for a new layer. */
  value: string | null;
  /** MIDI layers accept only sampled instruments; audio layers accept recorded roles too. */
  mode: "midi" | "audio";
  tracks: PartTrack[];
  currentTrackId?: number;
  /** MIDI mode plays the candidate's sample phrase; audio mode plays the layer's own original audio. */
  onPreview: (id: string) => Promise<void>;
  /** Stops only this chooser's preview. Called on candidate change, close, confirm and unmount. */
  onStopPreview: () => void;
  onConfirm: (id: string) => Promise<void>;
  /** The owner is busy (e.g. rendering the audio): the trigger is disabled and nothing can be confirmed. */
  disabled?: boolean;
};

function choiceError(cause: unknown) {
  return cause instanceof Error ? cause.message : "악기를 바꾸지 못했습니다.";
}

/** The chooser's groups: the parts this mode accepts per family, with the team-usage legend. */
function choiceGroups(choice: InstrumentChoice) {
  const available = (id: string) => choice.mode === "audio" || supportsMidi(id);
  return instrumentGroups.flatMap((group) => {
    const parts = group.instruments.filter(available);
    if (!parts.length) return [];
    const using = tracksUsingInstrumentFamily(choice.tracks, parts[0], choice.currentTrackId);
    return [
      {
        id: group.id,
        label: `${group.label}${using.length ? ` · 다른 레이어 ${using.length}개에서 사용 중 · 함께 선택 가능` : ""}`,
        parts: parts.map((id) => ({ id, label: partLabel(id) })),
      },
    ];
  });
}

/**
 * Selection, preview and confirmation of one opening of the chooser (`choice` null: closed). Previewing
 * never writes; the track is created or changed on "선택 완료". Closing stops the preview.
 */
function useInstrumentChoice(choice: InstrumentChoice | null, onClose: () => void) {
  const [opened, setOpened] = useState(choice);
  const [selected, setSelected] = useState<string | null>(
    choice?.value ? canonicalInstrumentId(choice.value) : null,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Another opening starts from its own current value.
  if ((opened === null) !== (choice === null)) {
    setOpened(choice);
    setSelected(choice?.value ? canonicalInstrumentId(choice.value) : null);
    setBusy(false);
    setError(null);
  }
  const stopPreview = useEffectEvent(() => choice?.onStopPreview());
  const open = choice !== null;
  useEffect(() => {
    if (open) return () => stopPreview();
  }, [open]);
  const preview = (id: string) => {
    if (!choice) return;
    setError(null);
    void choice.onPreview(id).catch((cause) => setError(choiceError(cause)));
  };
  return {
    selected,
    busy,
    error,
    canConfirm:
      choice !== null &&
      !choice.disabled &&
      !busy &&
      selected !== null &&
      selected !== canonicalInstrumentId(choice.value),
    select(id: string) {
      setSelected(id);
      preview(id);
    },
    previewSelected: () => preview(selected ?? ""),
    close() {
      choice?.onStopPreview();
      onClose();
    },
    async confirm() {
      if (!choice || !selected || choice.disabled) return;
      choice.onStopPreview();
      setBusy(true);
      setError(null);
      try {
        await choice.onConfirm(selected);
        onClose();
      } catch (cause) {
        setError(choiceError(cause));
      } finally {
        setBusy(false);
      }
    },
  };
}

/** The app's instrument chooser over the same state as InstrumentDialog; pass null while closed. */
export function useNativeInstrumentPicker(
  choice: InstrumentChoice | null,
  onClose: () => void,
): { model: NativeInstrumentPicker | null; act: (action: NativeInstrumentAction) => void } {
  const state = useInstrumentChoice(choice, onClose);
  return {
    model: choice && {
      mode: choice.mode,
      groups: choiceGroups(choice),
      selected: state.selected,
      canConfirm: state.canConfirm,
      busy: state.busy,
      error: state.error,
    },
    act(action) {
      if (!choice) return;
      switch (action.type) {
        case "instrument-select":
          if (!state.busy) state.select(action.id);
          return;
        case "instrument-preview":
          if (!state.busy && choice.mode === "audio") state.previewSelected();
          return;
        case "instrument-stop-preview":
          return choice.onStopPreview();
        case "instrument-confirm":
          if (state.canConfirm) void state.confirm();
          return;
        case "instrument-close":
          return state.close();
      }
    },
  };
}

/**
 * Grouped picker following the backend instrument families. Previewing never writes; the track is created
 * or changed on "선택 완료". Team usage is informational and never blocks a choice.
 */
export function InstrumentDialog({
  choice,
  onClose,
  subtitle = "같은 악기나 보컬을 여러 명이 함께 선택할 수 있어요.",
  hidePreview = false,
  allowSameConfirm = false,
  onClear,
}: {
  choice: InstrumentChoice;
  onClose: () => void;
  subtitle?: string;
  hidePreview?: boolean;
  allowSameConfirm?: boolean;
  onClear?: () => void;
}) {
  const titleId = useId();
  const state = useInstrumentChoice(choice, onClose);
  const { busy } = state;
  const canConfirm = allowSameConfirm
    ? !busy && !choice.disabled && state.selected !== null
    : state.canConfirm;
  return (
    <CanvasDialog className={sharedStyles.instrumentDialog} titleId={titleId} onClose={state.close}>
      <h2 id={titleId}>악기 선택</h2>
      <p>{subtitle}</p>
      <div
        role="radiogroup"
        aria-label="악기"
        className="scrollbar-dark grid min-h-0 max-h-[320px] flex-1 gap-4 overflow-y-auto overscroll-contain pr-1"
      >
        {choiceGroups(choice).map((group) => (
          <fieldset key={group.id} disabled={busy}>
            <legend>{group.label}</legend>
            <div className="flex flex-wrap gap-2">
              {group.parts.map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={state.selected === id}
                  onClick={() => state.select(id)}
                >
                  {label}
                </button>
              ))}
            </div>
          </fieldset>
        ))}
      </div>
      {choice.mode === "audio" && !hidePreview && (
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            className={buttonVariants({ tone: "secondary", size: "compact" })}
            disabled={busy}
            onClick={state.previewSelected}
          >
            원본 듣기
          </button>
          <button
            type="button"
            className={buttonVariants({ tone: "secondary", size: "compact" })}
            onClick={choice.onStopPreview}
          >
            정지
          </button>
        </div>
      )}
      {state.error && <p role="alert">{state.error}</p>}
      <div className="flex shrink-0 gap-2">
        {onClear ? (
          <button
            type="button"
            className={cn(
              buttonVariants({ tone: "secondary", size: "compact" }),
              "shrink-0 justify-center px-4",
            )}
            disabled={busy}
            onClick={() => {
              choice.onStopPreview();
              onClear();
              onClose();
            }}
          >
            선택 해제
          </button>
        ) : (
          <button
            type="button"
            className={cn(
              buttonVariants({ tone: "secondary", size: "compact" }),
              "shrink-0 justify-center px-4",
            )}
            disabled={busy}
            onClick={state.close}
          >
            취소
          </button>
        )}
        <button
          type="button"
          className={cn(
            buttonVariants({ tone: "primary", size: "compact" }),
            "min-w-0 flex-1 justify-center",
          )}
          disabled={!canConfirm}
          onClick={() => void state.confirm()}
        >
          {busy ? "적용 중..." : "선택 완료"}
        </button>
      </div>
    </CanvasDialog>
  );
}

/** Multi-select instrument picker for profile edit and onboarding. */
export function ProfileInstrumentDialog({
  value,
  onConfirm,
  onClose,
  allowEmpty = true,
  subtitle = "프로필에 표시할 악기나 보컬 파트를 여러 개 선택할 수 있어요.",
}: {
  value: string;
  onConfirm: (formatted: string) => void;
  onClose: () => void;
  allowEmpty?: boolean;
  subtitle?: string;
}) {
  const titleId = useId();
  const parsed = parseProfileInstruments(value);
  const [selectedIds, setSelectedIds] = useState<string[]>(parsed.selectedIds);
  const [customLabels, setCustomLabels] = useState<string[]>(parsed.customLabels);
  const totalCount = selectedIds.length + customLabels.length;
  const toggle = (id: string) => {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  };
  const canConfirm = allowEmpty || totalCount > 0;
  return (
    <CanvasDialog className={sharedStyles.instrumentDialog} titleId={titleId} onClose={onClose}>
      <div className="flex items-center justify-between gap-2">
        <h2 id={titleId}>악기 선택</h2>
        {totalCount > 0 && (
          <button
            type="button"
            className="text-caption font-medium text-app-muted underline hover:text-app-fg"
            onClick={() => {
              setSelectedIds([]);
              setCustomLabels([]);
            }}
          >
            전체 해제
          </button>
        )}
      </div>
      <p>
        {subtitle} ({totalCount}개 선택)
      </p>
      <div
        role="group"
        aria-label="악기"
        className="scrollbar-dark grid min-h-0 max-h-[320px] flex-1 gap-4 overflow-y-auto overscroll-contain pr-1"
      >
        {instrumentGroups.map((group) => (
          <fieldset key={group.id}>
            <legend>{group.label}</legend>
            <div className="flex flex-wrap gap-2">
              {group.instruments.map((id) => {
                const checked = selectedIds.includes(id);
                return (
                  <button
                    key={id}
                    type="button"
                    role="checkbox"
                    aria-checked={checked}
                    onClick={() => toggle(id)}
                  >
                    {partLabel(id)}
                  </button>
                );
              })}
            </div>
          </fieldset>
        ))}
      </div>
      <div className="flex shrink-0 gap-2">
        <button
          type="button"
          className={cn(
            buttonVariants({ tone: "secondary", size: "compact" }),
            "shrink-0 justify-center px-4",
          )}
          onClick={onClose}
        >
          취소
        </button>
        <button
          type="button"
          className={cn(
            buttonVariants({ tone: "primary", size: "compact" }),
            "min-w-0 flex-1 justify-center",
          )}
          disabled={!canConfirm}
          onClick={() => {
            onConfirm(formatProfileInstruments(selectedIds, customLabels));
            onClose();
          }}
        >
          선택 완료
        </button>
      </div>
    </CanvasDialog>
  );
}
