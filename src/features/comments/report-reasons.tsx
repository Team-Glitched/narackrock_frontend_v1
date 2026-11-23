import { communityStyles } from "@/styles/community.styles";
import { buttonVariants } from "@/styles/variants";
import { useState } from "react";
import { Asset } from "@/components/asset";
import { ApiError } from "@/lib/api/client";
import { NativeDialog } from "@/components/native-dialog";
import { nativeApp } from "@/lib/native-app";
import {
  REPORT_DESCRIPTION_MAX_LENGTH,
  clampCodePoints,
  codePointLength,
} from "@/lib/content-limits";

const reasons = ["스팸", "욕설·괴롭힘", "부적절한 콘텐츠", "권리 침해", "기타"] as const;

function reportError(cause: unknown) {
  if (cause instanceof ApiError) {
    if (cause.status === 401) return "로그인 후 신고할 수 있습니다.";
    if (cause.status === 409) return cause.message || "이미 신고한 대상입니다.";
  }
  return cause instanceof Error ? cause.message : "신고를 접수하지 못했습니다.";
}

/** V3 Comment / Report (12798:20046). Sends `{reason, description}` to the target's report endpoint. */
export function ReportReasons({
  onSubmit,
  onDone,
}: {
  onSubmit: (reason: string, description: string | null) => Promise<unknown>;
  onDone: () => void;
}) {
  const [selected, setSelected] = useState<(typeof reasons)[number] | null>(null);
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const needsDescription = selected === "기타";
  const ready = selected !== null && (!needsDescription || description.trim().length > 0);
  async function submit(event?: React.FormEvent) {
    event?.preventDefault();
    if (!ready || busy || done) return;
    if (codePointLength(description.trim()) > REPORT_DESCRIPTION_MAX_LENGTH) {
      setError(`신고 내용은 ${REPORT_DESCRIPTION_MAX_LENGTH}자 이내로 적어주세요.`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSubmit(selected, description.trim() || null);
      setDone(true);
    } catch (cause) {
      setError(reportError(cause));
    } finally {
      setBusy(false);
    }
  }
  if (nativeApp())
    return (
      <NativeDialog
        model={
          done
            ? {
                title: "신고가 접수되었습니다.",
                message: "검토 후 처리 결과에 따라 조치합니다.",
                actions: [{ id: "done", label: "확인" }],
              }
            : {
                title: "어떤 문제인가요?",
                message: "저희 나락락에서 최대한 빠른 시일 내에 처리해 드리겠습니다.",
                error: error ?? undefined,
                dismissible: !busy,
                fields: [
                  {
                    id: "reason",
                    label: "신고 사유",
                    value: selected ?? "",
                    disabled: busy,
                    options: reasons.map((reason) => ({ value: reason, label: reason })),
                  },
                  {
                    id: "description",
                    label: needsDescription ? "신고 내용 (필수)" : "신고 내용 (선택)",
                    value: description,
                    multiline: true,
                    disabled: busy,
                  },
                ],
                actions: [
                  {
                    id: "submit",
                    label: busy ? "접수 중..." : "신고하기",
                    disabled: !ready || busy,
                  },
                ],
              }
        }
        onChange={(id, value) => {
          if (id === "reason" && reasons.includes(value as (typeof reasons)[number]))
            setSelected(value as (typeof reasons)[number]);
          if (id === "description")
            setDescription(clampCodePoints(value, REPORT_DESCRIPTION_MAX_LENGTH));
        }}
        onAction={(id) => {
          if (id === "done") onDone();
          else if (id === "submit") void submit();
        }}
        onClose={onDone}
      />
    );
  if (done)
    return (
      <div className={communityStyles.commentReportContent}>
        <h2 role="status">신고가 접수되었습니다.</h2>
        <p>검토 후 처리 결과에 따라 조치합니다.</p>
        <button className={buttonVariants({ tone: "primary" })} onClick={onDone}>
          확인
        </button>
      </div>
    );
  return (
    <form className={communityStyles.commentReportContent} onSubmit={submit}>
      <h2>어떤 문제인가요?</h2>
      <p>저희 나락락에서 최대한 빠른 시일 내에 처리해 드리겠습니다.</p>
      <div
        className={communityStyles.commentReportReasons}
        role="radiogroup"
        aria-label="신고 사유"
      >
        {reasons.map((reason) => (
          <button
            type="button"
            key={reason}
            role="radio"
            aria-checked={selected === reason}
            onClick={() => setSelected(reason)}
          >
            <span>
              <Asset name="report-radio.svg" />
              {selected === reason && <i />}
            </span>
            {reason}
          </button>
        ))}
      </div>
      <textarea
        aria-label={needsDescription ? "신고 내용 (필수)" : "신고 내용 (선택)"}
        placeholder={
          needsDescription ? "어떤 문제인지 적어주세요." : "추가로 알릴 내용이 있으면 적어주세요."
        }
        value={description}
        onChange={(event) =>
          setDescription(clampCodePoints(event.target.value, REPORT_DESCRIPTION_MAX_LENGTH))
        }
      />
      <small className="block text-right text-caption text-app-muted tabular-nums">
        {codePointLength(description)}/{REPORT_DESCRIPTION_MAX_LENGTH}자
      </small>
      {error && <p role="alert">{error}</p>}
      <button className={buttonVariants({ tone: "primary" })} disabled={!ready || busy}>
        {busy ? "접수 중..." : "신고하기"}
      </button>
    </form>
  );
}
