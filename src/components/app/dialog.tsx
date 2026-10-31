import { sharedStyles } from "@/styles/shared.styles";
import { abyssStyles } from "@/styles/abyss.styles";
import { communityStyles } from "@/styles/community.styles";
import { studioStyles } from "@/styles/studio.styles";
import { cn } from "@/lib/utils";
import { createPortal } from "react-dom";
import { Asset, Avatar } from "@/components/app/shared";
import { defaultSignature, type TimeSignature } from "@/features/composition/time-signature";
import type { MidiNoteDto } from "@/lib/api/composition";
import {
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
  type RefObject,
} from "react";
export function AppDialog({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const titleId = useId();
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className={sharedStyles.appDialog}
      aria-labelledby={titleId}
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className={abyssStyles.shortsSheetPanel}>
        <header>
          <h2 id={titleId}>{title}</h2>
          <button autoFocus aria-label="닫기" onClick={onClose}>
            닫기
          </button>
        </header>
        {children}
      </div>
    </dialog>
  );
}

const subscribeCanvas = () => () => {};
const dialogHost = () => document.querySelector<HTMLElement>(".design-canvas");
export function CanvasDialog({
  className,
  titleId,
  onClose,
  children,
}: {
  className: string;
  titleId: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const host = useSyncExternalStore(subscribeCanvas, dialogHost, () => null);
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    (
      panel.current?.querySelector<HTMLElement>("[autofocus], button, input") ?? panel.current
    )?.focus();
    return () => previous?.focus();
  }, [host]);
  if (!host) return null;
  return createPortal(
    <div className={sharedStyles.canvasDialogOverlay}>
      <button
        className={sharedStyles.canvasDialogBackdrop}
        aria-label="팝업 닫기"
        onClick={onClose}
      />
      <div
        ref={panel}
        className={className}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.stopPropagation();
            onClose();
          }
          if (event.key !== "Tab") return;
          const controls = [
            ...event.currentTarget.querySelectorAll<HTMLElement>(
              'button:not(:disabled), input:not(:disabled), [tabindex="0"]',
            ),
          ];
          const first = controls[0],
            last = controls[controls.length - 1];
          if (!first) {
            event.preventDefault();
            return;
          }
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
          }
        }}
      >
        {children}
      </div>
    </div>,
    host,
  );
}
export function InstrumentDialog({ onClose }: { onClose: () => void }) {
  const titleId = useId();
  return (
    <CanvasDialog className={sharedStyles.instrumentDialog} titleId={titleId} onClose={onClose}>
      <h2 id={titleId}>악기 선택</h2>
      <button autoFocus onClick={onClose}>
        피아노
      </button>
    </CanvasDialog>
  );
}
/** Figma Menu / Post User Actions, 15236:41267. */
export function AnchoredActionsMenu({
  anchorRef,
  onClose,
  label,
  height = 99,
  children,
}: {
  anchorRef: RefObject<HTMLButtonElement | null>;
  onClose: () => void;
  label: string;
  height?: number;
  children: ReactNode;
}) {
  const host = useSyncExternalStore(subscribeCanvas, dialogHost, () => null);
  const panel = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ left: 0, top: 0 });
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  }, [onClose]);
  useEffect(() => {
    const anchor = anchorRef.current;
    if (!host || !anchor) return;
    const place = () => {
      const h = host.getBoundingClientRect(),
        a = anchor.getBoundingClientRect();
      const scale = h.width / host.offsetWidth;
      const left = Math.max(8, Math.min((a.right - h.left) / scale - 260, host.offsetWidth - 268));
      const below = (a.bottom - h.top) / scale + 4;
      setPosition({
        left,
        top:
          below + height <= host.offsetHeight - 8
            ? below
            : Math.max(8, (a.top - h.top) / scale - height - 4),
      });
    };
    place();
    panel.current?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus();
    const outside = (event: PointerEvent) => {
      if (!panel.current?.contains(event.target as Node) && !anchor.contains(event.target as Node))
        close.current();
    };
    const scroll = (event: Event) => {
      if (!panel.current?.contains(event.target as Node)) close.current();
    };
    document.addEventListener("pointerdown", outside);
    window.addEventListener("resize", place);
    document.addEventListener("scroll", scroll, true);
    return () => {
      document.removeEventListener("pointerdown", outside);
      window.removeEventListener("resize", place);
      document.removeEventListener("scroll", scroll, true);
    };
  }, [host, anchorRef, height]);
  if (!host) return null;
  return createPortal(
    <div
      ref={panel}
      className={communityStyles.postUserActionsMenu}
      role="menu"
      aria-label={label}
      style={{ height, position: "absolute", zIndex: 60, ...position }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.stopPropagation();
          close.current();
          anchorRef.current?.focus();
        }
        if (event.key === "Tab") close.current();
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault();
          const buttons = Array.from(
            event.currentTarget.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"),
          );
          const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
          buttons[
            (index + (event.key === "ArrowDown" ? 1 : buttons.length - 1)) % buttons.length
          ]?.focus();
        }
      }}
    >
      {children}
    </div>,
    host,
  );
}
/** Figma Menu / Post User Actions and Post Admin Actions. */
export function PostUserActionsMenu({
  onReport,
  onHide,
  onClose,
  onEdit,
  onDelete,
  onModerateDelete,
  onSuspendMember,
  onExpelMember,
  anchorRef,
}: {
  anchorRef: RefObject<HTMLButtonElement | null>;
  onReport: () => void;
  onHide: () => void;
  onClose: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onModerateDelete?: () => void;
  onSuspendMember?: () => void;
  onExpelMember?: () => void;
}) {
  return (
    <AnchoredActionsMenu
      anchorRef={anchorRef}
      onClose={onClose}
      label="게시글 옵션"
      height={
        99 + (onModerateDelete ? 40 : 0) + (onSuspendMember ? 40 : 0) + (onExpelMember ? 40 : 0)
      }
    >
      {onEdit && onDelete && !onModerateDelete ? (
        <>
          <button role="menuitem" onClick={onEdit}>
            수정
          </button>
          <button role="menuitem" onClick={onDelete}>
            삭제
          </button>
        </>
      ) : (
        <>
          <button role="menuitem" onClick={onReport}>
            <Asset name="short-report.svg" />
            신고
          </button>
          <button role="menuitem" onClick={onHide}>
            <Asset name="post-hide.svg" />
            숨기기
          </button>
          {onModerateDelete && (
            <button role="menuitem" onClick={onModerateDelete}>
              <Asset name="admin-suspend.svg" />
              삭제
            </button>
          )}
        </>
      )}
      {onSuspendMember && (
        <button role="menuitem" onClick={onSuspendMember}>
          <Asset name="admin-suspend.svg" />
          작성자 이용정지
        </button>
      )}
      {onExpelMember && (
        <button role="menuitem" onClick={onExpelMember}>
          <Asset name="admin-expel.svg" />
          작성자 추방
        </button>
      )}
    </AnchoredActionsMenu>
  );
}
/** Figma V3 Dialog / Publish Confirmation (13488:31624). */
export function PublishConfirmation({
  onConfirm,
  onClose,
}: {
  onConfirm: () => void;
  onClose: () => void;
}) {
  const titleId = useId();
  return (
    <CanvasDialog className={sharedStyles.publishConfirmation} titleId={titleId} onClose={onClose}>
      <div>
        <h2 id={titleId}>정말로 올리시겠습니까?</h2>
        <button autoFocus onClick={onConfirm}>
          확인
        </button>
      </div>
    </CanvasDialog>
  );
}

