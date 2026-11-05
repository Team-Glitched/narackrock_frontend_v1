import { useId, useState } from "react";
import { CanvasDialog } from "@/components/canvas-dialog";
import { sharedStyles } from "@/styles/shared.styles";
import { chordRoots, chordQualities, chordPitches, insertChord, type ChordQuality } from "./chord-input";
import type { NoteEditorController } from "./use-note-editor";
import type { TimeSignature } from "./time-signature";

export function ChordPickerDialog({ editor, ppq, signature, positionTick, onClose }: {
  editor: NoteEditorController; ppq: number; signature: TimeSignature; positionTick: number; onClose: () => void;
}) {
  const id = useId();
  const [octave, setOctave] = useState(4);
  const [root, setRoot] = useState(0);
  const [length, setLength] = useState('eighth');
  const [error, setError] = useState<string | null>(null);
  const durationTick = Math.max(1, Math.round(length === 'bar' ? ppq * 4 * signature.numerator / signature.denominator : ppq * (length === 'half' ? 2 : length === 'quarter' ? 1 : 0.5)));
  const rootPitch = (octave + 1) * 12 + root;
  const grid = positionTick / editor.bounds.stepTick;
  const snapped = Math.abs(grid - Math.round(grid)) <= 1e-9 ? Math.round(grid) : Math.floor(grid);
  const startTick = Math.max(0, snapped * editor.bounds.stepTick);
  const allowed = (quality: ChordQuality) => {
    const pitches = chordPitches(rootPitch, quality);
    return editor.editable && pitches.length > 0 && pitches.every((pitch) => pitch >= editor.bounds.minPitch && pitch <= editor.bounds.maxPitch) && !(editor.bounds.minPitch === 35 && editor.bounds.maxPitch === 81);
  };
  function choose(quality: ChordQuality) {
    const result = insertChord(editor.snapshot.notes, {rootPitch,quality,startTick,durationTick,maxTick:editor.bounds.maxTick});
    if (result.reason) { setError(result.reason === 'overlap' ? '기존 노트와 겹칩니다.' : '코드가 허용 범위를 벗어납니다.'); return; }
    if (editor.execute({type:'insert',notes:result.notes.slice(editor.snapshot.notes.length)})) onClose();
    else setError('코드를 삽입하지 못했습니다. 노트 범위와 겹침을 확인해주세요.');
  }
  return <CanvasDialog titleId={id} onClose={onClose} className={sharedStyles.instrumentDialog}>
    <h2 id={id}>코드 입력</h2>
    <div className="flex flex-wrap gap-3">
      <label>옥타브<select aria-label="코드 옥타브" value={octave} onChange={(event) => setOctave(Number(event.target.value))}>{Array.from({length:10}, (_, i) => i - 1).map((n) => <option key={n} value={n}>{n}</option>)}</select></label>
      <label>길이<select aria-label="코드 길이" value={length} onChange={(event) => setLength(event.target.value)}><option value="eighth">1/8</option><option value="quarter">1/4</option><option value="half">1/2</option><option value="bar">한 마디</option></select></label>
    </div>
    <div className="my-3 grid grid-cols-6 gap-2" aria-label="코드 근음">{chordRoots.map((item, index) => <button key={item.name} aria-pressed={root === index} onClick={() => setRoot(index)}>{item.name}{item.alternate ? `/${item.alternate}` : ''}</button>)}</div>
    <div className="grid grid-cols-3 gap-2">{chordQualities.map((quality) => <button className="rounded border p-2 disabled:opacity-40" key={quality.id} disabled={!allowed(quality.id)} onClick={() => choose(quality.id)} title={quality.label}>{chordRoots[root].name}{quality.suffix || ' major'}</button>)}</div>
    {(error || editor.error) && <p role="alert">{error ?? editor.error}</p>}
    <button onClick={onClose}>취소</button>
  </CanvasDialog>;
}
