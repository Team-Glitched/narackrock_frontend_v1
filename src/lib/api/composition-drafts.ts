import { apiRequest } from "./client.ts";
import type { ApiEnvelope } from "./contracts.ts";
import type { SubmittedContribution } from "./composition.ts";
import type { DraftSaveRequest, ServerDraft } from "../../features/composition/editor-draft.ts";

async function data<T>(path: string, init?: RequestInit): Promise<T> {
  return (await apiRequest<ApiEnvelope<T>>(path, init)).data;
}

export const getEditorDrafts = (projectId: number) =>
  data<ServerDraft[]>(`/api/v1/projects/${projectId}/editor-drafts`);
export const getEditorDraft = (projectId: number, draftId: string) =>
  data<ServerDraft>(`/api/v1/projects/${projectId}/editor-drafts/${draftId}`);
/** Personal working copy only; never changes the shared clip. */
export const saveEditorDraft = (projectId: number, trackId: number, draftId: string, request: DraftSaveRequest) =>
  data<ServerDraft>(`/api/v1/projects/${projectId}/tracks/${trackId}/editor-drafts/${draftId}`, {
    method: "PUT",
    body: JSON.stringify(request),
  });
export const commitEditorDraft = (projectId: number, draftId: string, expectedRevision: number) =>
  data<ServerDraft>(`/api/v1/projects/${projectId}/editor-drafts/${draftId}/commit`, {
    method: "POST",
    body: JSON.stringify({ expectedRevision }),
  });
export const discardEditorDraft = (projectId: number, draftId: string, expectedRevision: number) =>
  data<ServerDraft>(`/api/v1/projects/${projectId}/editor-drafts/${draftId}?expectedRevision=${expectedRevision}`, {
    method: "DELETE",
  });

export const draftReferences = (drafts: ServerDraft[]) =>
  drafts.map((draft) => ({ draftId: draft.draftId, expectedRevision: draft.revision }));

/** Commits the given drafts in one transaction (publishing by the song owner). */
export const commitEditorDrafts = (projectId: number, drafts: ServerDraft[]) =>
  data<ServerDraft[]>(`/api/v1/projects/${projectId}/editor-drafts/commit`, {
    method: "POST",
    body: JSON.stringify({ drafts: draftReferences(drafts) }),
  });

/** Commits drafts and creates the contribution atomically; the server also collects the caller's DRAFT clips. */
export const submitEditorDrafts = (
  projectId: number,
  drafts: ServerDraft[],
  baseProjectVersion: { major: number; minor: number },
  description: string,
) =>
  data<SubmittedContribution>(`/api/v1/projects/${projectId}/editor-drafts/submit`, {
    method: "POST",
    body: JSON.stringify({ drafts: draftReferences(drafts), baseProjectVersion, description }),
  });
