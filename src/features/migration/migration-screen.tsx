import { useMemo, useState } from "react";
import { useCurrentUserId } from "@/features/auth/use-current-user";
import { apiOrigin } from "@/lib/api/client";
import { collectLegacyItems, type LegacyItem } from "./legacy-items";
import { migrateItem, migrationEntry, legacyAudio } from "./migrate-item";
import { sharedStyles } from "@/styles/shared.styles";

function download(value: Blob, name: string) {
  const url = URL.createObjectURL(value);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}
const reasons: Record<LegacyItem["kind"], string> = {
  post: "제목·작성자를 서버와 대조하고 저장 상태를 다시 읽은 뒤 필요한 경우 한 번만 저장합니다.",
  song: "숏폼 제목·작성자를 대조하고 이미 저장된 항목은 건너뜁니다.",
  source:
    "서버의 유효한 원본·작성자와 일치할 때만 보관합니다. 파일을 다른 작성자의 자료로 등록하지 않습니다.",
  audio: "직접 작성·소유한 파일만 새 비공개 publication으로 등록합니다. 원본 파일은 유지합니다.",
  midi: "서버 MIDI 보관함은 없습니다. 원본 JSON 내보내기 또는 선택한 내 트랙의 개인 초안으로만 가져옵니다.",
  work: "내 소유·참여와 현재 접근권을 검증하여 이 환경의 방문 이력에만 추가합니다.",
  recovery:
    "미완성 작성물·과거 제출·global 포인터입니다. 서버 ID로 간주하지 않으며 원본만 내보냅니다.",
};

/** Explicit settings entry; mounting only reads local originals, never sends a mutation. */
export function MigrationScreen() {
  const userId = useCurrentUserId();
  return <AccountMigrationScreen key={`${apiOrigin()}:${userId ?? "guest"}`} userId={userId} />;
}

function AccountMigrationScreen({ userId }: { userId: number | null }) {
  const items = useMemo(() => collectLegacyItems(localStorage), []);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [ownership, setOwnership] = useState<Set<string>>(new Set());
  const [targetProject, setTargetProject] = useState("");
  const [targetTrack, setTargetTrack] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, string>>({});
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
          {item.kind !== "recovery" && (
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
              onClick={() =>
                download(
                  new Blob([JSON.stringify(item.raw, null, 2)], { type: "application/json" }),
                  `browser-original-${item.kind}-${item.id ?? "draft"}.json`,
                )
              }
            >
              원본 JSON 내보내기
            </button>
            {(item.mediaKey || item.storageKey.includes("creation-draft")) && (
              <button
                onClick={async () => {
                  try {
                    const file = await legacyAudio(item);
                    if (!file) throw new Error("원본 오디오 파일이 없습니다.");
                    download(file, file.name);
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
            {item.kind !== "recovery" && (
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
                    await migrateItem(
                      item,
                      userId,
                      ownership.has(item.key),
                      Number.isSafeInteger(projectId) &&
                        projectId > 0 &&
                        Number.isSafeInteger(trackId) &&
                        trackId > 0
                        ? { projectId, trackId }
                        : undefined,
                    );
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
