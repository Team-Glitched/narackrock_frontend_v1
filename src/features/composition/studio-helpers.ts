import { apiOrigin, getCurrentUserId, subscribeCurrentUserId } from "../../lib/api/client.ts";
import { getComposition, type CompositionDto } from "../../lib/api/composition.ts";

export type DraftScope = { origin: string; userId: number };
export function projectDraftKey(scope?: DraftScope): string {
  return `narackrock.project-draft.v2:${scope?.origin ?? apiOrigin()}:${scope?.userId ?? getCurrentUserId() ?? "guest"}`;
}
export const errorText = (cause: unknown) =>
  cause instanceof Error ? cause.message : "요청을 처리하지 못했습니다.";

export const clockTime = (ms: number) =>
  `${String(Math.floor(ms / 60000)).padStart(2, "0")}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}`;

function assertScope(scope: DraftScope) {
  if (apiOrigin() !== scope.origin || getCurrentUserId() !== scope.userId)
    throw new Error("계정 또는 서버가 변경되었습니다.");
}
const draftListeners = new Set<() => void>();
export function subscribeToDraft(listener: () => void): () => void {
  draftListeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === projectDraftKey()) listener();
  };
  window.addEventListener("storage", onStorage);
  const unsubscribeAccount = subscribeCurrentUserId(() => listener());
  return () => {
    draftListeners.delete(listener);
    window.removeEventListener("storage", onStorage);
    unsubscribeAccount();
  };
}

export function storedDraftId(scope?: DraftScope): number | null {
  try {
    const raw = window.localStorage.getItem(projectDraftKey(scope));
    if (!raw || !/^[1-9]\d*$/.test(raw)) return null;
    const value = Number(raw);
    return Number.isSafeInteger(value) ? value : null;
  } catch {
    return null;
  }
}

export function setStoredDraftId(projectId: number, scope: DraftScope): void {
  assertScope(scope);
  if (!Number.isSafeInteger(projectId) || projectId <= 0)
    throw new Error("유효한 프로젝트 ID가 아닙니다.");
  window.localStorage.setItem(projectDraftKey(scope), String(projectId));
  draftListeners.forEach((listener) => listener());
}

export async function getResumableProject(
  projectId: number,
  scope: DraftScope,
): Promise<CompositionDto> {
  assertScope(scope);
  if (!Number.isSafeInteger(projectId) || projectId <= 0)
    throw new Error("유효한 프로젝트 ID가 아닙니다.");
  const composition = await getComposition(projectId);
  assertScope(scope);
  if (
    composition.project.projectId !== projectId ||
    composition.viewerPermission.userId !== scope.userId ||
    composition.project.ownerId !== scope.userId ||
    !composition.viewerPermission.canEdit ||
    !["DRAFT", "IN_PROGRESS"].includes(composition.project.status)
  )
    throw new Error("현재 계정이 소유한 편집 가능한 진행 중 프로젝트가 아닙니다.");
  return composition;
}
