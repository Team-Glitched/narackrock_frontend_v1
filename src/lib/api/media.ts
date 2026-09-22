import { apiRequest } from "@/lib/api/client";
import type { ApiEnvelope } from "@/lib/api/contracts";

async function data<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await apiRequest<ApiEnvelope<T>>(path, init);
  if (!response.success) throw new Error(response.message);
  return response.data;
}

export async function uploadMedia(file: File, fileType: "AUDIO" | "IMAGE"): Promise<number> {
  const session = await data<{ mediaFileId: number; uploadUrl: string; method: string }>("/api/v1/media/upload-sessions", {
    method: "POST",
    body: JSON.stringify({ fileType, fileName: file.name, mimeType: file.type, fileSize: file.size }),
  });
  await apiRequest<void>(session.uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type },
    body: file,
  });
  await data(`/api/v1/media/${session.mediaFileId}/complete`, { method: "POST" });
  return session.mediaFileId;
}