/** Numeric fields commit on Enter or blur so multi-digit values can be typed freely. */
function DialogNumberInput({
  value,
  min,
  max,
  label,
  onChange,
  disabled = false,
}: {
  value: number;
  min: number;
  max?: number;
  label: string;
  onChange: (value: number) => void;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  function commit() {
    if (draft !== null && draft.trim() !== "" && Number.isFinite(Number(draft)))
      onChange(Math.min(max ?? Number.MAX_SAFE_INTEGER, Math.max(min, Math.round(Number(draft)))));
    setDraft(null);
  }
  return (
    <input
      className={sharedStyles.dialogNumberInput}
      type="number"
      inputMode="numeric"
      aria-label={label}
      min={min}
      max={max}
      step={1}
      disabled={disabled}
      value={draft ?? value}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          commit();
        }
        if (event.key === "Escape" && draft !== null) {
          event.stopPropagation();
          setDraft(null);
        }
      }}
    />
  );
}

/** Figma V3 Dialog / Volume (13488:30828). */
export function VolumeDialog({
  value,
  onChange,
  onClose,
  track,
}: {
  value: number;
  onChange: (value: number) => void;
  onClose: () => void;
  track?: { name: string; instrument: string | null };
}) {
  const titleId = useId();
  return (
    <CanvasDialog
      className={cn(sharedStyles.volumeDialog, track ? studioStyles.trackVolumeDialog : "")}
      titleId={titleId}
      onClose={onClose}
    >
      {track && (
        <div className={studioStyles.trackSettingsIdentity}>
          <span>
            <strong>{track.name}</strong>
            <small>
              {track.instrument === "piano" ? "피아노" : (track.instrument ?? "오디오")}
            </small>
          </span>
          <Avatar />
        </div>
      )}
      <h2 id={titleId}>음량</h2>
      <div className={sharedStyles.volumeDialogRow}>
        <span className={sharedStyles.volumeDialogIcon}>
          <Asset name="dialog-volume-sound.svg" />
        </span>
        <input
          autoFocus
          type="range"
          min={0}
          max={100}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
          aria-label="음량"
          aria-valuetext={`${value}%`}
          style={{
            background: `linear-gradient(to right, var(--white) ${value}%, var(--line-strong) ${value}%)`,
          }}
        />
        <DialogNumberInput
          value={value}
          min={0}
          max={100}
          label="음량 직접 입력"
          onChange={onChange}
        />
      </div>
    </CanvasDialog>
  );
}

