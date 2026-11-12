import {
  GoogleSignin,
  isCancelledResponse,
  isErrorWithCode,
  statusCodes,
} from "@react-native-google-signin/google-signin";

export type GoogleSignInResult = { idToken: string } | { cancelled: true };

/**
 * Native Google sign-in. `webClientId` makes Google issue the ID token for the web client, which is
 * the audience the backend verifies. Android needs an Android OAuth client (package + SHA-1) in the
 * same Google Cloud project; iOS needs EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID.
 */
export async function signInWithGoogle(webClientId: string): Promise<GoogleSignInResult> {
  GoogleSignin.configure({
    webClientId,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || undefined,
  });
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
