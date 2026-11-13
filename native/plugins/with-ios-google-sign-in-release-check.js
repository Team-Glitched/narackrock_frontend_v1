// Fails iOS Release builds whose Info.plist lacks the Google sign-in URL scheme, i.e. that were
// prebuilt without EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID. Debug builds still work: the login button then
// reports "iOS Google 로그인 설정이 필요합니다." instead of crashing (see native/google-sign-in.ts).
const { withXcodeProject } = require("expo/config-plugins");

const PHASE_NAME = "[Narackrock] Require Google sign-in config in Release";

const SCRIPT = [
  'if [ "${CONFIGURATION}" != "Release" ]; then exit 0; fi',
  'if /usr/libexec/PlistBuddy -c "Print :CFBundleURLTypes" "${PROJECT_DIR}/${INFOPLIST_FILE}" 2>/dev/null | grep -q "com.googleusercontent.apps."; then exit 0; fi',
  'echo "error: Google sign-in is not configured. Set EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID in native/.env and run npm run native:prebuild."',
  "exit 1",
].join("\n");

module.exports = function withIosGoogleSignInReleaseCheck(config) {
  return withXcodeProject(config, (mod) => {
    const project = mod.modResults;
    const phases = project.hash.project.objects.PBXShellScriptBuildPhase ?? {};
    const exists = Object.values(phases).some(
      (phase) => typeof phase === "object" && phase.name === `"${PHASE_NAME}"`,
    );
    if (!exists) {
      project.addBuildPhase(
        [],
        "PBXShellScriptBuildPhase",
        PHASE_NAME,
        project.getFirstTarget().uuid,
        {
          shellPath: "/bin/sh",
          shellScript: SCRIPT,
        },
      );
    }
    return mod;
  });
};
