import type { ReactNode } from "react";
import {
  ChevronLeft, ChevronRight, ClipboardPaste, Copy, CopyPlus, Drum, Eraser, Hand, ListChecks, Music,
  Magnet, Pencil, Redo2, SlidersHorizontal, SquareDashedMousePointer, Trash2, Undo2, X, type LucideIcon,
} from "lucide-react";
import { Dropdown } from "@/components/dropdown";
import { cn } from "@/lib/utils";
import type { NoteEditorController } from "./use-note-editor";

const tools: ReadonlyArray<[NoteEditorController["view"]["tool"], string, LucideIcon]> = [
  ["draw", "그리기", Pencil], ["select", "선택", SquareDashedMousePointer], ["erase", "지우개", Eraser], ["pan", "이동", Hand],
];
const iconButton =
  "grid h-7 w-[28px] shrink-0 place-items-center rounded-[8px] text-app-fg transition-colors hover:bg-[#2a2a33] disabled:pointer-events-none disabled:opacity-35";
const pill =
  "flex h-7 shrink-0 items-center gap-1 rounded-[8px] border border-[#32323d] bg-[#23232a] px-2 text-caption text-app-fg transition-colors";
const snapOptions = ([4, 8, 16] as const).map((value) => ({ value, label: `1/${value}` }));
const barsOptions = ([1, 2, 4] as const).map((value) => ({ value, label: `${value}마디` }));

function IconButton({ label, icon: Icon, className, ...props }: {
  label: string; icon: LucideIcon; className?: string; disabled?: boolean; onClick: () => void;
}) {
  return (
    <button type="button" className={cn(iconButton, className)} aria-label={label} title={label} {...props}>
      <Icon size={16} strokeWidth={2} aria-hidden="true" />
    </button>
  );
}
function Group({ label, children }: { label: string; children: ReactNode }) {
  return <div className="flex shrink-0 items-center gap-0.5" role="group" aria-label={label}>{children}</div>;
}
const Divider = () => <span className="mx-1 h-5 w-px shrink-0 bg-[#2e2e38]" aria-hidden="true" />;

/** The four edit tools with icon + name; the active one is filled so the current mode is obvious at a glance. */
export function NoteTools({ editor, large = false }: { editor: NoteEditorController; large?: boolean }) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center gap-0.5 rounded-[10px] border border-[#32323d] bg-[#23232a] p-0.5",
        large && "w-full gap-1 rounded-[12px] p-1",
      )}
      role="group"
      aria-label="편집 도구"
    >
      {tools.map(([tool, label, Icon]) => (
        <button
          type="button"
          key={tool}
          aria-pressed={editor.view.tool === tool}
          aria-label={label}
          title={label}
          onClick={() => editor.setTool(tool)}
          className={cn(
            "flex shrink-0 items-center rounded-[6px] text-app-muted hover:text-app-fg aria-pressed:bg-app-primary aria-pressed:font-bold aria-pressed:text-app-fg",
            large ? "h-10 flex-1 justify-center gap-1.5 rounded-[10px] text-label" : "h-6 gap-0.5 px-1.5",
          )}
        >
          <Icon size={large ? 18 : 13} strokeWidth={2.2} aria-hidden="true" />
          <span aria-hidden="true">{label}</span>
        </button>
      ))}
    </div>
  );
}

/**
 * Grouped strip sized to fit the 844px studio canvas: the tools (unless placed elsewhere) show icon + name;
 * every other control is an icon with its Korean name as aria-label/title. It scrolls horizontally if needed.
 */
