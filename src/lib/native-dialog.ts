/** Data-only dialogs; web controllers own state, React Native owns every visible control. */
export type NativeDialogField = {
  id: string;
  label: string;
  value: string;
  multiline?: boolean;
  placeholder?: string;
  /** Limit in code points; the field shows the web's `N/{maxLength}자` counter under it. */
  maxLength?: number;
  keyboard?: "default" | "numeric";
  options?: { value: string; label: string }[];
  disabled?: boolean;
};

export type NativeDialogModel = {
  title: string;
  message?: string;
  error?: string;
  dismissible?: boolean;
  fields?: NativeDialogField[];
  actions: { id: string; label: string; disabled?: boolean; destructive?: boolean }[];
};

export type NativeDialogReport = { id: string; model: NativeDialogModel | null };
export type NativeDialogAction =
  | { type: "close" }
  | { type: "action"; id: string }
  | { type: "change"; id: string; value: string };
export type NativeDialogEvent = { id: string; action: NativeDialogAction };
export const nativeDialogEvent = "narackrock:dialog-action";
