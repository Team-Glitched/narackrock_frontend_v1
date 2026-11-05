import { useEffect, useRef } from "react";
import type { NoteEditorController } from "./use-note-editor";

export function useNoteEditorShortcuts(options: {
  editor: NoteEditorController; positionTick: number; playing: boolean;
  onPlay: () => void; onPause: () => void;
}) {
  const latest = useRef(options);
  latest.current = options;
  useEffect(() => {
    const handle = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing || event.keyCode === 229) return;
      const { editor, positionTick, playing, onPlay, onPause } = latest.current;
      if (event.key === "Escape" && editor.gestureActive) { editor.cancelGesture(); return; }
      if (document.querySelector('[role="dialog"][aria-modal="true"],dialog[open]')) return;
      const target = event.target;
      if (target instanceof Element && target.closest('input,textarea,select,button,[contenteditable]:not([contenteditable="false"]),[role="slider"]')) return;
      const modifier = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();
      let action: (() => void) | undefined;
      if (event.code === "Space" && !modifier && !event.altKey) {
        if (event.repeat) { event.preventDefault(); return; }
        action = playing ? onPause : onPlay;
      } else if (modifier && !event.altKey) {
        if (key === 'a') action = editor.selectAll;
        if (key === 'c') action = () => { editor.copy(); };
        if (editor.editable) {
          if (key === 'v') action = () => { editor.paste(positionTick); };
          if (key === 'd') action = () => { editor.duplicate(); };
          if (key === 'z') action = () => { event.shiftKey ? editor.redo() : editor.undo(); };
          if (key === 'y') action = () => { editor.redo(); };
        }
      } else if (editor.editable && !event.altKey) {
        if (key === 'delete' || key === 'backspace') action = () => { editor.execute({type:'delete',indices:editor.selection}); };
        if (['arrowleft','arrowright','arrowup','arrowdown'].includes(key)) {
          const deltaTick = key === 'arrowleft' ? -editor.bounds.stepTick : key === 'arrowright' ? editor.bounds.stepTick : 0;
          action = () => { editor.execute(event.shiftKey && deltaTick !== 0
            ? {type:'resize',indices:editor.selection,deltaTick}
            : {type:'move',indices:editor.selection,deltaTick,deltaRow:key === 'arrowup' ? -1 : key === 'arrowdown' ? 1 : 0}); };
        }
      }
      if (action) { event.preventDefault(); action(); }
    };
    window.addEventListener('keydown', handle);
    return () => window.removeEventListener('keydown', handle);
  }, []);
}
