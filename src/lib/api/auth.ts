import { apiRequest, setAccessToken } from "./client";
import type { ApiResponse, GoogleLoginResponse, TokenRefreshResponse } from "./contracts";

export function loginWithGoogle(idToken: string): Promise<GoogleLoginResponse> {
  return apiRequest<ApiResponse<GoogleLoginResponse>>("/api/v1/auth/login/google", {
    method: "POST",
    body: JSON.stringify({ idToken }),
  }).then((response) => {
    setAccessToken(response.data.accessToken);
    return response.data;
  });
}

export function refreshAccessToken(refreshToken: string): Promise<TokenRefreshResponse> {
  return apiRequest<ApiResponse<TokenRefreshResponse>>("/api/v1/auth/refresh", {
    method: "POST",
    body: JSON.stringify({ refreshToken }),
  }).then((response) => {
    setAccessToken(response.data.accessToken);
    return response.data;
  });
}
