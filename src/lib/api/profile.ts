import { apiRequest } from "./client.ts";
import type { ApiResponse, UserProfile } from "./contracts.ts";

export async function getProfile(userId: number, signal?: AbortSignal): Promise<UserProfile> {
  const response = await apiRequest<ApiResponse<UserProfile>>(`/api/v1/users/profiles/${userId}`, { signal });
  return response.data;
}

export async function updateProfile(input: {
  nickname: string;
  primaryInstrument: string;
  explanation: string;
}): Promise<{ nickname: string; primaryInstrument: string | null; explanation: string | null }> {
  const response = await apiRequest<
    ApiResponse<{ nickname: string; primaryInstrument: string | null; explanation: string | null }>
  >("/api/v1/users/me/profile", {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  return response.data;
}

export async function updateProfileImage(image: File): Promise<{ profileImageUrl: string }> {
  const body = new FormData();
  body.append("image", image, image.name);
  const response = await apiRequest<ApiResponse<{ profileImageUrl: string }>>(
    "/api/v1/users/me/profile/image",
    {
      method: "PATCH",
      body,
    },
  );
  return response.data;
}

export const MAX_FEATURED_MUSIC = 5;

export async function addFeaturedMusic(shortId: number): Promise<void> {
  await apiRequest(`/api/v1/users/me/profile/featured-music/${shortId}`, { method: "PUT" });
}

export async function removeFeaturedMusic(shortId: number): Promise<void> {
  await apiRequest(`/api/v1/users/me/profile/featured-music/${shortId}`, { method: "DELETE" });
}

export async function clearFeaturedMusic(): Promise<void> {
  await apiRequest("/api/v1/users/me/profile/featured-music", { method: "DELETE" });
}
