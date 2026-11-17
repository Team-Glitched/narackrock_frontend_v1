import { sharedStyles } from "@/styles/shared.styles";
import { CanvasDialog } from "@/components/canvas-dialog";
import { useId } from "react";
import { nativeApp } from "@/lib/native-app";
import { NativeDialog } from "@/components/native-dialog";

/** Figma V3 Dialog / Publish Confirmation (13488:31624). */
export function PublishConfirmation({
  onConfirm,
  onClose,
}: {
  onConfirm: () => void;
  onClose: () => void;
}) {
  const titleId = useId();
  if (nativeApp())
    return (
      <NativeDialog
        model={{
          title: "정말로 올리시겠습니까?",
          actions: [{ id: "confirm", label: "확인" }],
        }}
        onAction={(id) => {
          if (id === "confirm") onConfirm();
        }}
        onClose={onClose}
      />
    );
  return (
    <CanvasDialog className={sharedStyles.publishConfirmation} titleId={titleId} onClose={onClose}>
      <div>
        <h2 id={titleId}>정말로 올리시겠습니까?</h2>
        <button autoFocus onClick={onConfirm}>
          확인
        </button>
      </div>
    </CanvasDialog>
  );
}
