import { useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/styles/variants";
import { validateNotes } from "./note-editing";
import { positionJsonNotes, readJsonNotes } from "./json-note-import";
import type { NoteEditorController } from "./use-note-editor";

export function JsonNoteImportControl({ editor, ppq, onAdded }: {
  editor: NoteEditorController;
  ppq: number;
  onAdded: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const [reading, setReading] = useState(false);

  async function select(file: File) {
    setReading(true);
    setError("");
    try {
      const imported = await readJsonNotes(file);
      const existing = editor.snapshot.notes;
      const afterTick = existing.reduce((end, note) => Math.max(end, note.startTick + note.durationTick), 0);
      const positioned = positionJsonNotes(imported, ppq, afterTick);
      const issue = validateNotes([...existing, ...positioned], editor.bounds);
      if (issue) throw new Error(issue);
      if (!editor.execute({ type: "insert", notes: positioned }))
        throw new Error("음표를 추가하지 못했습니다. 현재 편집 상태를 확인해 주세요.");
      onAdded();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "파일을 읽지 못했습니다.");
    } finally {
      setReading(false);
    }
  }

  return (
    <>
      <p><strong>JSON 파일(.json)</strong>을 가져올 수 있습니다.</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={cn(buttonVariants({ tone: "secondary", size: "compact" }), "h-10")}
          disabled={reading || !editor.editable} onClick={() => input.current?.click()}>
          파일 선택
        </button>
        <input hidden ref={input} type="file" accept=".json,application/json" onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = "";
          if (file) void select(file);
        }} />
      </div>
      <div className="min-h-[18px]">
        {reading && <p role="status">파일을 읽는 중…</p>}
        {error && <p role="alert">{error}</p>}
      </div>
    </>
  );
}
