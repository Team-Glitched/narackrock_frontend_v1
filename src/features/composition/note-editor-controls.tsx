import type { NoteEditorController } from "./use-note-editor";

// Pressed toggles must look different from idle ones; aria-pressed alone is invisible.
const toggle = "shrink-0 rounded border border-app-line px-2 py-1 text-app-muted aria-pressed:border-app-primary aria-pressed:bg-app-primary aria-pressed:font-bold aria-pressed:text-app-fg";

export function NoteEditorControls({ editor, positionTick = 0, onChord, onSettings }: {
  editor: NoteEditorController;
  positionTick?: number;
  onChord?: () => void;
  onSettings?: () => void;
}) {
  const { view, bounds, selection } = editor;
  const hidden = editor.snapshot.notes.filter((note) => !bounds.rows.includes(note.pitch)).length;
  return (
    <div className="flex w-full shrink-0 gap-2 overflow-x-auto border-b border-app-line bg-app-panel p-2 text-label" role="toolbar" aria-label="노트 편집 도구">
      {([['draw', '그리기'], ['select', '선택'], ['erase', '지우개'], ['pan', '이동']] as const).map(([tool, label]) => (
        <button className={toggle} key={tool} aria-pressed={view.tool === tool} onClick={() => editor.setTool(tool)}>{label}</button>
      ))}
      <button className="shrink-0" disabled={!editor.editable || !editor.canUndo} onClick={editor.undo}>실행 취소</button>
      <button className="shrink-0" disabled={!editor.editable || !editor.canRedo} onClick={editor.redo}>다시 실행</button>
      <label className="flex shrink-0 items-center gap-1">스냅<select aria-label="스냅" value={view.snapDenominator} onChange={(event) => editor.setSnapDenominator(Number(event.target.value) as 4 | 8 | 16)}>{[4, 8, 16].map((n) => <option key={n} value={n}>1/{n}</option>)}</select></label>
      <label className="flex shrink-0 items-center gap-1">표시 마디<select aria-label="표시 마디" value={view.visibleBars} onChange={(event) => editor.setVisibleBars(Number(event.target.value) as 1 | 2 | 4)}>{[1, 2, 4].map((n) => <option key={n} value={n}>{n}</option>)}</select></label>
      <button className="shrink-0" disabled={view.viewStartTick <= 0} onClick={() => editor.setViewStartTick(view.viewStartTick - editor.windowTicks)}>이전 구간</button>
      <button className="shrink-0" disabled={view.viewStartTick >= Math.max(0, bounds.maxTick - editor.windowTicks)} onClick={() => editor.setViewStartTick(view.viewStartTick + editor.windowTicks)}>다음 구간</button>
      <button className="shrink-0" onClick={editor.selectAll}>전체 선택</button>
      <button className="shrink-0" onClick={editor.clearSelection}>선택 해제</button>
      <output className="shrink-0" aria-live="polite">{selection.length}개 선택</output>
      <button className="shrink-0" disabled={!selection.length} onClick={editor.copy}>복사</button>
      <button className="shrink-0" disabled={!editor.editable || !editor.hasClipboard} onClick={() => editor.paste(positionTick)}>붙여넣기</button>
      <button className="shrink-0" disabled={!editor.editable || !selection.length} onClick={editor.duplicate}>복제</button>
      <button className="shrink-0" disabled={!editor.editable || !selection.length} onClick={() => editor.execute({ type: 'delete', indices: selection })}>삭제</button>
      {onSettings && <button className="shrink-0" disabled={!editor.editable || selection.length !== 1} onClick={onSettings}>노트 설정</button>}
      {onChord && <button className="shrink-0" disabled={!editor.editable || bounds.minPitch === 35 && bounds.maxPitch === 81} onClick={onChord}>코드 입력</button>}
      {bounds.minPitch === 35 && bounds.maxPitch === 81 && <><button className={toggle} aria-pressed={view.expandedDrums} onClick={() => editor.setExpandedDrums(!view.expandedDrums)}>{view.expandedDrums ? '기본 키트' : '전체 키트'}</button><span className="shrink-0">숨은 노트 {hidden}개</span></>}
    </div>
  );
}
