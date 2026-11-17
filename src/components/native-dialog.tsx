import { useEffect, useEffectEvent, useId } from "react";
import { requestNative } from "@/lib/native-app";
import {
  nativeDialogEvent,
  type NativeDialogEvent,
  type NativeDialogModel,
} from "@/lib/native-dialog";

export type { NativeDialogModel, NativeDialogField } from "@/lib/native-dialog";

/** App only. Reports a dialog without mounting a DOM element or exposing the WebView. */
export function NativeDialog({
  model,
  onAction,
  onChange,
  onClose,
}: {
  model: NativeDialogModel;
  onAction: (id: string) => void;
  onChange?: (id: string, value: string) => void;
  onClose: () => void;
}) {
  const id = useId();
  const snapshot = JSON.stringify(model);
  const act = useEffectEvent((event: NativeDialogEvent) => {
    if (event.id !== id) return;
    const action = event.action;
    if (action.type === "close") {
      if (model.dismissible !== false) onClose();
    } else if (action.type === "action") {
      const item = model.actions.find((item) => item.id === action.id);
      if (item && !item.disabled) onAction(item.id);
    } else {
      const field = model.fields?.find((field) => field.id === action.id);
      if (
        field &&
        !field.disabled &&
        (!field.options || field.options.some((option) => option.value === action.value))
      )
        onChange?.(field.id, action.value);
    }
  });
  useEffect(() => {
    const listener = (event: Event) => act((event as CustomEvent<NativeDialogEvent>).detail);
    window.addEventListener(nativeDialogEvent, listener);
    return () => window.removeEventListener(nativeDialogEvent, listener);
  }, []);
  useEffect(() => {
    void requestNative("set-dialog", {
      dialog: { id, model: JSON.parse(snapshot) as NativeDialogModel },
    });
  }, [id, snapshot]);
  useEffect(
    () => () => {
      void requestNative("set-dialog", { dialog: { id, model: null } });
    },
    [id],
  );
  return null;
}
