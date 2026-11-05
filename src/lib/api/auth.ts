import { apiRequest, clearAuthSession, setAuthSession } from "./client.ts";
import type { ApiResponse, GoogleLoginResponse } from "./contracts.ts";

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

export function logout(): void {
  clearAuthSession();
}
