export type MigrationJournal = {
  phase: "sending" | "uploaded" | "creating" | "done" | "failed" | "uncertain";
  message?: string;
  mediaFileId?: number;
  publicationId?: number;
  beforeIds?: number[];
  payload?: unknown;
};
export const migrationKey = (origin: string, userId: number, kind: string, sourceId: string) =>
  `narackrock.migration.v1:${origin}:${userId}:${kind}:${sourceId}`;

/** A toggle is never retried until the complete server state has been read again. */
export async function migrateBookmark(options: {
  readSaved: () => Promise<boolean>;
  validate: () => Promise<boolean | void>;
  toggle: () => Promise<unknown>;
  journal: (entry: MigrationJournal) => void;
}) {
  const alreadySaved = await options.readSaved();
  const detailSaved = await options.validate();
  if (alreadySaved || detailSaved) {
    options.journal({ phase: "done", message: "서버에 이미 저장됨" });
    return;
  }
  options.journal({ phase: "sending" });
  let failure: unknown;
  try {
    await options.toggle();
  } catch (cause) {
    failure = cause;
  }
  // Even a lost response may have committed; never undo the user's save by toggling twice.
  if (await options.readSaved()) {
    options.journal({ phase: "done", message: "서버 저장 확인" });
    return;
  }
  const message =
    failure instanceof Error
      ? failure.message
      : "서버 저장이 확인되지 않았습니다. 자동 재시도하지 않습니다.";
  options.journal({ phase: "failed", message });
  throw new Error(message);
}

/** Non-idempotent publication creation: an interrupted create is reconciled only by one exact new match. */
export async function migratePrivateAudio(options: {
  previous: MigrationJournal | null;
  payload: { title: string; description: string | null };
  uploadIdentity?: { name: string; size: number; type: string; lastModified: number };
  list: () => Promise<
    { openSourceId: number; mediaFileId: number; title: string; description: string | null }[]
  >;
  upload: (onSession: (mediaFileId: number) => void) => Promise<number>;
  create: (mediaFileId: number) => Promise<{ openSourceId: number }>;
  journal: (entry: MigrationJournal) => void;
}) {
  let entry = options.previous;
  if (entry?.phase === "done") return;
  if (entry?.phase === "sending" || (entry?.phase === "uncertain" && !entry.beforeIds))
    throw new Error(
      "업로드 응답이 유실되어 상태 미확정입니다. 서버 확인 전 자동 재업로드하지 않습니다.",
    );
  if (entry?.phase === "creating" || entry?.phase === "uncertain") {
    const candidates = (await options.list()).filter(
      (item) =>
        !entry?.beforeIds?.includes(item.openSourceId) &&
        item.mediaFileId === entry?.mediaFileId &&
        item.title === options.payload.title &&
        item.description === options.payload.description,
    );
    if (candidates.length === 1) {
      options.journal({
        ...entry,
        phase: "done",
        publicationId: candidates[0].openSourceId,
        message: "응답 유실 후 서버 등록 확인",
      });
      return;
    }
    options.journal({ ...entry, phase: "uncertain", message: "등록 결과 미확정 · 서버 확인 필요" });
    throw new Error("등록 결과를 유일하게 확인하지 못했습니다. 자동 재등록하지 않습니다.");
  }
  if (!entry?.mediaFileId) {
    entry = { phase: "sending", payload: { ...options.payload, file: options.uploadIdentity } };
    options.journal(entry);
    try {
      const mediaFileId = await options.upload((id) => {
        entry = { ...entry, phase: "sending", mediaFileId: id };
        options.journal(entry);
      });
      entry = { ...entry, phase: "uploaded", mediaFileId };
      options.journal(entry);
    } catch (cause) {
      options.journal({
        ...entry,
        phase: "uncertain",
        message: "업로드 결과 미확정 · 서버 확인 필요",
      });
      throw cause;
    }
  }
  const beforeIds = (await options.list()).map((item) => item.openSourceId);
  entry = { ...entry, phase: "creating", beforeIds, payload: entry?.payload ?? options.payload };
  options.journal(entry);
  try {
    const publication = await options.create(entry.mediaFileId!);
    options.journal({
      ...entry,
      phase: "done",
      publicationId: publication.openSourceId,
      message: "비공개 등록됨",
    });
  } catch (cause) {
    options.journal({
      ...entry,
      phase: "uncertain",
      message: "등록 결과 미확정 · 다시 확인만 가능",
    });
    throw cause;
  }
}
