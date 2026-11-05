import { apiRequest } from "./client.ts";
import type { ApiEnvelope } from "./contracts.ts";

export { uploadMedia } from "./media.ts";

export type MidiNoteDto = {
  pitch: number;
  startTick: number;
  durationTick: number;
  velocity: number;
  effectType: string | null;
  effectParams: Record<string, unknown>;
};

export type ClipDto = {
  clipId: number;
  ownerId: number;
  clipType: "AUDIO" | "MIDI";
  sourceType: string;
  mediaFileId: number | null;
  mediaUrl: string | null;
  startTick: number;
  durationTick: number;
  startTimeMs: number;
  durationMs: number;
  clipOffsetMs: number;
  approvalStatus: string;
  midiNotes: MidiNoteDto[];
};

export type TrackDto = {
  trackId: number;
  ownerId: number;
  name: string;
  instrument: string | null;
  volume: number;
  pan: number;
  isMuted: boolean;
  isSolo: boolean;
  approvalStatus: string;
  clips: ClipDto[];
};

export type CompositionDto = {
  viewerPermission: {
    userId: number;
    canEdit: boolean;
    canContribute: boolean;
    canReviewContribution: boolean;
    canExport: boolean;
  };
  project: {
    projectId: number;
    title: string;
    ownerId: number;
    albumImageFileId: number | null;
    bpm: number;
    timeSignatureNumerator: number;
    timeSignatureDenominator: number;
    ppq: number;
    maxTick: number;
    maxDurationMs: number;
    status: string;
    isPublic: boolean;
    version: { major: number; minor: number; display: string };
  };
  tracks: TrackDto[];
};

async function data<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await apiRequest<ApiEnvelope<T>>(path, init);
  if (!response.success) throw new Error(response.message);
  return response.data;
}

export async function enterComposition(shortId: number): Promise<{ projectId: number }> {
  return data(`/api/v1/shorts/${shortId}/composition`);
}

export async function getComposition(projectId: number): Promise<CompositionDto> {
  return data(`/api/v1/projects/${projectId}/tracks`);
}

/** Creates a track. `instrument` must be a sampled instrument or a recorded role; the server rejects others. */
export async function createTrack(
  projectId: number,
  name: string,
  instrument: string,
  sortOrder: number,
) {
  return data<{ trackId: number }>(`/api/v1/projects/${projectId}/tracks`, {
    method: "POST",
    body: JSON.stringify({ name, instrument, sortOrder }),
  });
}

/** Removes the caller's own track (used only to cancel a just-created empty track). */
export async function deleteTrack(trackId: number) {
  return apiRequest(`/api/v1/tracks/${trackId}`, { method: "DELETE" });
}

/** Original owner only, DRAFT/IN_PROGRESS projects; all three fields are required. */
export async function updateProjectTiming(
  projectId: number,
  timing: { bpm: number; timeSignatureNumerator: number; timeSignatureDenominator: number },
) {
  return data<{
    bpm: number;
    timeSignatureNumerator: number;
    timeSignatureDenominator: number;
    maxTick: number;
  }>(`/api/v1/projects/${projectId}/timing`, { method: "PATCH", body: JSON.stringify(timing) });
}

/** Owner-only tone change; multiple players may select the same instrument or family. */
export async function updateTrackInstrument(
  projectId: number,
  trackId: number,
  instrument: string,
) {
  return data<{ instrument: string }>(
    `/api/v1/projects/${projectId}/tracks/${trackId}/instrument`,
    {
      method: "PATCH",
      body: JSON.stringify({ instrument }),
    },
  );
}

export async function createAudioClip(
  projectId: number,
  trackId: number,
  mediaFileId: number,
  durationTick: number,
  sourceType: "FILE_UPLOAD" | "RECORDING" = "FILE_UPLOAD",
) {
  return data(`/api/v1/projects/${projectId}/tracks/${trackId}/clips/audio`, {
    method: "POST",
    body: JSON.stringify({ mediaFileId, sourceType, startTick: 0, durationTick, clipOffsetMs: 0 }),
  });
}

