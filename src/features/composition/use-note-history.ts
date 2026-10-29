"use client";

import { useState, type Dispatch, type SetStateAction } from "react";
import type { MidiNoteDto } from "@/lib/api/composition";
import { sameNotes } from "./note-editing";

type HistoryState = { scope: object | null; past: MidiNoteDto[][]; future: MidiNoteDto[][] };
export function useNoteHistory(notes: MidiNoteDto[], setNotes: Dispatch<SetStateAction<MidiNoteDto[]>>, scope: object | null) {
  const [history, setHistory] = useState<HistoryState>({ scope, past: [], future: [] });
  // A restored/replaced draft starts its own history; undo must never restore another draft.
  if (history.scope !== scope) setHistory({ scope, past: [], future: [] });
  const current = history.scope === scope ? history : { scope, past: [], future: [] };
  return {
    canUndo: current.past.length > 0,
    canRedo: current.future.length > 0,
    apply(next: MidiNoteDto[]) {
      if (sameNotes(notes, next)) return false;
      setHistory({ scope, past: [...current.past, structuredClone(notes)].slice(-80), future: [] });
      setNotes(next);
      return true;
    },
    undo() {
      const previous = current.past.at(-1);
      if (!previous) return;
      setHistory({ scope, past: current.past.slice(0, -1), future: [structuredClone(notes), ...current.future] });
      setNotes(structuredClone(previous));
    },
    redo() {
      const next = current.future[0];
      if (!next) return;
      setHistory({ scope, past: [...current.past, structuredClone(notes)].slice(-80), future: current.future.slice(1) });
      setNotes(structuredClone(next));
    },
  };
}
export type NoteHistory = ReturnType<typeof useNoteHistory>;
