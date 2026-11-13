// Signs release builds with the upload key when NARACKROCK_UPLOAD_* Gradle properties are set
// (~/.gradle/gradle.properties or ORG_GRADLE_PROJECT_* env). Without them `assembleRelease` falls
// back to the debug key for local testing, but `bundleRelease` (the Play Store AAB) fails.
const { withAppBuildGradle } = require("expo/config-plugins");

const MARKER = "// narackrock: release signing";

const SIGNING_CONFIG = `
        ${MARKER}
        if (findProperty('NARACKROCK_UPLOAD_STORE_FILE')) {
            release {
                storeFile file(findProperty('NARACKROCK_UPLOAD_STORE_FILE'))
                storePassword findProperty('NARACKROCK_UPLOAD_STORE_PASSWORD')
                keyAlias findProperty('NARACKROCK_UPLOAD_KEY_ALIAS')
                keyPassword findProperty('NARACKROCK_UPLOAD_KEY_PASSWORD')
            }
        }`;

const BUNDLE_GUARD = `
${MARKER}
tasks.matching { it.name == "bundleRelease" }.configureEach {
    doFirst {
        if (!findProperty('NARACKROCK_UPLOAD_STORE_FILE')) {
            throw new GradleException("NARACKROCK_UPLOAD_STORE_FILE is not set; refusing to build a Play Store bundle with the debug key.")
        }
    }
}
`;

module.exports = function withAndroidReleaseSigning(config) {
  return withAppBuildGradle(config, (mod) => {
    let contents = mod.modResults.contents;
    if (contents.includes(MARKER)) return mod;

    const signingConfigs = /signingConfigs\s*\{/;
    const releaseSigning = /(release\s*\{[^}]*?)signingConfig signingConfigs\.debug/;
    if (!signingConfigs.test(contents) || !releaseSigning.test(contents)) {
      throw new Error(
        "with-android-release-signing: unexpected app/build.gradle layout; update the plugin.",
      );
    }
    contents = contents.replace(signingConfigs, (match) => `${match}${SIGNING_CONFIG}`);
    contents = contents.replace(
      releaseSigning,
      "$1signingConfig findProperty('NARACKROCK_UPLOAD_STORE_FILE') ? signingConfigs.release : signingConfigs.debug",
    );
    mod.modResults.contents = contents + BUNDLE_GUARD;
    return mod;
  });
};
