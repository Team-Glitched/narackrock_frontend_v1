import { communityStyles } from "@/styles/community.styles";
import { buttonVariants } from "@/styles/variants";
import { sharedStyles } from "@/styles/shared.styles";
import { useId, useState } from "react";
import { CanvasDialog } from "@/components/ui/canvas-dialog";
export function MemberActionDialog({
  member,
  action,
  onConfirm,
  onClose,
}: {
  member: { nickname: string };
  action: "suspend" | "expel";
  onConfirm: (reason: string, days: number) => Promise<void>;
  onClose: () => void;
}) {
  const id = useId();
  const [reason, setReason] = useState("");
  const [days, setDays] = useState("30");
  const validDays = Number.isInteger(Number(days)) && Number(days) >= 1 && Number(days) <= 365;
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <CanvasDialog className={communityStyles.communityMemberDialog} titleId={id} onClose={onClose}>
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          if (busy) return;
          setBusy(true);
          setError("");
          try {
            if (action === "suspend" && !validDays)
              throw new Error("이용정지 기간은 1일부터 365일까지 입력해주세요.");
            await onConfirm(reason.trim(), Number(days));
          } catch (cause) {
            setError(cause instanceof Error ? cause.message : "처리하지 못했습니다.");
          } finally {
            setBusy(false);
          }
        }}
        aria-label={`${member.nickname} ${action === "suspend" ? "이용정지" : "추방"}`}
      >
        <header>
          <h2 id={id}>{action === "suspend" ? "커뮤니티 이용정지" : "커뮤니티에서 추방"}</h2>
          <button
            className={buttonVariants({
              tone: "primary",
            })}
            type="submit"
            disabled={busy || !reason.trim() || (action === "suspend" && !validDays)}
          >
            확인
          </button>
        </header>
        <p>{member.nickname} 님에게 적용할 제재 사유를 입력하세요.</p>
        {action === "suspend" && (
          <label className={sharedStyles.memberSuspensionDuration}>
            이용정지 기간
            <span>
              <input
                aria-label="이용정지 기간"
                type="number"
                inputMode="numeric"
                min={1}
                max={365}
                step={1}
                required
                value={days}
                onChange={(event) => setDays(event.target.value)}
              />
              일
            </span>
            <small>1일부터 365일까지 설정할 수 있습니다.</small>
          </label>
        )}
        <label>
          사유
          <input
            autoFocus
            maxLength={500}
            required
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="사유를 입력하세요"
          />
        </label>
        {error && <p role="alert">{error}</p>}
      </form>
    </CanvasDialog>
  );
}
