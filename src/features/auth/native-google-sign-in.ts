import { requestNative } from "@/lib/native-app";

type NativeGoogleSignInResult = { idToken: string } | { cancelled: true };

/**
 * Signs in with the platform Google account picker in the native app. The ID token is issued for
 * the web client ID, so the backend verifies it exactly like a web sign-in. Null when cancelled.
 */
export async function signInWithNativeGoogle(webClientId: string): Promise<string | null> {
  const result = await requestNative<NativeGoogleSignInResult>("google-sign-in", { webClientId });
  return "idToken" in result ? result.idToken : null;
}