export function NoteEditorControls({ editor, positionTick = 0, onChord, onSettings, tools: showTools = true, showModeAction = true }: {
  editor: NoteEditorController;
  positionTick?: number;
  onChord?: () => void;
  onSettings?: () => void;
  /** False when the layout shows `NoteTools` on its own. */
  tools?: boolean;
  /** False when the portrait header already renders chord or full-kit triggers. */
  showModeAction?: boolean;
}) {
  const { view, bounds, selection } = editor;
  const drum = bounds.minPitch === 35 && bounds.maxPitch === 81;
  const hidden = editor.snapshot.notes.filter((note) => !bounds.rows.includes(note.pitch)).length;
  const lastStart = Math.max(0, bounds.maxTick - editor.windowTicks);
  return (
    <div
      className="note-editor-controls flex w-full shrink-0 items-center gap-1 overflow-x-auto border-b border-[#2b2b34] bg-[#19191f] px-2 py-1.5 text-caption text-app-fg [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      role="toolbar"
      aria-label="노트 편집 도구"
    >
      {showTools && <><NoteTools editor={editor} /><Divider /></>}
      <Group label="실행 기록">
        <IconButton label="실행 취소" icon={Undo2} disabled={!editor.editable || !editor.canUndo} onClick={editor.undo} />
        <IconButton label="다시 실행" icon={Redo2} disabled={!editor.editable || !editor.canRedo} onClick={editor.redo} />
      </Group>
      <Divider />
      <Group label="격자와 구간">
        <Dropdown
          label="스냅"
          compact
          className="shrink-0"
          icon={<Magnet size={13} className="shrink-0 text-app-muted" aria-hidden="true" />}
          value={view.snapDenominator}
          options={snapOptions}
          onChange={editor.setSnapDenominator}
        />
        <Dropdown
          label="표시 마디"
          compact
          className="shrink-0"
          value={view.visibleBars}
          options={barsOptions}
          onChange={editor.setVisibleBars}
        />
        <IconButton label="이전 구간" icon={ChevronLeft} disabled={view.viewStartTick <= 0}
          onClick={() => editor.setViewStartTick(view.viewStartTick - editor.windowTicks)} />
        <IconButton label="다음 구간" icon={ChevronRight} disabled={view.viewStartTick >= lastStart}
          onClick={() => editor.setViewStartTick(view.viewStartTick + editor.windowTicks)} />
      </Group>
      <Divider />
      <Group label="선택한 노트">
        <output
          className={cn("min-w-9 shrink-0 rounded-[8px] px-1.5 py-1 text-center tabular-nums",
            selection.length ? "bg-app-primary font-bold text-white" : "text-app-muted")}
          aria-live="polite"
          aria-label={`${selection.length}개 선택`}
          title={`${selection.length}개 선택`}
        >
          {selection.length}개
        </output>
        <IconButton label="전체 선택" icon={ListChecks} onClick={editor.selectAll} />
        <IconButton label="선택 해제" icon={X} disabled={!selection.length} onClick={editor.clearSelection} />
        <IconButton label="복사" icon={Copy} disabled={!selection.length} onClick={editor.copy} />
        <IconButton label="붙여넣기" icon={ClipboardPaste} disabled={!editor.editable || !editor.hasClipboard}
          onClick={() => editor.paste(positionTick)} />
        <IconButton label="복제" icon={CopyPlus} disabled={!editor.editable || !selection.length} onClick={editor.duplicate} />
        <IconButton label="삭제" icon={Trash2} className="hover:text-[#ff8d8d]" disabled={!editor.editable || !selection.length}
          onClick={() => editor.execute({ type: "delete", indices: selection })} />
        {onSettings && (
          <IconButton label="노트 설정" icon={SlidersHorizontal} disabled={!editor.editable || selection.length !== 1}
            onClick={onSettings} />
        )}
      </Group>
      {showModeAction && (drum || onChord) && <Divider />}
      {showModeAction && drum ? (
        // A pressed toggle like the tools: filled while all 47 pads are shown. Hidden notes stay saved and playable.
        <button
          type="button"
          className={cn(pill, "text-app-fg aria-pressed:border-app-primary aria-pressed:bg-app-primary aria-pressed:font-bold aria-pressed:text-white")}
          aria-pressed={view.expandedDrums}
          aria-label={`전체 키트${hidden ? `, 숨은 노트 ${hidden}개` : ""}`}
          title={view.expandedDrums ? "기본 11패드로 돌아가기" : `전체 47패드 보기${hidden ? ` (숨은 노트 ${hidden}개)` : ""}`}
          onClick={() => editor.setExpandedDrums(!view.expandedDrums)}
        >
          <Drum size={14} aria-hidden="true" />
          전체 키트
          {hidden > 0 && <span className="rounded-full bg-app-bg px-1 tabular-nums text-app-muted" aria-hidden="true">+{hidden}</span>}
        </button>
      ) : showModeAction && onChord && (
        <button
          type="button"
          className={cn(pill, "text-app-fg hover:bg-app-primary disabled:pointer-events-none disabled:opacity-35")}
          disabled={!editor.editable}
          onClick={onChord}
          aria-label="코드 입력"
          title="코드 입력"
        >
          <Music size={14} aria-hidden="true" />
          코드
        </button>
      )}
    </div>
  );
}
