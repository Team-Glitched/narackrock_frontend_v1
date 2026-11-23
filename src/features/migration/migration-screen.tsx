import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Link, useNavigate } from "react-router";
import { useCurrentUserId } from "@/features/auth/use-current-user";
import { apiOrigin, getCurrentUserId } from "@/lib/api/client";
import {
  getResumableProject,
  storedDraftId,
  subscribeToDraft,
} from "@/features/composition/studio-helpers";
import type { CompositionDto } from "@/lib/api/composition";
import { collectLegacyItems, type LegacyItem } from "./legacy-items";
import { migrateItem, migrationEntry, legacyAudio } from "./migrate-item";
import { sharedStyles } from "@/styles/shared.styles";
import { buttonVariants } from "@/styles/variants";
import { cn } from "@/lib/utils";
import { nativeApp, saveFile } from "@/lib/native-app";
import { NativeDialog } from "@/components/native-dialog";

const reasons: Record<LegacyItem["kind"], string> = {
  post: "제목·작성자를 서버와 대조하고 저장 상태를 다시 읽은 뒤 필요한 경우 한 번만 저장합니다.",
  song: "숏폼 제목·작성자를 대조하고 이미 저장된 항목은 건너뜁니다.",
  source:
    "서버의 유효한 원본·작성자와 일치할 때만 보관합니다. 파일을 다른 작성자의 자료로 등록하지 않습니다.",
  audio: "직접 작성·소유한 파일만 새 비공개 publication으로 등록합니다. 원본 파일은 유지합니다.",
  midi: "서버 MIDI 보관함은 없습니다. 원본 JSON 내보내기 또는 선택한 내 트랙의 개인 초안으로만 가져옵니다.",
  work: "내 소유·참여와 현재 접근권을 검증하여 이 환경의 방문 이력에만 추가합니다.",
  "draft-pointer":
    "원본에 서버·계정 출처가 없습니다. 현재 서버에서 소유권과 편집 가능 여부를 먼저 확인한 뒤 이어하기에 연결합니다.",
  recovery:
    "미완성 작성물·과거 제출·유효하지 않은 포인터입니다. 서버 ID로 간주하지 않으며 원본만 내보냅니다.",
};

/** Explicit settings entry; mounting only reads local originals, never sends a mutation. */
export function MigrationScreen() {
  const userId = useCurrentUserId();
  return <AccountMigrationScreen key={`${apiOrigin()}:${userId ?? "guest"}`} userId={userId} />;
}

