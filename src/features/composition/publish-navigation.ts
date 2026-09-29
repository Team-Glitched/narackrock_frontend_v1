type ExportNavigationStatus = {
  status: "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED";
  shortId: number | null;
};

export function completedExportShortId(result: ExportNavigationStatus): number | null {
  if (result.status !== "COMPLETED") return null;
  if (result.shortId == null) throw new Error("생성된 숏폼을 찾을 수 없습니다.");
  return result.shortId;
}
