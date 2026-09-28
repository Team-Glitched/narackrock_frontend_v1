import { apiRequest } from "@/lib/api/client";
import type { ApiEnvelope } from "@/lib/api/contracts";

export { uploadMedia } from "@/lib/api/media";

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
  isMuted: boolean;
  isSolo: boolean;
  approvalStatus: string;
  clips: ClipDto[];
};

export type CompositionDto = {
  viewerPermission: { userId: number; canEdit: boolean; canContribute: boolean; canReviewContribution: boolean; canExport: boolean };
  project: {
    projectId: number;
    title: string;
    albumImageFileId: number | null;
    bpm: number;
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

export async function createTrack(projectId: number, name: string, instrument: string | null, sortOrder: number) {
  return data<{ trackId: number }>(`/api/v1/projects/${projectId}/tracks`, {
    method: "POST", body: JSON.stringify({ name, instrument, sortOrder }),
  });
}

export async function createMidiClip(projectId: number, trackId: number, startTick: number, durationTick: number, midiNotes: MidiNoteDto[]) {
  return data<{ clipId: number }>(`/api/v1/projects/${projectId}/tracks/${trackId}/clips/midi`, {
    method: "POST", body: JSON.stringify({ startTick, durationTick, midiNotes }),
  });
}

export async function saveMidiClip(clipId: number, startTick: number, durationTick: number, midiNotes: MidiNoteDto[]) {
  return data(`/api/v1/clips/${clipId}/midi`, {
    method: "PATCH", body: JSON.stringify({ startTick, durationTick, midiNotes }),
  });
}

export async function createAudioClip(projectId: number, trackId: number, mediaFileId: number, durationTick: number) {
  return data(`/api/v1/projects/${projectId}/tracks/${trackId}/clips/audio`, {
    method: "POST",
    body: JSON.stringify({ mediaFileId, sourceType: "FILE_UPLOAD", startTick: 0, durationTick, clipOffsetMs: 0 }),
  });
}

export async function createDraftProject() {
  return data<{ projectId: number }>("/api/v1/projects/drafts", { method: "POST" });
}

export async function updateProjectMetadata(projectId: number, title: string, albumImageFileId: number | null) {
  return data<void>(`/api/v1/projects/${projectId}/metadata`, {
    method: "PATCH", body: JSON.stringify({ title, albumImageFileId }),
  });
}

export type ContributionDto = {
  contributionId: number;
  userId: number;
  nickname: string;
  approvalStatus: "PENDING" | "APPROVED" | "REJECTED";
  items: { changeType: string; targetType: string; targetId: number }[];
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
  const response = await data<{ items: ContributionNotificationDto[] }>("/api/v1/notifications/contributions");
  return response.items;
}

export async function getPendingContributions(projectId: number): Promise<ContributionDto[]> {
  const response = await data<{ items: ContributionDto[] }>(`/api/v1/projects/${projectId}/contributions?status=PENDING`);
  return response.items;
}

export async function submitContribution(projectId: number, version: { major: number; minor: number }, items: { changeType: "ADD" | "UPDATE"; targetType: "TRACK" | "CLIP"; targetId: number }[], description: string | null = null) {
  return data(`/api/v1/projects/${projectId}/contributions`, {
    method: "POST", body: JSON.stringify({ description, baseProjectVersion: version, items }),
  });
}

export async function reviewContribution(projectId: number, contributionId: number, approvalStatus: "APPROVED" | "REJECTED") {
  return data(`/api/v1/projects/${projectId}/contributions/${contributionId}`, {
    method: "PATCH", body: JSON.stringify({ approvalStatus, reviewComment: null }),
  });
}

export async function publishComposition(projectId: number): Promise<{ exportId: number }> {
  return data(`/api/v1/projects/${projectId}/exports`, { method: "POST" });
}

export async function getExport(projectId: number, exportId: number): Promise<{ status: "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED"; errorMessage: string | null; shortId: number | null }> {
  return data(`/api/v1/projects/${projectId}/exports/${exportId}`);
}
