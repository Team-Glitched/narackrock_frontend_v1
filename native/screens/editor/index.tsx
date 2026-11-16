import type { ScreenRegistry } from "../types";
import { NoteEditorScreen } from "./note-editor";

/** Native screens of the note editor feature; spread into ../index.tsx. */
export const editorScreens: ScreenRegistry<"editor"> = {
  "editor-notes": NoteEditorScreen,
};
