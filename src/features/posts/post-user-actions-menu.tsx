import { communityStyles } from "@/styles/community.styles";
import { Asset } from "@/components/asset";
import { AnchoredActionsMenu } from "@/components/anchored-actions-menu";
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
  const authorActions = onEdit && onDelete && !onModerateDelete;
  const itemCount =
    (authorActions ? 2 : 1 + Number(Boolean(onReport)) + Number(Boolean(onModerateDelete))) +
    Number(Boolean(onSuspendMember)) +
    Number(Boolean(onExpelMember));
  return (
    <AnchoredActionsMenu
      className={communityStyles.postUserActionsMenu}
      anchorRef={anchorRef}
      onClose={onClose}
      label="게시글 옵션"
      width={180}
      height={14 + itemCount * 34 + (itemCount - 1) * 2}
    >
      {authorActions ? (
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
