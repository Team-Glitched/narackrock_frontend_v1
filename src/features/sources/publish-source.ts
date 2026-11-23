import { ApiError, apiOrigin } from "../../lib/api/client.ts";
import { uploadMedia } from "../../lib/api/media.ts";
import {
  createOpenSource,
  listMyOpenSourcePublications,
  setOpenSourceVisibility,
  updateOpenSource,
  type OpenSourceMidiNote,
} from "../../lib/api/open-sources.ts";

/**
 * Progress of one source publication, persisted before each non-idempotent step so a retry after a failure
 * (or a lost response) continues instead of creating a second publication.
 */
type PendingPublication = {
  mediaFileId: number;
  thumbnailMediaFileId: number | null;
  thumbnailDigest?: string | null;
  openSourceId: number | null;
  title: string;
  description: string | null;
  /** The instrument chosen for the uploaded audio; every tab that continues this upload publishes it. */
  instrument?: string | null;
  /** The instrument the server reported for the created publication. */
  publishedInstrument?: string | null;
  midiPpq?: number | null;
  midiBpm?: number | null;
  midiNotes?: OpenSourceMidiNote[] | null;
};

export type PublishSourceInput = {
  instrument?: string | null;
  midiPpq?: number | null;
  midiBpm?: number | null;
  midiNotes?: OpenSourceMidiNote[] | null;
  userId: number;
  draftKey: string;
  title: string;
  description: string | null;
  audio: File | null;
  expectedPendingAudioId?: number | null;
  image: File | null;
  visibility: "PRIVATE" | "PUBLIC";
};

export type PublishSourceDeps = {
  storage: Pick<Storage, "getItem" | "setItem" | "removeItem">;
  uploadMedia: typeof uploadMedia;
  createOpenSource: typeof createOpenSource;
  updateOpenSource: typeof updateOpenSource;
  setOpenSourceVisibility: typeof setOpenSourceVisibility;
  listMyOpenSourcePublications: typeof listMyOpenSourcePublications;
};

const browserDeps = (): PublishSourceDeps => ({
  storage: localStorage,
  uploadMedia,
  createOpenSource,
  updateOpenSource,
  setOpenSourceVisibility,
  listMyOpenSourcePublications,
});

type SourceDraftScope = Pick<PublishSourceInput, "userId" | "draftKey">;

const pendingKey = (input: SourceDraftScope) =>
  `narackrock.source-publication.${apiOrigin()}.${input.userId}.${input.draftKey}`;

const draftRevisionKey = (input: SourceDraftScope) => `${pendingKey(input)}.revision`;

export function getSourceDraftRevision(input: SourceDraftScope, storage: Pick<Storage, "getItem"> = localStorage) {
  return storage.getItem(draftRevisionKey(input));
}

export async function withSourcePublicationLock<T>(
  input: SourceDraftScope & { draftRevision: string | null },
  finishDraft: () => T | Promise<T>,
  locks: Pick<LockManager, "request"> | undefined = navigator.locks,
  storage: Pick<Storage, "getItem" | "setItem"> = localStorage,
): Promise<T> {
  if (!locks) throw new ApiError(409, "이 브라우저에서는 샘플 등록을 안전하게 진행할 수 없습니다.");
  return locks.request(pendingKey(input), { ifAvailable: true }, async (lock) => {
    if (!lock) throw new ApiError(409, "다른 탭에서 이 초안을 처리하고 있습니다.");
    if (getSourceDraftRevision(input, storage) !== input.draftRevision) {
      throw new ApiError(409, "다른 탭에서 이 초안을 등록하거나 삭제했습니다. 작성 화면을 다시 열어주세요.");
    }
    const result = await finishDraft();
    storage.setItem(draftRevisionKey(input), crypto.randomUUID());
    return result;
  });
}

function readPending(storage: PublishSourceDeps["storage"], key: string): PendingPublication | null {
  try {
    const value = JSON.parse(storage.getItem(key) ?? "null") as PendingPublication | null;
    return value && Number.isSafeInteger(value.mediaFileId) ? value : null;
  } catch {
    return null;
  }
}

/** True when an earlier attempt already created a publication and only its final updates remain. */
export function hasPendingPublication(input: Pick<PublishSourceInput, "userId" | "draftKey">, storage: PublishSourceDeps["storage"] = localStorage) {
  return readPending(storage, pendingKey(input))?.openSourceId != null;
}

export function getPendingSourceAudioId(
  input: Pick<PublishSourceInput, "userId" | "draftKey">,
  storage: PublishSourceDeps["storage"] = localStorage,
) {
  return readPending(storage, pendingKey(input))?.mediaFileId ?? null;
}

/** The instrument bound to the pending uploaded audio; it is published with that audio. */
export function getPendingSourceInstrument(
  input: Pick<PublishSourceInput, "userId" | "draftKey">,
  storage: PublishSourceDeps["storage"] = localStorage,
) {
  return readPending(storage, pendingKey(input))?.instrument ?? null;
}

export function subscribeSourcePublication(
  input: Pick<PublishSourceInput, "userId" | "draftKey">,
  onChange: () => void,
) {
  const key = pendingKey(input);
  const revisionKey = draftRevisionKey(input);
  function onStorage(event: StorageEvent) {
    if (event.storageArea === localStorage && (event.key === key || event.key === revisionKey || event.key === null)) onChange();
  }
  window.addEventListener("storage", onStorage);
  return () => window.removeEventListener("storage", onStorage);
}

