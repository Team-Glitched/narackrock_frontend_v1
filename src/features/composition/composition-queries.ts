import { queryOptions } from "@tanstack/react-query";
import { enterComposition, getComposition } from "@/lib/api/composition";
import { getEditorDrafts } from "@/lib/api/composition-drafts";
import { queryScope } from "@/lib/query";

export const compositionKeys = {
  all: (userId: number | null) => [...queryScope(userId), "composition"] as const,
  /** Everything read for one project: the shared tracks and the viewer's personal drafts. */
  project: (userId: number | null, projectId: number) =>
    [...compositionKeys.all(userId), projectId] as const,
  detail: (userId: number | null, projectId: number) =>
    [...compositionKeys.project(userId, projectId), "tracks"] as const,
  drafts: (userId: number | null, projectId: number) =>
    [...compositionKeys.project(userId, projectId), "editor-drafts"] as const,
  /** The project a short opens in the studio. */
  entry: (userId: number | null, shortId: number) =>
    [...compositionKeys.all(userId), "short-entry", shortId] as const,
};

export const compositionQuery = (userId: number | null, projectId: number) =>
  queryOptions({
    queryKey: compositionKeys.detail(userId, projectId),
    queryFn: ({ signal }) => getComposition(projectId, signal),
  });

export const editorDraftsQuery = (userId: number | null, projectId: number) =>
  queryOptions({
    queryKey: compositionKeys.drafts(userId, projectId),
    queryFn: ({ signal }) => getEditorDrafts(projectId, signal),
  });

export const compositionEntryQuery = (userId: number | null, shortId: number) =>
  queryOptions({
    queryKey: compositionKeys.entry(userId, shortId),
    queryFn: ({ signal }) => enterComposition(shortId, signal),
  });
