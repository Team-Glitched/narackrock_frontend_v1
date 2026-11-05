import { apiOrigin } from "../../lib/api/client.ts";
import { uploadMedia } from "../../lib/api/media.ts";
import {
  createOpenSource,
  listMyOpenSourcePublications,
  setOpenSourceVisibility,
  updateOpenSource,
} from "../../lib/api/open-sources.ts";

/**
 * Progress of one source publication, persisted before each non-idempotent step so a retry after a failure
 * (or a lost response) continues instead of creating a second publication.
 */
type PendingPublication = {
  mediaFileId: number;
  thumbnailMediaFileId: number | null;
  openSourceId: number | null;
  title: string;
  description: string | null;
};

export type PublishSourceInput = {
  userId: number;
  draftKey: string;
  title: string;
  description: string | null;
  audio: File;
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

const pendingKey = (input: Pick<PublishSourceInput, "userId" | "draftKey">) =>
  `narackrock.source-publication.${apiOrigin()}.${input.userId}.${input.draftKey}`;

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

async function findCreated(deps: PublishSourceDeps, mediaFileId: number): Promise<number | null> {
  const matches: number[] = [];
  for (let page = 0; ; page++) {
    const result = await deps.listMyOpenSourcePublications(page);
    matches.push(...result.items.filter((item) => item.mediaFileId === mediaFileId).map((item) => item.openSourceId));
    if (!result.hasNext) break;
  }
  if (matches.length > 1) throw new Error("같은 음원으로 만든 오픈소스가 여러 개 있습니다. 내 오픈소스에서 확인해주세요.");
  return matches[0] ?? null;
}

/**
 * Uploads the audio/thumbnail and creates a PRIVATE publication; publishes only when explicitly requested.
 * Failed attempts keep progress so retry continues from the failed step without duplicating a publication.
 */
export async function publishSource(input: PublishSourceInput, deps: PublishSourceDeps = browserDeps()): Promise<number> {
  const key = pendingKey(input);
  const save = (value: PendingPublication) => deps.storage.setItem(key, JSON.stringify(value));
  let pending = readPending(deps.storage, key);
  const recovering = pending !== null;
  if (!pending) {
    const mediaFileId = await deps.uploadMedia(input.audio, "AUDIO");
    const thumbnailMediaFileId = input.image ? await deps.uploadMedia(input.image, "IMAGE") : null;
    pending = { mediaFileId, thumbnailMediaFileId, openSourceId: null, title: input.title, description: input.description };
    save(pending);
  }
  if (pending.openSourceId === null) {
    // A previous create may have succeeded without a response; reuse it instead of creating another.
    const existing = await findCreated(deps, pending.mediaFileId);
    const openSourceId =
      existing ??
      (
        await deps.createOpenSource({
          title: input.title,
          description: input.description,
          mediaFileId: pending.mediaFileId,
          thumbnailMediaFileId: pending.thumbnailMediaFileId,
        })
      ).openSourceId;
    pending = { ...pending, openSourceId, title: existing === null ? input.title : pending.title, description: existing === null ? input.description : pending.description };
    save(pending);
  }
  const openSourceId = pending.openSourceId as number;
  if (pending.title !== input.title || pending.description !== input.description) {
    await deps.updateOpenSource(openSourceId, { title: input.title, description: input.description });
    pending = { ...pending, title: input.title, description: input.description };
    save(pending);
  }
  // A lost visibility response may already have published a recovered entry. Honour a new private
  // choice explicitly on retries; a freshly created entry is already private on the server.
  if (input.visibility === "PUBLIC" || recovering)
    await deps.setOpenSourceVisibility(openSourceId, input.visibility);
  deps.storage.removeItem(key);
  return openSourceId;
}
