import { apiRequest, getCurrentUserId, setAuthSession } from "./client.ts";
import type { ApiResponse, GoogleLoginResponse, GoogleSignupResponse, TokenRefreshResponse } from "./contracts.ts";
import { updateProfileImage } from "./profile.ts";

function storeAuthentication(response: GoogleLoginResponse): void {
  setAuthSession({
    accessToken: response.accessToken,
    refreshToken: response.refreshToken,
    userId: response.user.userId,
  });
}

export function loginWithGoogle(idToken: string): Promise<GoogleLoginResponse> {
  return apiRequest<ApiResponse<GoogleLoginResponse>>("/api/v1/auth/login/google", {
    method: "POST",
    body: JSON.stringify({ idToken }),
  }).then((response) => {
    storeAuthentication(response.data);
    return response.data;
  });
}

export async function signupWithGoogle(
  idToken: string,
  nickname: string,
  profileImage?: File,
): Promise<GoogleSignupResponse> {
  const response = await apiRequest<ApiResponse<GoogleSignupResponse>>("/api/v1/users", {
    method: "POST",
    body: JSON.stringify({ idToken, nickname: nickname.trim() }),
  });
  storeAuthentication(response.data);
  if (profileImage) await updateProfileImage(profileImage);
  return response.data;
}

export function refreshAccessToken(refreshToken: string): Promise<TokenRefreshResponse> {
  return apiRequest<ApiResponse<TokenRefreshResponse>>("/api/v1/auth/refresh", {
    method: "POST",
    body: JSON.stringify({ refreshToken }),
  }).then((response) => {
    const userId = getCurrentUserId();
    if (userId != null) setAuthSession({
      accessToken: response.data.accessToken,
      refreshToken: response.data.refreshToken,
      userId,
    });
    return response.data;
  });
}