export async function transformRecordingToMidi(projectId: number, file: File) {
  const form = new FormData();
  form.append("audio", file);
  return data<{ durationTick: number; midiNotes: MidiNoteDto[] }>(
    `/api/v1/projects/${projectId}/hti-transform`,
    {
      method: "POST",
      body: form,
    },
  );
}

export async function createDraftProject() {
  return data<{ projectId: number }>("/api/v1/projects/drafts", { method: "POST" });
}

export async function updateProjectMetadata(
  projectId: number,
  title: string,
  albumImageFileId: number | null,
) {
  return data<void>(`/api/v1/projects/${projectId}/metadata`, {
    method: "PATCH",
    body: JSON.stringify({ title, albumImageFileId }),
  });
}

export type ContributionItem = {
  changeType: string;
  targetType: string;
  targetId: number;
  itemStatus: string;
};

/** `GET /projects/{id}/contributions` item; ids and states come from the server only. */
export type ContributionDto = {
  contributionId: number;
  projectId: number;
  userId: number;
  nickname: string;
  profileImageUrl: string | null;
  description: string | null;
  baseProjectVersion: { major: number; minor: number; display: string };
  approvalStatus: "PENDING" | "APPROVED" | "REJECTED";
  reviewedBy: number | null;
  reviewedAt: string | null;
  reviewComment: string | null;
  createdAt: string;
  items: ContributionItem[];
};

/** Response of a contribution submission (`editor-drafts/submit`). */
export type SubmittedContribution = {
  projectId: number;
  contributionId: number;
  baseProjectVersion: { major: number; minor: number; display: string };
  approvalStatus: "PENDING" | "APPROVED" | "REJECTED";
  description: string | null;
  items: ContributionItem[];
  createdAt: string;
};

export type ContributionNotificationDto = {
  contributionId: number;
  projectId: number;
  projectTitle: string;
  userId: number;
  nickname: string;
  description: string | null;
  itemCount: number;
  createdAt: string;
};

export async function getContributionInbox(): Promise<ContributionNotificationDto[]> {
  const response = await data<{ items: ContributionNotificationDto[] }>(
    "/api/v1/notifications/contributions",
  );
  return response.items;
}

export async function getPendingContributions(projectId: number): Promise<ContributionDto[]> {
  return listContributions(projectId, "PENDING");
}

/** Every contribution of a project (optionally by status), following the cursor to the end. */
export async function listContributions(
  projectId: number,
  status?: "PENDING" | "APPROVED" | "REJECTED",
): Promise<ContributionDto[]> {
  const items: ContributionDto[] = [];
  let cursor: number | null = null;
  for (;;) {
    const params = new URLSearchParams({ size: "50" });
    if (status) params.set("status", status);
    if (cursor !== null) params.set("cursor", String(cursor));
    const page: {
      items: ContributionDto[];
      page: { nextCursor: number | null; hasMore: boolean };
    } = await data(`/api/v1/projects/${projectId}/contributions?${params}`);
    items.push(...page.items);
    if (!page.page.hasMore || page.page.nextCursor === null || page.page.nextCursor === cursor)
      return items;
    cursor = page.page.nextCursor;
  }
}

export async function reviewContribution(
  projectId: number,
  contributionId: number,
  approvalStatus: "APPROVED" | "REJECTED",
  reviewComment: string | null = null,
) {
  return data(`/api/v1/projects/${projectId}/contributions/${contributionId}`, {
    method: "PATCH",
    body: JSON.stringify({ approvalStatus, reviewComment }),
  });
}

export async function publishComposition(projectId: number): Promise<{ exportId: number }> {
  return data(`/api/v1/projects/${projectId}/exports`, { method: "POST" });
}

export async function getExport(
  projectId: number,
  exportId: number,
): Promise<{
  status: "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED";
  errorMessage: string | null;
  shortId: number | null;
}> {
  return data(`/api/v1/projects/${projectId}/exports/${exportId}`);
}
