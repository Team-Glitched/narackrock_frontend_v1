import {
  GoogleSignin,
  isCancelledResponse,
  isErrorWithCode,
  statusCodes,
} from "@react-native-google-signin/google-signin";
import { Platform } from "react-native";

import type { GoogleSignInResult } from "../src/lib/native-bridge-protocol";

class NotConfiguredError extends Error {
  readonly code = "NOT_CONFIGURED";
}

/**
 * Native Google sign-in. `webClientId` makes Google issue the ID token for the web client, which is
 * the audience the backend verifies. Android needs an Android OAuth client (package + SHA-1) in the
 * same Google Cloud project; iOS needs EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID (Release builds fail without it).
 */
export async function signInWithGoogle(webClientId: string): Promise<GoogleSignInResult> {
  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim();
  // GoogleSignIn-iOS throws a native exception without a client ID and URL scheme; fail softly instead.
  if (Platform.OS === "ios" && !iosClientId)
    throw new NotConfiguredError("iOS Google 로그인 설정이 필요합니다.");
  GoogleSignin.configure({ webClientId, iosClientId: iosClientId || undefined });
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  // The web app owns the session; always show the account picker so users can switch accounts.
  await GoogleSignin.signOut();
  try {
    const response = await GoogleSignin.signIn();
    if (isCancelledResponse(response)) return { cancelled: true };
    if (!response.data.idToken) throw new Error("Google ID 토큰을 받지 못했습니다.");
    return { idToken: response.data.idToken };
  } catch (cause) {
    if (isErrorWithCode(cause) && cause.code === statusCodes.SIGN_IN_CANCELLED)
      return { cancelled: true };
    throw cause;
  }
}
