import { apiRequest } from "@/lib/api/client";
import type { ApiEnvelope, ShortsPageDto } from "@/lib/api/contracts";

export async function getShorts(cursor?: number, signal?: AbortSignal): Promise<ShortsPageDto> {
  const query = cursor === undefined ? "" : `?cursor=${encodeURIComponent(cursor)}`;
  const response = await apiRequest<ApiEnvelope<ShortsPageDto>>(`/api/v1/shorts${query}`, {
    signal,
    credentials: "omit",
  });
  if (!response.success) throw new Error(response.message);
  return response.data;
}

export async function getPopularShorts(size = 10, signal?: AbortSignal): Promise<ShortsPageDto> {
  const response = await apiRequest<ApiEnvelope<ShortsPageDto>>(
    `/api/v1/shorts/popular?size=${encodeURIComponent(size)}`,
    { signal, credentials: "omit" },
  );
  if (!response.success) throw new Error(response.message);
  return response.data;
}

export async function getMyShorts(size = 10, signal?: AbortSignal): Promise<ShortsPageDto> {
  const response = await apiRequest<ApiEnvelope<ShortsPageDto>>(
    `/api/v1/shorts/mine?size=${encodeURIComponent(size)}`,
    { signal, credentials: "omit" },
  );
  if (!response.success) throw new Error(response.message);
  return response.data;
}
