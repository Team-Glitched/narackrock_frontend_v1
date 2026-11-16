import type { ConfigContext, ExpoConfig } from "expo/config";

import rootPackage from "../package.json";
// Explicit extension: the Expo config loader does not resolve extensionless .ts imports.
import { designTokens } from "../src/styles/tokens.ts";

// One version for web and app (root package.json). Store build numbers derive from it
// (1.2.3 → 10203), so bump the root version before every Play/App Store upload. Prerelease tags are
// dropped (stores accept only x.y.z), so 1.2.3-rc.1 and 1.2.3 share a build number: upload only one.
function storeVersion(packageVersion: string): { version: string; buildNumber: number } {
  const version = packageVersion.split(/[-+]/)[0] ?? "";
  const parts = version.split(".").map(Number);
  const [major, minor, patch] = parts;
  if (
    parts.length !== 3 ||
    !parts.every(Number.isInteger) ||
    major === undefined ||
    minor === undefined ||
    patch === undefined ||
    major < 0 ||
    major > 20999 ||
    minor < 0 ||
    minor > 99 ||
    patch < 0 ||
    patch > 99
  ) {
    throw new Error(
      `package.json version "${packageVersion}" cannot become a store build number: use x.y.z with minor and patch 0-99.`,
    );
  }
  return { version, buildNumber: major * 10000 + minor * 100 + patch };
}

const { version, buildNumber } = storeVersion(rootPackage.version);

// iOS Google sign-in needs the iOS OAuth client's reversed ID as a URL scheme.
const iosGoogleClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim();
const iosGoogleUrlScheme = iosGoogleClientId
  ? `com.googleusercontent.apps.${iosGoogleClientId.replace(/\.apps\.googleusercontent\.com$/, "")}`
  : undefined;

const appId = "com.teamglitched.narackrock";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "Narackrock",
  slug: "narackrock",
  scheme: "narackrock",
  version,
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "dark",
  backgroundColor: designTokens.colors.bg,
  android: {
    package: appId,
    versionCode: buildNumber,
    permissions: ["android.permission.RECORD_AUDIO", "android.permission.MODIFY_AUDIO_SETTINGS"],
    adaptiveIcon: {
      backgroundColor: "#1d1d1d",
      foregroundImage: "./assets/android-icon-foreground.png",
      backgroundImage: "./assets/android-icon-background.png",
      monochromeImage: "./assets/android-icon-monochrome.png",
    },
    predictiveBackGestureEnabled: false,
  },
  ios: {
    bundleIdentifier: appId,
    buildNumber: String(buildNumber),
    supportsTablet: true,
    infoPlist: {
      NSMicrophoneUsageDescription: "음악을 녹음하기 위해 마이크를 사용합니다.",
    },
  },
  plugins: [
    "./plugins/with-web-bundle",
    "./plugins/with-android-network-security",
    "./plugins/with-android-release-signing",
    "./plugins/with-ios-google-sign-in-release-check",
    // Native studio audio. Playback stops in the background, so no background audio mode or
    // foreground service; RECORD_AUDIO and the iOS microphone text are declared above.
    [
      "react-native-audio-api",
      { iosBackgroundMode: false, androidForegroundService: false, androidPermissions: [] },
    ],
    [
      "expo-image-picker",
      {
        photosPermission: "게시글과 프로필에 올릴 사진을 고르기 위해 사진 보관함을 사용합니다.",
        cameraPermission: false,
        microphonePermission: false,
      },
    ],
    ...(iosGoogleUrlScheme
      ? [
          ["@react-native-google-signin/google-signin", { iosUrlScheme: iosGoogleUrlScheme }] as [
            string,
            unknown,
          ],
        ]
      : []),
  ],
});
