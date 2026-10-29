"use client";

import { useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { ArrowLeft, Check, ChevronLeft, ChevronRight, Copy, Eraser, HelpCircle, Music2, Pause, Pencil, Piano, Play, Redo2, SkipBack, Trash2, Undo2, Volume2, Scan, ClipboardPaste } from "lucide-react";
import type { MidiNoteDto } from "@/lib/api/composition";
import { clamp, copyNotes, moveNotes, pasteNotes, type NoteBounds } from "./note-editing";
import { drumPitches, moveDrumNotes } from "./drum-kit";
import { PianoRollGrid, type EditorMode } from "./piano-roll-grid";
import type { NoteHistory } from "./use-note-history";

const time = (ms: number) => `${String(Math.floor(ms / 60000)).padStart(2, "0")}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}`;
export function PianoRollStudio({ notes, history, editable, ppq, maxTick, bpm, positionMs, maxDurationMs, onSeek,
  initialPitch, percussion, revealNote, instrument, playing, onPlay, onPause, onAudition, volume, onVolume,
  onBack, onSave, saveDisabled, busy, status, actions, children }: {
  notes: MidiNoteDto[]; history: NoteHistory; editable: boolean; ppq: number; maxTick: number; bpm: number;
  positionMs: number; maxDurationMs: number; onSeek: (ms: number) => void; initialPitch: number; percussion: boolean;
  revealNote?: { pitch: number; startTick: number } | null; instrument: string; playing: boolean;
  onPlay: () => void; onPause: () => void; onAudition: (pitch: number) => void; volume: number; onVolume: (volume: number) => void;
  onBack: () => void; onSave: () => void; saveDisabled: boolean; busy: boolean;
  status: ReactNode; actions: ReactNode; children: ReactNode;
}) {
  const [selected, setSelected] = useState(new Set<number>());
  const [clipboard, setClipboard] = useState<MidiNoteDto[]>([]);
  const [mode, setMode] = useState<EditorMode>("select");
  const [expandedDrums, setExpandedDrums] = useState(false);
  const pitches = useMemo(() => percussion ? drumPitches(expandedDrums) : Array.from({ length: 128 }, (_, i) => 127 - i), [percussion, expandedDrums]);
  const hiddenDrumNotes = percussion ? notes.filter(note => !pitches.includes(note.pitch)).length : 0;
  const shownIndices = notes.flatMap((note, index) => pitches.includes(note.pitch) ? [index] : []);
  const [snap, setSnap] = useState(.5);
  const [zoom, setZoom] = useState(2);
  const [viewStart, setViewStart] = useState(0);
  const [lastReveal, setLastReveal] = useState(revealNote);
  const helpDialog = useRef<HTMLDialogElement>(null);
  const [message, setMessage] = useState("");
  const bounds: NoteBounds = { maxTick, minPitch: percussion ? 35 : 0, maxPitch: percussion ? 81 : 127 };
  const stepTick = Math.max(1, Math.round(ppq * snap));
  const visibleTicks = Math.min(zoom * 4 * ppq, maxTick);
  const positionTick = clamp(positionMs * bpm * ppq / 60_000, 0, maxTick);
  const tickToMs = (tick: number) => tick * 60_000 / (bpm * ppq);
  const activity = useMemo(() => Array.from({ length: 150 }, (_, i) => {
    const tick = i / 150 * maxTick;
    const active = notes.filter(n => n.startTick <= tick && n.startTick + n.durationTick > tick);
    return Math.min(46, 4 + active.length * 7 + (active.length ? Math.max(...active.map(n => n.velocity)) / 8 : 0));
  }), [notes, maxTick]);
  const visibleSelection = new Set([...selected].filter(index => index < notes.length && pitches.includes(notes[index].pitch)));
  const hasSelection = visibleSelection.size > 0;
  if (lastReveal !== revealNote) {
    setLastReveal(revealNote);
    if (revealNote && (revealNote.startTick < viewStart || revealNote.startTick >= viewStart + visibleTicks)) {
      setViewStart(clamp(Math.floor(revealNote.startTick / (ppq * 4)) * ppq * 4, 0, maxTick - visibleTicks));
    }
  }
  if (playing && (positionTick < viewStart || positionTick >= viewStart + visibleTicks)) {
    const nextView = clamp(Math.floor(positionTick / visibleTicks) * visibleTicks, 0, maxTick - visibleTicks);
    if (nextView !== viewStart) setViewStart(nextView);
  }
  function commit(next: MidiNoteDto[]) { if (editable) history.apply(next); }
  function removeSelected() {
    if (!editable || !hasSelection) return;
    onPause(); history.apply(notes.filter((_, index) => !visibleSelection.has(index))); setSelected(new Set()); setMessage("선택한 노트를 지웠어요");
  }
  function copy() { if (!hasSelection) return; setClipboard(copyNotes(notes, visibleSelection)); setMessage(`${visibleSelection.size}개 노트를 복사했어요`); }
  function paste(duplicate = false) {
    if (!editable) return;
    const data = duplicate ? copyNotes(notes, visibleSelection) : clipboard;
    if (!data.length) return;
    const at = duplicate ? Math.max(...notes.filter((_, index) => visibleSelection.has(index)).map(n => n.startTick + n.durationTick))
      : Math.round(positionTick / stepTick) * stepTick;
    const result = pasteNotes(notes, data, at, bounds);
    if (result === notes) { setMessage("뒤쪽에 붙여넣을 빈 구간이 없어요. 위치나 노트 길이를 확인해 주세요."); return; }
    onPause(); history.apply(result);
    setSelected(new Set(result.slice(notes.length).map((_, index) => notes.length + index)));
    const first = Math.min(...result.slice(notes.length).map(n => n.startTick));
    if (first < viewStart || first >= viewStart + visibleTicks) setViewStart(clamp(Math.floor(first / (ppq * 4)) * ppq * 4, 0, maxTick - visibleTicks));
    setMessage(first > at ? `겹치지 않는 뒤쪽 빈 구간에 ${data.length}개 노트를 붙여넣었어요` : `${data.length}개 노트를 ${duplicate ? "복제" : "붙여넣기"}했어요`);
  }
  function undo() { if (!editable) return; onPause(); history.undo(); setSelected(new Set()); }
  function redo() { if (!editable) return; onPause(); history.redo(); setSelected(new Set()); }
  function selectAll() { setMode("select"); setSelected(visibleSelection.size === shownIndices.length ? new Set() : new Set(shownIndices)); }
  function keyDown(event: KeyboardEvent) {
    if ((event.target as Element).closest("input,select,textarea,dialog,[role=dialog]")) return;
    const key = event.key.toLowerCase(), mod = event.metaKey || event.ctrlKey;
    if (event.key === "Escape") { setSelected(new Set()); helpDialog.current?.close(); return; }
    if (event.code === "Space") { event.preventDefault(); if (playing) onPause(); else onPlay(); return; }
    if (mod && ["a", "c", "v", "d", "z", "y"].includes(key)) {
      event.preventDefault();
      if (key === "a") selectAll(); if (key === "c") copy();
      if (key === "v") paste(); if (key === "d") paste(true);
      if (key === "z") { if (event.shiftKey) redo(); else undo(); } if (key === "y") redo();
      return;
    }
    if (!editable) return;
    if (["Delete", "Backspace"].includes(event.key)) { event.preventDefault(); removeSelected(); }
    if (hasSelection && ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) {
      event.preventDefault(); onPause();
      const ticks = event.key === "ArrowLeft" ? -stepTick : event.key === "ArrowRight" ? stepTick : 0;
      const rows = event.key === "ArrowUp" ? -1 : event.key === "ArrowDown" ? 1 : 0;
      const next = percussion ? moveDrumNotes(notes, visibleSelection, ticks, rows, pitches, bounds)
        : moveNotes(notes, visibleSelection, ticks, -rows, bounds);
      history.apply(next);
    }
  }
  function changeView(next: number) { onPause(); const start = clamp(next, 0, maxTick - visibleTicks); setViewStart(start); onSeek(tickToMs(start)); }
  const endBar = Math.ceil((viewStart + visibleTicks) / (ppq * 4));
  return <section aria-label="레이어 스튜디오" className={`piano-studio ${percussion ? `percussion-studio ${expandedDrums ? "" : "basic-drums"}` : ""}`} onKeyDown={keyDown}>
    <header className="topbar"><div className="heading">
      <button className="icon-btn back" onClick={onBack} disabled={busy} aria-label="작곡 화면으로 돌아가기"><ArrowLeft /></button>
      <span className="brand"><i />LAYER<span>STUDIO</span></span><h1>레이어 만들기</h1>
      <span className="save-status">{status}</span>
    </div><div className="header-actions">{actions}<button className="icon-btn help" aria-label="사용 방법" onClick={() => helpDialog.current?.showModal()}><HelpCircle /></button>
      <button className="publish" onClick={onSave} disabled={saveDisabled}><Check />{busy ? "저장 중…" : "저장"}</button>
    </div></header>
    {children}
    <section className="overview panel" aria-label="곡 전체 타임라인"><div className="overview-info"><span className="eyebrow">YOUR LITTLE MASTERPIECE</span>
      <div className="time"><strong>{time(positionMs)}</strong><span>/ {time(maxDurationMs)}</span></div><span className="timeline-caption">전체 곡 · {Math.ceil(maxTick / (ppq * 4))}마디</span></div>
      <div className="wave-wrap"><div className="wave" role="slider" tabIndex={0} aria-label="전체 곡 재생 위치" aria-valuemin={0} aria-valuemax={maxDurationMs} aria-valuenow={Math.round(positionMs)}
        onPointerDown={event => {
          const rect = event.currentTarget.getBoundingClientRect();
          const tick = clamp((event.clientX - rect.left) / rect.width * maxTick, 0, maxTick);
          onSeek(tickToMs(tick)); setViewStart(clamp(Math.floor(tick / (ppq * 4)) * ppq * 4, 0, maxTick - visibleTicks));
        }} onKeyDown={event => {
          if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
          event.preventDefault(); event.stopPropagation();
          const tick = event.key === "Home" ? 0 : event.key === "End" ? maxTick : clamp(positionTick + (event.key === "ArrowRight" ? ppq * 4 : -ppq * 4), 0, maxTick);
          onSeek(tickToMs(tick)); setViewStart(clamp(Math.floor(tick / (ppq * 4)) * ppq * 4, 0, maxTick - visibleTicks));
        }}>
        <svg viewBox="0 0 900 52" preserveAspectRatio="none" aria-hidden="true">{activity.map((height, i) =>
          <rect key={i} x={i * 6} y={26 - height / 2} width={3.8} height={height} rx={1} fill={i / 150 * maxTick < positionTick ? "#7040c9" : "#494150"} />)}</svg>
        <div className="wave-window" style={{ left: `${viewStart / maxTick * 100}%`, width: `${visibleTicks / maxTick * 100}%` }} />
        <div className="wave-head" style={{ left: `${positionTick / maxTick * 100}%` }} />
      </div><div className="wave-labels">{[0, .25, .5, .75, 1].map(n => <span key={n}>{time(maxDurationMs * n)}</span>)}</div></div>
    </section>
    <section className="parameter-row" aria-label="곡 설정"><div className="parameter tempo"><span className="param-icon">♩</span><span>템포</span><strong>{bpm}</strong><span className="muted">BPM</span></div>
      <div className="parameter"><Music2 /><span>박자표</span><strong>4/4</strong></div><span className="project-settings">곡의 설정을 사용하고 있어요</span>
    </section>
    <section className="editor panel" aria-label="피아노롤 편집기"><div className="editor-heading"><div><span className="live-dot" />{percussion ? "드럼 편집기" : "피아노롤"}<span className="edit-caption">PIANO ROLL</span></div>
      <div className="view-controls"><button className="small-icon" aria-label="이전 구간" disabled={viewStart <= 0} onClick={() => changeView(viewStart - visibleTicks)}><ChevronLeft /></button>
        <span>{String(Math.floor(viewStart / (ppq * 4)) + 1).padStart(2, "0")} — {String(endBar).padStart(2, "0")}</span>
        <button className="small-icon" aria-label="다음 구간" disabled={viewStart + visibleTicks >= maxTick} onClick={() => changeView(viewStart + visibleTicks)}><ChevronRight /></button>
        <select aria-label="표시할 마디 수" value={zoom} onChange={event => { const next = Number(event.target.value); setZoom(next); setViewStart(clamp(viewStart, 0, Math.max(0, maxTick - next * 4 * ppq))); }}>{[1, 2, 4].map(n => <option value={n} key={n}>{n}마디</option>)}</select>
      </div></div>
      {percussion && <div className="drum-kit-bar"><span>{expandedDrums ? "전체 타악기 · 47개" : "기본 드럼 · 11개"}</span>
        <button aria-pressed={expandedDrums} onClick={() => { onPause(); setSelected(new Set()); setExpandedDrums(!expandedDrums); }}>
          {expandedDrums ? "기본 키트" : "전체 타악기"}{hiddenDrumNotes > 0 && <span className="drum-extra-count">다른 타악기 노트 {hiddenDrumNotes}개</span>}
        </button></div>}
      <PianoRollGrid notes={notes} pitches={pitches} onCommit={commit} selected={visibleSelection} onSelect={setSelected} mode={mode}
        stepTick={stepTick} minTick={Math.max(1, Math.round(ppq / 4))} ppq={ppq} bounds={bounds} viewStart={viewStart} visibleTicks={visibleTicks}
        positionTick={positionTick} onSeek={tick => onSeek(tickToMs(tick))} initialPitch={initialPitch} editable={editable} percussion={percussion}
        revealNote={revealNote} onEditStart={onPause} onAudition={onAudition}
        onViewStart={tick => { onPause(); setViewStart(clamp(Math.round(tick), 0, maxTick - visibleTicks)); }} />
      <div className="selection-bar"><div className="selection-info"><span>{hasSelection ? `${visibleSelection.size}개 선택됨` : "노트 선택"}</span>
        <span>{hasSelection ? "드래그로 함께 이동 · 오른쪽 끝으로 길이 조절" : mode === "draw" ? "빈 곳을 탭해 추가 · 끌어서 길이 지정" : mode === "erase" ? "노트를 탭하거나 쓸어서 삭제" : "탭으로 선택 · 드래그로 영역 선택"}</span></div>
        <div className="selection-actions"><button onClick={selectAll} disabled={!shownIndices.length} title="전체 선택 (⌘/Ctrl+A)">{visibleSelection.size === shownIndices.length && shownIndices.length ? "선택 해제" : "전체 선택"}</button>
          <button disabled={!hasSelection} onClick={copy} title="복사 (⌘/Ctrl+C)"><Copy /><span>복사</span></button>
          <button disabled={!editable || !clipboard.length} onClick={() => paste()} title="재생 위치에 붙여넣기 (⌘/Ctrl+V)"><ClipboardPaste /><span>붙여넣기</span></button>
          <button disabled={!editable || !hasSelection} onClick={() => paste(true)} title="선택 노트 뒤에 복제 (⌘/Ctrl+D)">복제</button>
          <button disabled={!editable || !hasSelection} onClick={removeSelected} aria-label="선택 노트 삭제"><Trash2 /></button>
        </div></div>
    </section>
    <section className="transport" aria-label="재생 설정"><div className="instrument panel"><Piano /><span><strong>{instrument}</strong><small>현재 레이어 악기</small></span></div>
      <div className="playback"><button className="restart" aria-label="처음부터 재생" onClick={() => { onSeek(0); if (playing) onPlay(); }}><SkipBack /></button>
        <button className="play" aria-label={playing ? "일시 정지" : "재생"} onClick={playing ? onPause : onPlay}>{playing ? <Pause /> : <Play fill="currentColor" />}</button>
      </div>
      <div className="volume panel"><Volume2 /><label htmlFor="piano-studio-volume">음량</label><input id="piano-studio-volume" aria-label="마스터 볼륨" type="range" min={0} max={100} value={volume} onChange={event => onVolume(Number(event.target.value))} /><output>{volume}%</output></div>
    </section>
    <footer className="toolbar panel"><div className="modes">{([{ id: "draw", label: "그리기", Icon: Pencil }, { id: "select", label: "선택", Icon: Scan }, { id: "erase", label: "지우기", Icon: Eraser }] as const).map(({ id, label, Icon }) =>
      <button key={id} className={mode === id ? "active" : ""} aria-pressed={mode === id} disabled={!editable && id !== "select"} onClick={() => setMode(id)}><Icon />{label}</button>)}</div>
      <div className="toolbar-right"><label className="snap">스냅<select aria-label="노트 스냅 간격" value={snap} onChange={event => setSnap(Number(event.target.value))} disabled={!editable}><option value={1}>1/4</option><option value={.5}>1/8</option><option value={.25}>1/16</option></select></label><span className="divider" />
        <button className="icon-btn" disabled={!editable || !history.canUndo} onClick={undo} aria-label="실행 취소"><Undo2 /></button><button className="icon-btn" disabled={!editable || !history.canRedo} onClick={redo} aria-label="다시 실행"><Redo2 /></button>
      </div></footer>
    <div className="bottom-caption"><span><span className="dot" />나만의 한 레이어, 함께 완성하는 한 곡.</span><button onClick={() => helpDialog.current?.showModal()}>사용 방법</button></div>
    <p className="edit-message" role="status" aria-live="polite">{message}</p>
    <dialog className="help-card panel" ref={helpDialog} aria-labelledby="piano-help-title" onClick={event => {
      if (event.target !== event.currentTarget) return;
      const rect = event.currentTarget.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) helpDialog.current?.close();
    }}>
      <h2 id="piano-help-title">아이디어를 노트로.</h2><p>선택 모드에서 노트를 차례로 탭하거나, 빈 영역을 드래그해 여러 노트를 선택하세요.</p><p>선택한 노트 하나를 끌면 함께 움직입니다. 오른쪽 끝을 끌면 길이가 바뀝니다.</p><p>그리기 모드에서 탭하면 스냅 길이의 음을 추가하고, 드래그하면 길이를 정할 수 있습니다.</p><p>복사 후 위쪽 눈금으로 위치를 정하고 붙여넣으세요. 복제는 선택한 음 뒤에 바로 추가합니다.</p><p className="shortcuts">⌘ / Ctrl + A · C · V · D · Z<br />방향키 이동 · Space 재생 · Delete 삭제</p><button className="primary wide" autoFocus onClick={() => helpDialog.current?.close()}>만들어 볼게요</button>
    </dialog>
  </section>;
}
