import type { ConfigContext, ExpoConfig } from "expo/config";

import rootPackage from "../package.json";

// One version for web and app (root package.json). Store build numbers derive from it
// (1.2.3 → 10203), so bump the root version before every Play/App Store upload.
const version = rootPackage.version;
const [major = 0, minor = 0, patch = 0] = version.split(".").map(Number);
const buildNumber = major * 10000 + minor * 100 + patch;

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
  backgroundColor: "#1d1d1d",
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
