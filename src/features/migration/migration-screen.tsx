import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Link } from "react-router";
import { useCurrentUserId } from "@/features/auth/use-current-user";
import { apiOrigin, getCurrentUserId } from "@/lib/api/client";
import {
  getResumableProject, storedDraftId, subscribeToDraft,
} from "@/features/composition/studio-helpers";
import type { CompositionDto } from "@/lib/api/composition";
import { collectLegacyItems, type LegacyItem } from "./legacy-items";
import { migrateItem, migrationEntry, legacyAudio } from "./migrate-item";
import { sharedStyles } from "@/styles/shared.styles";
import { saveFile } from "@/lib/native-app";

const reasons: Record<LegacyItem["kind"], string> = {
  post: "제목·작성자를 서버와 대조하고 저장 상태를 다시 읽은 뒤 필요한 경우 한 번만 저장합니다.",
  song: "숏폼 제목·작성자를 대조하고 이미 저장된 항목은 건너뜁니다.",
  source:
    "서버의 유효한 원본·작성자와 일치할 때만 보관합니다. 파일을 다른 작성자의 자료로 등록하지 않습니다.",
  audio: "직접 작성·소유한 파일만 새 비공개 publication으로 등록합니다. 원본 파일은 유지합니다.",
  midi: "서버 MIDI 보관함은 없습니다. 원본 JSON 내보내기 또는 선택한 내 트랙의 개인 초안으로만 가져옵니다.",
  work: "내 소유·참여와 현재 접근권을 검증하여 이 환경의 방문 이력에만 추가합니다.",
  "draft-pointer": "원본에 서버·계정 출처가 없습니다. 현재 서버에서 소유권과 편집 가능 여부를 먼저 확인한 뒤 이어하기에 연결합니다.",
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
  return (
    <section className={sharedStyles.scrollContent}>
      <h1>이 브라우저 데이터 이관·복구</h1>
      <p>대상 서버: {apiOrigin()}</p>
      <p>현재 계정: {userId === null ? "로그인 필요" : `#${userId}`}</p>
      <p>
        원본 {items.length}건. 항목별 선택은 해당 원본의 귀속과 대상 환경을 확인했다는 동의입니다.
        숫자 ID가 같아도 같은 자료라고 간주하지 않습니다. 원본은 성공 후에도 삭제하지 않으며 자동
        공개하지 않습니다.
      </p>
      <p>
        이 브라우저에서는 계정·서버별 Web Lock으로 직렬 실행합니다. 다른 기기의 동시 저장까지
        원자적으로 보장하지 않습니다. 업로드·등록 응답 유실은 서버 확인이 필요할 수 있습니다.
      </p>
      <label>
        MIDI 대상 프로젝트 ID
        <input
          type="number"
          min="1"
          value={targetProject}
          onChange={(event) => setTargetProject(event.target.value)}
        />
      </label>
      <label>
        내 MIDI 트랙 ID
        <input
          type="number"
          min="1"
          value={targetTrack}
          onChange={(event) => setTargetTrack(event.target.value)}
        />
      </label>
      {!items.length && <p>이관할 이전 브라우저 자료가 없습니다.</p>}
      {items.map((item) => (
        <article key={item.key}>
          <h2>{item.title}</h2>
          <p>
            {item.kind} · 원본 scope: {item.originalScope} · {item.author ?? "작성자 미확인"}
          </p>
          <p>{reasons[item.kind]}</p>
          {item.kind === "draft-pointer" && userId !== null && (
            <DraftPointerRecovery item={item} userId={userId} />
          )}
          {item.kind !== "recovery" && item.kind !== "draft-pointer" && (
            <label>
              <input
                type="checkbox"
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
              이 원본의 귀속·대상 환경을 확인했으며 이 항목의 이관에 동의합니다.
            </label>
          )}
          {item.kind === "audio" && (
            <label>
              <input
                type="checkbox"
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
              이 오디오를 직접 작성·소유하며 비공개 업로드에 동의합니다.
            </label>
          )}
          <div>
            <button
              onClick={async () => {
                try {
                  await saveFile(
                    new File(
                      [JSON.stringify(item.raw, null, 2)],
                      `browser-original-${item.kind}-${item.id ?? "draft"}.json`,
                      { type: "application/json" },
                    ),
                  );
                } catch (cause) {
                  setResults((old) => ({
                    ...old,
                    [item.key]:
                      cause instanceof Error ? cause.message : "파일을 내보내지 못했습니다.",
                  }));
                }
              }}
            >
              원본 JSON 내보내기
            </button>
            {(item.mediaKey || item.storageKey.includes("creation-draft")) && (
              <button
                onClick={async () => {
                  try {
                    const file = await legacyAudio(item);
                    if (!file) throw new Error("원본 오디오 파일이 없습니다.");
                    await saveFile(file);
                  } catch (cause) {
                    setResults((old) => ({
                      ...old,
                      [item.key]:
                        cause instanceof Error ? cause.message : "파일을 내보내지 못했습니다.",
                    }));
                  }
                }}
              >
                원본 오디오 내보내기
              </button>
            )}
            {item.kind !== "recovery" && item.kind !== "draft-pointer" && (
              <button
                disabled={
                  busy !== null ||
                  !selected.has(item.key) ||
                  userId === null ||
                  (item.kind === "audio" && !ownership.has(item.key))
                }
                onClick={async () => {
                  if (userId === null) return;
                  setBusy(item.key);
                  try {
                    const projectId = Number(targetProject),
                      trackId = Number(targetTrack);
                    await migrateItem(item, {
                      userId,
                      ownsAudio: ownership.has(item.key),
                      target: Number.isSafeInteger(projectId) &&
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
                    setResults((old) => ({
                      ...old,
                      [item.key]: cause instanceof Error ? cause.message : "이관하지 못했습니다.",
                    }));
                  } finally {
                    setBusy(null);
                  }
                }}
              >
                {busy === item.key ? "확인·이관 중…" : "선택한 이 항목만 확인·이관"}
              </button>
            )}
          </div>
          <p role="status">
            {results[item.key] ??
              (userId === null ? "로그인 후 가능" : migrationEntry(item, userId)?.message)}
          </p>
        </article>
      ))}
    </section>
  );
}

function DraftPointerRecovery({ item, userId }: { item: LegacyItem; userId: number }) {
  const origin = apiOrigin();
  const savedId = useSyncExternalStore(subscribeToDraft, storedDraftId, () => null);
  const [preview, setPreview] = useState<CompositionDto["project"] | null>(null);
  const [consent, setConsent] = useState(false);
  const [replaceExisting, setReplaceExisting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
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
  return (
    <section aria-label="이전 작업 이어하기 연결">
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
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
        }}
      >
        현재 서버에서 프로젝트 확인
      </button>
      {preview && (
        <>
          <dl>
            <dt>대상 서버</dt><dd>{origin}</dd>
            <dt>대상 계정</dt><dd>#{userId}</dd>
            <dt>프로젝트</dt><dd>#{preview.projectId} · {preview.title}</dd>
            <dt>소유자</dt><dd>#{preview.ownerId}</dd>
            <dt>상태</dt><dd>{preview.status}</dd>
          </dl>
          <p>원본 global 포인터에는 서버·계정 출처가 없습니다. 이 프로젝트가 이어갈 작업인지 직접 확인해주세요. 원본은 삭제하거나 수정하지 않습니다.</p>
          <label>
            <input type="checkbox" checked={consent} disabled={busy}
              onChange={(event) => setConsent(event.target.checked)} />
            위 서버·계정·프로젝트를 확인했으며 이 항목의 이어하기 연결에 동의합니다.
          </label>
          {replacing && (
            <label>
              <input type="checkbox" checked={replaceExisting} disabled={busy}
                onChange={(event) => setReplaceExisting(event.target.checked)} />
              현재 이어하기 프로젝트 #{savedId}를 #{preview.projectId}로 교체하는 데 별도로 동의합니다.
            </label>
          )}
          <button type="button" disabled={busy || !consent || (replacing && !replaceExisting)}
            onClick={async () => {
              setBusy(true);
              setMessage(null);
              try {
                await migrateItem(item, {
                  userId,
                  ownsAudio: false,
                  draftPointerConsent: {
                    origin, projectId: preview.projectId, title: preview.title, replaceExisting,
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
            }}
          >
            {busy ? "확인·연결 중…" : "확인한 프로젝트로 이어하기 연결"}
          </button>
        </>
      )}
      <p role="status">{message}</p>
      {savedId === item.id && <Link to={`/studio/${item.id}`}>연결한 프로젝트 열기</Link>}
    </section>
  );
}