function AccountMigrationScreen({ userId }: { userId: number | null }) {
  const [items, setItems] = useState(() => collectLegacyItems(localStorage));
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [ownership, setOwnership] = useState<Set<string>>(new Set());
  const [targetProject, setTargetProject] = useState("");
  const [targetTrack, setTargetTrack] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, string>>({});
  const navigate = useNavigate();
  const [activeKey, setActiveKey] = useState("");
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  useEffect(() => {
    const refreshOriginals = () => {
      setItems(collectLegacyItems(localStorage));
      setSelected(new Set());
      setOwnership(new Set());
    };
    window.addEventListener("storage", refreshOriginals);
    window.addEventListener("focus", refreshOriginals);
    return () => {
      window.removeEventListener("storage", refreshOriginals);
      window.removeEventListener("focus", refreshOriginals);
    };
  }, []);
  const active = items.find((item) => item.key === activeKey) ?? items[0];
  function toggle(set: typeof setSelected, key: string, checked: boolean) {
    set((old) => {
      const next = new Set(old);
      if (checked) next.add(key);
      else next.delete(key);
      return next;
    });
  }
  function failure(item: LegacyItem, cause: unknown, fallback: string) {
    setResults((old) => ({
      ...old,
      [item.key]: cause instanceof Error ? cause.message : fallback,
    }));
  }
  async function exportOriginal(item: LegacyItem) {
    try {
      await saveFile(
        new File(
          [JSON.stringify(item.raw, null, 2)],
          `browser-original-${item.kind}-${item.id ?? "draft"}.json`,
          { type: "application/json" },
        ),
      );
    } catch (cause) {
      failure(item, cause, "파일을 내보내지 못했습니다.");
    }
  }
  async function exportAudio(item: LegacyItem) {
    try {
      const file = await legacyAudio(item);
      if (!file) throw new Error("원본 오디오 파일이 없습니다.");
      await saveFile(file);
    } catch (cause) {
      failure(item, cause, "파일을 내보내지 못했습니다.");
    }
  }
  async function migrate(item: LegacyItem) {
    if (
      userId === null ||
      busy !== null ||
      !selected.has(item.key) ||
      (item.kind === "audio" && !ownership.has(item.key))
    )
      return;
    setBusy(item.key);
    try {
      const projectId = Number(targetProject),
        trackId = Number(targetTrack);
      await migrateItem(item, {
        userId,
        ownsAudio: ownership.has(item.key),
        target:
          Number.isSafeInteger(projectId) &&
          projectId > 0 &&
          Number.isSafeInteger(trackId) &&
          trackId > 0
            ? { projectId, trackId }
            : undefined,
      });
      setResults((old) => ({
        ...old,
        [item.key]: migrationEntry(item, userId)?.message ?? "서버 확인 완료",
      }));
    } catch (cause) {
      failure(item, cause, "이관하지 못했습니다.");
    } finally {
      setBusy(null);
    }
  }
  if (nativeApp()) {
    if (recoveryOpen && active?.kind === "draft-pointer" && userId !== null)
      return (
        <DraftPointerRecovery
          key={active.key}
          item={active}
          userId={userId}
          onClose={() => setRecoveryOpen(false)}
        />
      );
    const migratable = active && active.kind !== "recovery" && active.kind !== "draft-pointer";
    const booleanOptions = [
      { value: "no", label: "동의하지 않음" },
      { value: "yes", label: "동의함" },
    ];
    return (
      <NativeDialog
        model={{
          title: "이 브라우저 데이터 이관·복구",
          dismissible: busy === null,
          message: [
            `대상 서버: ${apiOrigin()}\n현재 계정: ${userId === null ? "로그인 필요" : `#${userId}`}`,
            `원본 ${items.length}건. 항목별 선택은 해당 원본의 귀속과 대상 환경을 확인했다는 동의입니다. 숫자 ID가 같아도 같은 자료라고 간주하지 않습니다. 원본은 성공 후에도 삭제하지 않으며 자동 공개하지 않습니다.`,
            "이 브라우저에서는 계정·서버별 Web Lock으로 직렬 실행합니다. 다른 기기의 동시 저장까지 원자적으로 보장하지 않습니다. 업로드·등록 응답 유실은 서버 확인이 필요할 수 있습니다.",
            active
              ? `${active.kind} · 원본 scope: ${active.originalScope} · ${active.author ?? "작성자 미확인"}\n${reasons[active.kind]}`
              : "이관할 이전 브라우저 자료가 없습니다.",
            active
              ? (results[active.key] ??
                (userId === null ? "로그인 후 가능" : migrationEntry(active, userId)?.message))
              : "",
          ]
            .filter(Boolean)
            .join("\n\n"),
          fields: [
            ...(active
              ? [
                  {
                    id: "item",
                    label: "이전 브라우저 자료",
                    value: active.key,
                    disabled: busy !== null,
                    options: items.map((item) => ({
                      value: item.key,
                      label: `${item.title} · ${item.kind}`,
                    })),
                  },
                ]
              : []),
            {
              id: "project",
              label: "MIDI 대상 프로젝트 ID",
              value: targetProject,
              keyboard: "numeric",
            },
            { id: "track", label: "내 MIDI 트랙 ID", value: targetTrack, keyboard: "numeric" },
            ...(migratable
              ? [
                  {
                    id: "consent",
                    label: "이 원본의 귀속·대상 환경을 확인했으며 이 항목의 이관에 동의합니다.",
                    value: selected.has(active.key) ? "yes" : "no",
                    options: booleanOptions,
                    disabled: busy !== null || userId === null,
                  },
                ]
              : []),
            ...(active?.kind === "audio"
              ? [
                  {
                    id: "ownership",
                    label: "이 오디오를 직접 작성·소유하며 비공개 업로드에 동의합니다.",
                    value: ownership.has(active.key) ? "yes" : "no",
                    options: booleanOptions,
                    disabled: busy !== null,
                  },
                ]
              : []),
          ],
          actions: [
            ...(active ? [{ id: "json", label: "원본 JSON 내보내기" }] : []),
            ...(active && (active.mediaKey || active.storageKey.includes("creation-draft"))
              ? [{ id: "audio", label: "원본 오디오 내보내기" }]
              : []),
            ...(active?.kind === "draft-pointer" && userId !== null
              ? [{ id: "recovery", label: "이전 작업 이어하기 연결" }]
              : []),
            ...(migratable
              ? [
                  {
                    id: "migrate",
                    label: busy === active.key ? "확인·이관 중…" : "선택한 이 항목만 확인·이관",
                    disabled:
                      busy !== null ||
                      !selected.has(active.key) ||
                      userId === null ||
                      (active.kind === "audio" && !ownership.has(active.key)),
                  },
                ]
              : []),
            { id: "close", label: "닫기", disabled: busy !== null },
          ],
        }}
        onChange={(id, value) => {
          if (id === "item") setActiveKey(value);
          if (id === "project") setTargetProject(value);
          if (id === "track") setTargetTrack(value);
          if (active && id === "consent") toggle(setSelected, active.key, value === "yes");
          if (active && id === "ownership") toggle(setOwnership, active.key, value === "yes");
        }}
        onAction={(id) => {
          if (id === "close" && busy === null) navigate("/settings", { replace: true });
          if (!active) return;
          if (id === "json") void exportOriginal(active);
          if (id === "audio") void exportAudio(active);
          if (id === "migrate") void migrate(active);
          if (id === "recovery") setRecoveryOpen(true);
        }}
        onClose={() => {
          if (busy === null) navigate("/settings", { replace: true });
        }}
      />
    );
  }
  return (
    <section
      className={cn(
        sharedStyles.scrollContent,
        "flex flex-col gap-5 px-5 pt-6 pb-10 text-app-fg",
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="m-0 text-[18px] leading-6 font-bold text-app-fg break-keep">
          이 브라우저 데이터 이관·복구
        </h1>
        <button
          type="button"
          className={cn(buttonVariants({ tone: "secondary", size: "compact" }), "shrink-0")}
          onClick={() => navigate("/settings", { replace: true })}
        >
          설정으로 돌아가기
        </button>
      </div>
      <div className="flex flex-col gap-2 rounded-[12px] border border-solid border-app-border bg-app-surface p-4 text-body leading-5">
        <div className="flex flex-wrap items-center justify-between gap-2 text-caption text-app-muted">
          <span>대상 서버: {apiOrigin()}</span>
          <span>현재 계정: {userId === null ? "로그인 필요" : `#${userId}`}</span>
        </div>
        <p className="m-0 text-caption leading-[18px] text-app-muted">
          원본 {items.length}건. 항목별 선택은 해당 원본의 귀속과 대상 환경을 확인했다는
          동의입니다. 숫자 ID가 같아도 같은 자료라고 간주하지 않으며 원본은 삭제하거나 자동
          공개하지 않습니다.
        </p>
        <p className="m-0 text-caption leading-[18px] text-app-muted">
          이 브라우저에서는 계정·서버별 Web Lock으로 직렬 실행합니다. 다른 기기의 동시 저장까지
          원자적으로 보장하지 않습니다. 업로드·등록 응답 유실은 서버 확인이 필요할 수 있습니다.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5 text-caption font-medium text-app-muted">
          MIDI 대상 프로젝트 ID
          <input
            type="number"
            min="1"
            value={targetProject}
            onChange={(event) => setTargetProject(event.target.value)}
            className="h-10 rounded-[10px] border border-solid border-app-border bg-app-panel px-3 text-body text-app-fg outline-none focus:border-app-primary"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-caption font-medium text-app-muted">
          내 MIDI 트랙 ID
          <input
            type="number"
            min="1"
            value={targetTrack}
            onChange={(event) => setTargetTrack(event.target.value)}
            className="h-10 rounded-[10px] border border-solid border-app-border bg-app-panel px-3 text-body text-app-fg outline-none focus:border-app-primary"
          />
        </label>
      </div>
      {!items.length && (
        <p className="m-0 rounded-[12px] border border-solid border-app-border bg-app-panel p-5 text-center text-body text-app-muted">
          이관할 이전 브라우저 자료가 없습니다.
        </p>
      )}
      <div className="flex flex-col gap-3">
        {items.map((item) => (
          <article
            key={item.key}
            className="flex flex-col gap-3 rounded-[12px] border border-solid border-app-border bg-app-panel p-4"
          >
            <div className="flex flex-col gap-1">
              <h2 className="m-0 text-label leading-[22px] font-semibold text-app-fg [overflow-wrap:anywhere]">
                {item.title}
              </h2>
              <p className="m-0 text-caption leading-[18px] text-app-muted">
                {item.kind} · 원본 scope: {item.originalScope} · {item.author ?? "작성자 미확인"}
              </p>
              <p className="m-0 text-caption leading-[18px] text-app-muted">{reasons[item.kind]}</p>
            </div>
            {item.kind === "draft-pointer" && userId !== null && (
              <DraftPointerRecovery item={item} userId={userId} />
            )}
            {item.kind !== "recovery" && item.kind !== "draft-pointer" && (
              <label className="flex items-start gap-2.5 text-caption leading-[18px] text-app-fg">
                <input
                  type="checkbox"
                  className="mt-0.5 size-4 shrink-0 accent-app-primary"
                  disabled={busy !== null || userId === null}
                  checked={selected.has(item.key)}
                  onChange={(event) =>
                    setSelected((old) => {
                      const next = new Set(old);
                      if (event.target.checked) next.add(item.key);
                      else next.delete(item.key);
                      return next;
                    })
                  }
                />
                <span>이 원본의 귀속·대상 환경을 확인했으며 이 항목의 이관에 동의합니다.</span>
              </label>
            )}
            {item.kind === "audio" && (
              <label className="flex items-start gap-2.5 text-caption leading-[18px] text-app-fg">
                <input
                  type="checkbox"
                  className="mt-0.5 size-4 shrink-0 accent-app-primary"
                  disabled={busy !== null}
                  checked={ownership.has(item.key)}
                  onChange={(event) =>
                    setOwnership((old) => {
                      const next = new Set(old);
                      if (event.target.checked) next.add(item.key);
                      else next.delete(item.key);
                      return next;
                    })
                  }
                />
                <span>이 오디오를 직접 작성·소유하며 비공개 업로드에 동의합니다.</span>
              </label>
            )}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={buttonVariants({ tone: "secondary", size: "compact" })}
                onClick={() => void exportOriginal(item)}
              >
                원본 JSON 내보내기
              </button>
              {(item.mediaKey || item.storageKey.includes("creation-draft")) && (
                <button
                  type="button"
                  className={buttonVariants({ tone: "secondary", size: "compact" })}
                  onClick={() => void exportAudio(item)}
                >
                  원본 오디오 내보내기
                </button>
              )}
              {item.kind !== "recovery" && item.kind !== "draft-pointer" && (
                <button
                  type="button"
                  className={buttonVariants({ tone: "primary", size: "compact" })}
                  disabled={
                    busy !== null ||
                    !selected.has(item.key) ||
                    userId === null ||
                    (item.kind === "audio" && !ownership.has(item.key))
                  }
                  onClick={() => void migrate(item)}
                >
                  {busy === item.key ? "확인·이관 중…" : "선택한 이 항목만 확인·이관"}
                </button>
              )}
            </div>
            {(results[item.key] || userId === null || migrationEntry(item, userId)?.message) && (
              <p role="status" className="m-0 text-caption leading-[18px] text-app-primary-soft">
                {results[item.key] ??
                  (userId === null ? "로그인 후 가능" : migrationEntry(item, userId)?.message)}
              </p>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}

function DraftPointerRecovery({
  item,
  userId,
  onClose,
}: {
  item: LegacyItem;
  userId: number;
  onClose?: () => void;
}) {
  const origin = apiOrigin();
  const navigate = useNavigate();
  const savedId = useSyncExternalStore(subscribeToDraft, storedDraftId, () => null);
  const [preview, setPreview] = useState<CompositionDto["project"] | null>(null);
  const [consent, setConsent] = useState(false);
  const [replaceExisting, setReplaceExisting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  // A changed destination pointer invalidates any consent given for the previous one.
  const [consentedFor, setConsentedFor] = useState(savedId);
  if (consentedFor !== savedId) {
    setConsentedFor(savedId);
    setConsent(false);
    setReplaceExisting(false);
  }
  const current = () => mounted.current && getCurrentUserId() === userId && apiOrigin() === origin;
  const replacing = savedId !== null && savedId !== item.id;
  async function checkProject() {
    if (busy) return;
    setBusy(true);
    setPreview(null);
    setConsent(false);
    setReplaceExisting(false);
    setMessage(null);
    try {
      if (!collectLegacyItems(localStorage).some((row) => row.key === item.key))
        throw new Error("원본 포인터가 변경되었습니다. 목록을 다시 열어주세요.");
      if (item.id === null) throw new Error("유효한 프로젝트 ID가 아닙니다.");
      const composition = await getResumableProject(item.id, { origin, userId });
      if (current()) setPreview(composition.project);
    } catch (cause) {
      if (current()) setMessage(cause instanceof Error ? cause.message : "프로젝트 확인 실패");
    } finally {
      if (current()) setBusy(false);
    }
  }
  async function connectProject() {
    if (!preview || busy || !consent || (replacing && !replaceExisting)) return;
    setBusy(true);
    setMessage(null);
    try {
      await migrateItem(item, {
        userId,
        ownsAudio: false,
        draftPointerConsent: {
          origin,
          projectId: preview.projectId,
          title: preview.title,
          replaceExisting,
        },
      });
      if (current()) setMessage("이어하기 연결됨 · 원본 유지");
    } catch (cause) {
      if (current()) {
        setMessage(cause instanceof Error ? cause.message : "연결 실패");
        setConsent(false);
        setReplaceExisting(false);
        setPreview(null);
      }
    } finally {
      if (current()) setBusy(false);
    }
  }
  if (nativeApp()) {
    const options = [
      { value: "no", label: "동의하지 않음" },
      { value: "yes", label: "동의함" },
    ];
    return (
      <NativeDialog
        model={{
          title: "이전 작업 이어하기 연결",
          dismissible: !busy,
          message: [
            item.title,
            `대상 서버: ${origin}\n대상 계정: #${userId}`,
            preview
              ? `프로젝트: #${preview.projectId} · ${preview.title}\n소유자: #${preview.ownerId}\n상태: ${preview.status}`
              : "",
            "원본 global 포인터에는 서버·계정 출처가 없습니다. 이 프로젝트가 이어갈 작업인지 직접 확인해주세요. 원본은 삭제하거나 수정하지 않습니다.",
            message,
          ]
            .filter(Boolean)
            .join("\n\n"),
          fields: preview
            ? [
                {
                  id: "consent",
                  label: "위 서버·계정·프로젝트를 확인했으며 이 항목의 이어하기 연결에 동의합니다.",
                  value: consent ? "yes" : "no",
                  options,
                  disabled: busy,
                },
                ...(replacing
                  ? [
                      {
                        id: "replace",
                        label: `현재 이어하기 프로젝트 #${savedId}를 #${preview.projectId}로 교체하는 데 별도로 동의합니다.`,
                        value: replaceExisting ? "yes" : "no",
                        options,
                        disabled: busy,
                      },
                    ]
                  : []),
              ]
            : [],
          actions: [
            { id: "check", label: "현재 서버에서 프로젝트 확인", disabled: busy },
            ...(preview
              ? [
                  {
                    id: "connect",
                    label: busy ? "확인·연결 중…" : "확인한 프로젝트로 이어하기 연결",
                    disabled: busy || !consent || (replacing && !replaceExisting),
                  },
                ]
              : []),
            ...(savedId === item.id
              ? [{ id: "open", label: "연결한 프로젝트 열기", disabled: busy }]
              : []),
            { id: "close", label: "목록으로", disabled: busy },
          ],
        }}
        onChange={(id, value) => {
          if (id === "consent") setConsent(value === "yes");
          if (id === "replace") setReplaceExisting(value === "yes");
        }}
        onAction={(id) => {
          if (id === "check") void checkProject();
          if (id === "connect") void connectProject();
          if (id === "open" && !busy && savedId === item.id) navigate(`/studio/${item.id}`);
          if (id === "close" && !busy) onClose?.();
        }}
        onClose={() => {
          if (!busy) onClose?.();
        }}
      />
    );
  }
  return (
    <section
      aria-label="이전 작업 이어하기 연결"
      className="flex flex-col gap-3 rounded-[10px] border border-solid border-app-border bg-app-surface p-3"
    >
      <button
        type="button"
        className={buttonVariants({ tone: "secondary", size: "compact" })}
        disabled={busy}
        onClick={() => void checkProject()}
      >
        현재 서버에서 프로젝트 확인
      </button>
      {preview && (
        <>
          <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-caption leading-[18px]">
            <dt className="text-app-muted">대상 서버</dt>
            <dd className="m-0 text-app-fg [overflow-wrap:anywhere]">{origin}</dd>
            <dt className="text-app-muted">대상 계정</dt>
            <dd className="m-0 text-app-fg">#{userId}</dd>
            <dt className="text-app-muted">프로젝트</dt>
            <dd className="m-0 text-app-fg [overflow-wrap:anywhere]">
              #{preview.projectId} · {preview.title}
            </dd>
            <dt className="text-app-muted">소유자</dt>
            <dd className="m-0 text-app-fg">#{preview.ownerId}</dd>
            <dt className="text-app-muted">상태</dt>
            <dd className="m-0 text-app-fg">{preview.status}</dd>
          </dl>
          <p className="m-0 text-caption leading-[18px] text-app-muted">
            원본 global 포인터에는 서버·계정 출처가 없습니다. 이 프로젝트가 이어갈 작업인지 직접
            확인해주세요. 원본은 삭제하거나 수정하지 않습니다.
          </p>
          <label className="flex items-start gap-2 text-caption leading-[18px] text-app-fg">
            <input
              type="checkbox"
              className="mt-0.5 size-4 shrink-0 accent-app-primary"
              checked={consent}
              disabled={busy}
              onChange={(event) => setConsent(event.target.checked)}
            />
            <span>위 서버·계정·프로젝트를 확인했으며 이 항목의 이어하기 연결에 동의합니다.</span>
          </label>
          {replacing && (
            <label className="flex items-start gap-2 text-caption leading-[18px] text-app-fg">
              <input
                type="checkbox"
                className="mt-0.5 size-4 shrink-0 accent-app-primary"
                checked={replaceExisting}
                disabled={busy}
                onChange={(event) => setReplaceExisting(event.target.checked)}
              />
              <span>
                현재 이어하기 프로젝트 #{savedId}를 #{preview.projectId}로 교체하는 데 별도로
                동의합니다.
              </span>
            </label>
          )}
          <button
            type="button"
            className={buttonVariants({ tone: "primary", size: "compact" })}
            disabled={busy || !consent || (replacing && !replaceExisting)}
            onClick={() => void connectProject()}
          >
            {busy ? "확인·연결 중…" : "확인한 프로젝트로 이어하기 연결"}
          </button>
        </>
      )}
      {message && (
        <p role="status" className="m-0 text-caption leading-[18px] text-app-primary-soft">
          {message}
        </p>
      )}
      {savedId === item.id && (
        <Link
          className="text-body font-medium text-app-primary-soft underline"
          to={`/studio/${item.id}`}
        >
          연결한 프로젝트 열기
        </Link>
      )}
    </section>
  );
}
