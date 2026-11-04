import { sharedStyles } from "@/styles/shared.styles";
import { CanvasDialog } from "@/components/ui/canvas-dialog";
import { useId } from "react";

/** Figma V3 Dialog / Publish Confirmation (13488:31624). */
export function PublishConfirmation({
  onConfirm,
  onClose,
}: {
  onConfirm: () => void;
  onClose: () => void;
}) {
  const titleId = useId();
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
