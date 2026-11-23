import { useId, useState } from "react";
import { CanvasDialog } from "@/components/canvas-dialog";
import { Dropdown } from "@/components/dropdown";
import { cn } from "@/lib/utils";
import { sharedStyles } from "@/styles/shared.styles";
import { buttonVariants } from "@/styles/variants";
import {
  chordDurationTick, chordFits, chordGridTick, chordLengths, chordRoots, chordQualities, insertChord,
  type ChordLength, type ChordQuality,
} from "./chord-input";
import type { NoteEditorController } from "./use-note-editor";
import type { TimeSignature } from "./time-signature";

const octaveOptions = Array.from({ length: 10 }, (_, i) => ({ value: i - 1, label: String(i - 1) }));

/**
 * Inserts the chosen chord at the snapped playhead through the editor (its rules, history and draft).
 * Returns null on success, else the dialog's error message.
 */
export function placeChord(editor: NoteEditorController, choice: {
  ppq: number; signature: TimeSignature; positionTick: number;
  octave: number; root: number; length: ChordLength; quality: ChordQuality;
}): string | null {
  const result = insertChord(editor.snapshot.notes, {
    rootPitch: (choice.octave + 1) * 12 + choice.root,
    quality: choice.quality,
    startTick: chordGridTick(choice.positionTick, editor.bounds.stepTick),
    durationTick: chordDurationTick(choice.length, choice.ppq, choice.signature),
    maxTick: editor.bounds.maxTick,
  });
  if (result.reason) return result.reason === 'overlap' ? '기존 노트와 겹칩니다.' : '코드가 허용 범위를 벗어납니다.';
  if (editor.execute({type:'insert',notes:result.notes.slice(editor.snapshot.notes.length)})) return null;
  return '코드를 삽입하지 못했습니다. 노트 범위와 겹침을 확인해주세요.';
}

export function ChordPickerDialog({ editor, ppq, signature, positionTick, onClose }: {
  editor: NoteEditorController; ppq: number; signature: TimeSignature; positionTick: number; onClose: () => void;
}) {
  const id = useId();
  const [octave, setOctave] = useState(4);
  const [root, setRoot] = useState(0);
  const [length, setLength] = useState<ChordLength>("eighth");
  const [error, setError] = useState<string | null>(null);
  const rootPitch = (octave + 1) * 12 + root;
  const allowed = (quality: ChordQuality) => editor.editable && chordFits(rootPitch, quality, editor.bounds);
  function choose(quality: ChordQuality) {
    const failure = placeChord(editor, { ppq, signature, positionTick, octave, root, length, quality });
    if (failure) setError(failure);
    else onClose();
  }
  return <CanvasDialog titleId={id} onClose={onClose} className={sharedStyles.instrumentDialog}>
    <h2 id={id}>코드 입력</h2>
    <div className="flex flex-wrap gap-3">
      <div className="flex items-center gap-2 text-caption">
        <span>옥타브</span>
        <Dropdown label="코드 옥타브" compact value={octave} options={octaveOptions} onChange={setOctave} />
      </div>
      <div className="flex items-center gap-2 text-caption">
        <span>길이</span>
        <Dropdown label="코드 길이" compact value={length} options={chordLengths} onChange={setLength} />
      </div>
    </div>
    <div className="my-3 grid grid-cols-6 gap-2" aria-label="코드 근음">
      {chordRoots.map((item, index) => (
        <button
          type="button"
          key={item.name}
          className="h-9 rounded-[10px] border border-[#32323d] bg-[#23232a] text-caption font-medium text-app-fg transition-colors aria-pressed:border-app-primary aria-pressed:bg-app-primary aria-pressed:text-white"
          aria-pressed={root === index}
          onClick={() => setRoot(index)}
        >
          {item.name}{item.alternate ? `/${item.alternate}` : ""}
        </button>
      ))}
    </div>
    <div className="grid grid-cols-3 gap-2">
      {chordQualities.map((quality) => (
        <button
          type="button"
          className="h-10 rounded-[10px] border border-[#32323d] bg-[#23232a] px-2 text-body font-medium text-app-fg transition-colors hover:border-app-primary hover:bg-app-primary/20 disabled:opacity-40"
          key={quality.id}
          disabled={!allowed(quality.id)}
          onClick={() => choose(quality.id)}
          title={quality.label}
        >
          {chordRoots[root].name}{quality.suffix || " major"}
        </button>
      ))}
    </div>
    {(error || editor.error) && <p role="alert">{error ?? editor.error}</p>}
    <button
      type="button"
      className={cn(buttonVariants({ tone: "secondary", size: "compact" }), "w-full justify-center")}
      onClick={onClose}
    >
      취소
    </button>
  </CanvasDialog>;
}