export function clearPendingPublication(
  input: Pick<PublishSourceInput, "userId" | "draftKey">,
  storage: Pick<Storage, "removeItem"> = localStorage,
) {
  storage.removeItem(pendingKey(input));
}

async function findCreated(deps: PublishSourceDeps, mediaFileId: number) {
  const matches: Awaited<ReturnType<typeof listMyOpenSourcePublications>>["items"] = [];
  for (let page = 0; ; page++) {
    const result = await deps.listMyOpenSourcePublications(page);
    matches.push(...result.items.filter((item) => item.mediaFileId === mediaFileId));
    if (!result.hasNext) break;
  }
  if (matches.length > 1) throw new Error("같은 음원으로 만든 샘플이 여러 개 있습니다. 내 샘플에서 확인해주세요.");
  return matches[0] ?? null;
}

/**
 * Uploads the audio/thumbnail and creates a PRIVATE publication; publishes only when explicitly requested.
 * Failed attempts keep progress so retry continues from the failed step without duplicating a publication.
 */
export async function publishSource(input: PublishSourceInput, deps: PublishSourceDeps = browserDeps()): Promise<number> {
  const key = pendingKey(input);
  const save = (value: PendingPublication) => deps.storage.setItem(key, JSON.stringify(value));
  // Rendering the same crop produces a new File on each submit. Compare its bytes instead.
  const thumbnailDigest = input.image
    ? Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", await input.image.arrayBuffer())))
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("")
    : null;
  let pending = readPending(deps.storage, key);
  if (input.expectedPendingAudioId !== undefined && input.expectedPendingAudioId !== (pending?.mediaFileId ?? null)) {
    throw new ApiError(409, "다른 탭에서 등록 상태가 바뀌었습니다. 오디오 상태를 확인한 뒤 다시 등록해주세요.");
  }
  const recovering = pending !== null;
  if (!pending) {
    if (!input.audio) throw new Error("오디오를 먼저 선택해주세요.");
    const mediaFileId = await deps.uploadMedia(input.audio, "AUDIO");
    const thumbnailMediaFileId = input.image ? await deps.uploadMedia(input.image, "IMAGE") : null;
    pending = {
      mediaFileId,
      thumbnailMediaFileId,
      thumbnailDigest,
      openSourceId: null,
      title: input.title,
      description: input.description,
      instrument: input.instrument ?? null,
      ...(input.midiNotes?.length
        ? {
            midiPpq: input.midiPpq ?? 480,
            midiBpm: input.midiBpm ?? null,
            midiNotes: input.midiNotes,
          }
        : {}),
    };
    save(pending);
  }
  // The instrument belongs to the uploaded audio, not to whichever tab continues its publication.
  const instrument = pending.instrument ?? null;
  if (pending.openSourceId === null) {
    // A previous create may have succeeded without a response; reuse it instead of creating another.
    const existing = await findCreated(deps, pending.mediaFileId);
    const created =
      existing ??
      (
        await deps.createOpenSource({
          title: input.title,
          description: input.description,
          mediaFileId: pending.mediaFileId,
          thumbnailMediaFileId: pending.thumbnailMediaFileId,
          instrument,
          ...(pending.midiNotes?.length
            ? {
                midiPpq: pending.midiPpq ?? 480,
                midiBpm: pending.midiBpm ?? null,
                midiNotes: pending.midiNotes,
              }
            : {}),
        })
      );
    pending = { ...pending, openSourceId: created.openSourceId, publishedInstrument: created.instrument ?? null, title: existing === null ? input.title : pending.title, description: existing === null ? input.description : pending.description };
    save(pending);
  }
  const openSourceId = pending.openSourceId as number;
  const thumbnailChanged = pending.thumbnailDigest !== thumbnailDigest;
  const instrumentChanged = (pending.publishedInstrument ?? null) !== instrument;
  if (thumbnailChanged || pending.title !== input.title || pending.description !== input.description || instrumentChanged) {
    const patch: Parameters<typeof updateOpenSource>[1] = { title: input.title, description: input.description };
    if (instrumentChanged) patch.instrument = instrument;
    if (thumbnailChanged) {
      patch.thumbnailMediaFileId = input.image ? await deps.uploadMedia(input.image, "IMAGE") : null;
      // If the patch response is lost, reconcile on retry even if the user reverts to the old crop.
      save({ ...pending, thumbnailDigest: undefined });
    }
    await deps.updateOpenSource(openSourceId, patch);
    pending = {
      ...pending,
      title: input.title,
      description: input.description,
      publishedInstrument: instrument,
      thumbnailMediaFileId: patch.thumbnailMediaFileId === undefined ? pending.thumbnailMediaFileId : patch.thumbnailMediaFileId,
      thumbnailDigest,
    };
    save(pending);
  }
  // A lost visibility response may already have published a recovered entry. Honour a new private
  // choice explicitly on retries; a freshly created entry is already private on the server.
  if (input.visibility === "PUBLIC" || recovering)
    await deps.setOpenSourceVisibility(openSourceId, input.visibility);
  deps.storage.removeItem(key);
  return openSourceId;
}
