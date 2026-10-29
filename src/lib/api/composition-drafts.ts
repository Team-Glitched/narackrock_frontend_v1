import { apiRequest } from "@/lib/api/client";
import type { ApiEnvelope } from "@/lib/api/contracts";
import type { DraftSaveRequest, ServerDraft } from "@/features/composition/editor-draft";

async function data<T>(path: string, init?: RequestInit): Promise<T> {
  const result = await apiRequest<ApiEnvelope<T>>(path, init);
  if (!result.success) throw new Error(result.message);
  return result.data;
}

export const getEditorDrafts = (projectId: number) => data<ServerDraft[]>(`/api/v1/projects/${projectId}/editor-drafts`);
export const getEditorDraft = (projectId: number, draftId: string) => data<ServerDraft>(`/api/v1/projects/${projectId}/editor-drafts/${draftId}`);
export const saveEditorDraft = (projectId: number, trackId: number, draftId: string, request: DraftSaveRequest) =>
  data<ServerDraft>(`/api/v1/projects/${projectId}/tracks/${trackId}/editor-drafts/${draftId}`, {
    method: "PUT", body: JSON.stringify(request),
  });
export const commitEditorDraft = (projectId: number, draftId: string, expectedRevision: number) =>
  data<ServerDraft>(`/api/v1/projects/${projectId}/editor-drafts/${draftId}/commit`, {
    method: "POST", body: JSON.stringify({ expectedRevision }),
  });
export const discardEditorDraft = (projectId: number, draftId: string, expectedRevision: number) =>
  data<ServerDraft>(`/api/v1/projects/${projectId}/editor-drafts/${draftId}?expectedRevision=${expectedRevision}`, { method: "DELETE" });

export const draftReferences = (drafts: ServerDraft[]) => drafts.map(d => ({ draftId: d.draftId, expectedRevision: d.revision }));
export const commitEditorDrafts = (projectId: number, drafts: ServerDraft[]) =>
  data<ServerDraft[]>(`/api/v1/projects/${projectId}/editor-drafts/commit`, {
    method: "POST", body: JSON.stringify({ drafts: draftReferences(drafts) }),
  });
export const submitEditorDrafts = (projectId: number, drafts: ServerDraft[],
  baseProjectVersion: { major: number; minor: number }, description: string) =>
  data(`/api/v1/projects/${projectId}/editor-drafts/submit`, {
    method: "POST", body: JSON.stringify({ drafts: draftReferences(drafts), baseProjectVersion, description }),
  });