/** Figma V3 13507:31697; uncontracted effects remain visible but unavailable. */
export function NoteSettingsDialog({
  note,
  stepTick,
  maxTick,
  instrument,
  onChange,
  onClose,
}: {
  note: MidiNoteDto;
  stepTick: number;
  maxTick: number;
  instrument: string | null;
  onChange: (note: MidiNoteDto) => void;
  onClose: () => void;
}) {
  const titleId = useId();
  const [instrumentOpen, setInstrumentOpen] = useState(false);
  const pitch = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"][note.pitch % 12];
  return (
    <CanvasDialog className={studioStyles.noteSettingsDialog} titleId={titleId} onClose={onClose}>
      <div className={studioStyles.noteSettingsIdentity}>
        <strong id={titleId}>Code : {pitch}</strong>
        <button
          className={sharedStyles.instrumentPickerTrigger}
          onClick={() => setInstrumentOpen(true)}
        >
          {instrument === "piano" ? "피아노" : (instrument ?? "MIDI")}
        </button>
      </div>
      {instrumentOpen && <InstrumentDialog onClose={() => setInstrumentOpen(false)} />}
      <label className={studioStyles.noteSettingsLength}>
        길이 :{" "}
        <input
          aria-label="노트 길이"
          type="number"
          min={1}
          max={Math.floor((maxTick - note.startTick) / stepTick)}
          value={Math.round(note.durationTick / stepTick)}
          onChange={(event) => {
            const durationTick = Math.max(
              stepTick,
              Math.min(maxTick - note.startTick, Number(event.target.value) * stepTick),
            );
            onChange({ ...note, durationTick });
          }}
        />
      </label>
      {[
        { label: "울림", disabled: true, value: 20 },
        { label: "음량", disabled: false, value: Math.round((note.velocity / 127) * 100) },
        { label: "일단 효과", disabled: true, value: 20 },
      ].map((control) => (
        <div className={studioStyles.noteSettingsControl} key={control.label}>
          <strong>{control.label}</strong>
          <div>
            <input
              autoFocus={!control.disabled}
              aria-label={control.disabled ? `${control.label} 기능 준비 중` : "노트 음량"}
              type="range"
              min={0}
              max={100}
              value={control.value}
              disabled={control.disabled}
              onChange={(event) =>
                onChange({
                  ...note,
                  velocity: Math.max(1, Math.round((Number(event.target.value) / 100) * 127)),
                })
              }
              style={{
                background: `linear-gradient(to right, var(--white) ${control.value}%, var(--line-strong) ${control.value}%)`,
              }}
            />
            {control.disabled ? (
              <output>{control.value}</output>
            ) : (
              <DialogNumberInput
                value={control.value}
                min={1}
                max={100}
                label="노트 음량 직접 입력"
                onChange={(value) =>
                  onChange({ ...note, velocity: Math.max(1, Math.round((value / 100) * 127)) })
                }
              />
            )}
          </div>
        </div>
      ))}
    </CanvasDialog>
  );
}

/** V3 tempo (15098:39655) and time signature (15098:39669). */
export function TimingDialog({
  bpm,
  beat = false,
  onChange,
  onClose,
  signature = defaultSignature,
  onSignature,
}: {
  signature?: TimeSignature;
  onSignature?: (value: TimeSignature) => void;
  bpm: number;
  beat?: boolean;
  onChange?: (value: number) => void;
  onClose: () => void;
}) {
  const titleId = useId();
  return (
    <CanvasDialog
      className={cn(sharedStyles.volumeDialog, "timing-dialog")}
      titleId={titleId}
      onClose={onClose}
    >
      <h2 id={titleId}>{beat ? "beat" : "bpm"}</h2>
      <div className={sharedStyles.volumeDialogRow}>
        {beat ? (
          <div className={sharedStyles.timeSignatureFields}>
            <DialogNumberInput
              value={signature.numerator}
              min={1}
              label="마디당 박 수"
              disabled={!onSignature}
              onChange={(numerator) => onSignature?.({ ...signature, numerator })}
            />
            <span>/</span>
            <DialogNumberInput
              value={signature.denominator}
              min={1}
              label="기준 음표"
              disabled={!onSignature}
              onChange={(denominator) => onSignature?.({ ...signature, denominator })}
            />
          </div>
        ) : (
          <>
            <input
              autoFocus
              aria-label="bpm"
              type="range"
              min={20}
              max={360}
              value={bpm}
              disabled={!onChange}
              onChange={(event) => onChange?.(Number(event.target.value))}
              style={{
                background: `linear-gradient(to right,var(--white) ${((bpm - 20) / 340) * 100}%,var(--line-strong) 0)`,
              }}
            />
            <DialogNumberInput
              value={bpm}
              min={20}
              max={360}
              label="BPM 직접 입력"
              disabled={!onChange}
              onChange={(value) => onChange?.(value)}
            />
          </>
        )}
      </div>
    </CanvasDialog>
  );
}
