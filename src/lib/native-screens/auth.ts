/** Native screen types of the auth feature; registered in ./index.ts. */

/** The login page (src/features/auth/auth-screen.tsx): greeting, Google button and its state. */
export type NativeLogin = {
  /** This device signed in before: the "다시 만나 반가워요" greeting. */
  returning: boolean;
  /** A Google client ID is configured; without it the button is disabled. */
  configured: boolean;
  /** A sign-in is running (account picker or server login). */
  busy: boolean;
  error: string | null;
};

export type NativeLoginAction = { type: "google" | "home" | "privacy" };

/** The first-login profile setup (src/features/auth/initial-profile-setup.tsx), one field per step. */
export type NativeOnboarding = {
  step: 0 | 1 | 2;
  /** The values the page holds; a step's field starts from its value. */
  values: { nickname: string; instrument: string; explanation: string };
  saving: boolean;
  error: string | null;
};

/** Submits the current step with its field's text: validates, then the next step or saving. */
export type NativeOnboardingAction = { type: "advance"; value: string };

export type AuthScreens = {
  "auth-login": { model: NativeLogin; action: NativeLoginAction };
  "auth-onboarding": { model: NativeOnboarding; action: NativeOnboardingAction };
};
