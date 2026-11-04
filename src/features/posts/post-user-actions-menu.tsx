import { communityStyles } from "@/styles/community.styles";
import { Asset } from "@/components/ui/asset";
import { AnchoredActionsMenu } from "@/components/ui/anchored-actions-menu";
import type { RefObject } from "react";

/** Figma Menu / Post User Actions and Post Admin Actions. */
export function PostUserActionsMenu({
  onReport,
  onHide,
  onClose,
  onEdit,
  onDelete,
  onModerateDelete,
  onSuspendMember,
  onExpelMember,
  anchorRef,
}: {
  anchorRef: RefObject<HTMLButtonElement | null>;
  onReport?: () => void;
  onHide: () => void;
  onClose: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onModerateDelete?: () => void;
  onSuspendMember?: () => void;
  onExpelMember?: () => void;
}) {
  return (
    <AnchoredActionsMenu
      className={communityStyles.postUserActionsMenu}
      anchorRef={anchorRef}
      onClose={onClose}
      label="게시글 옵션"
      height={
        99 - (onReport ? 0 : 40) + (onModerateDelete ? 40 : 0) + (onSuspendMember ? 40 : 0) + (onExpelMember ? 40 : 0)
      }
    >
      {onEdit && onDelete && !onModerateDelete ? (
        <>
          <button role="menuitem" onClick={onEdit}>
            수정
          </button>
          <button role="menuitem" onClick={onDelete}>
            삭제
          </button>
        </>
      ) : (
        <>
          {onReport && (
            <button role="menuitem" onClick={onReport}>
              <Asset name="short-report.svg" />
              신고
            </button>
          )}
          <button role="menuitem" onClick={onHide}>
            <Asset name="post-hide.svg" />
            숨기기
          </button>
          {onModerateDelete && (
            <button role="menuitem" onClick={onModerateDelete}>
              <Asset name="admin-suspend.svg" />
              삭제
            </button>
          )}
        </>
      )}
      {onSuspendMember && (
        <button role="menuitem" onClick={onSuspendMember}>
          <Asset name="admin-suspend.svg" />
          작성자 이용정지
        </button>
      )}
      {onExpelMember && (
        <button role="menuitem" onClick={onExpelMember}>
          <Asset name="admin-expel.svg" />
          작성자 추방
        </button>
      )}
    </AnchoredActionsMenu>
  );
}
