// Bundles the Vite build (native/web/webroot, produced by `npm run native:web` in the
// repository root) into the generated Android and iOS projects.
const { withAppBuildGradle, withXcodeProject } = require("expo/config-plugins");

const MARKER = "// narackrock: bundled web build";
const IOS_PHASE_NAME = "[Narackrock] Bundle web build";

const IOS_SCRIPT = [
  "set -e",
  'SRC="${PROJECT_DIR}/../web/webroot"',
  'if [ ! -f "${SRC}/index.html" ]; then',
  '  echo "error: ${SRC}/index.html is missing. Run npm run native:web in the repository root first."',
  "  exit 1",
  "fi",
  'DEST="${TARGET_BUILD_DIR}/${UNLOCALIZED_RESOURCES_FOLDER_PATH}/webroot"',
  'rm -rf "${DEST}"',
  'mkdir -p "${DEST}"',
  'cp -R "${SRC}/" "${DEST}/"',
].join("\n");

function withAndroidWebBundle(config) {
  return withAppBuildGradle(config, (mod) => {
    if (mod.modResults.contents.includes(MARKER)) return mod;
    mod.modResults.contents = mod.modResults.contents.replace(
      /^android\s*\{/m,
      (match) => `${match}
    ${MARKER}
    sourceSets {
        main {
            assets.srcDir("$projectDir/../../web")
        }
    }
`,
    );
    mod.modResults.contents += `
${MARKER}
tasks.named("preBuild") {
    doFirst {
        if (!file("$projectDir/../../web/webroot/index.html").exists()) {
            throw new GradleException("native/web/webroot is missing. Run \\"npm run native:web\\" in the repository root first.")
        }
    }
}
`;
    return mod;
  });
}

function withIosWebBundle(config) {
  return withXcodeProject(config, (mod) => {
    const project = mod.modResults;
    const phases = project.hash.project.objects.PBXShellScriptBuildPhase ?? {};
    const exists = Object.values(phases).some(
      (phase) => typeof phase === "object" && phase.name === `"${IOS_PHASE_NAME}"`,
    );
    if (!exists) {
      project.addBuildPhase(
        [],
        "PBXShellScriptBuildPhase",
        IOS_PHASE_NAME,
        project.getFirstTarget().uuid,
        {
          shellPath: "/bin/sh",
          shellScript: IOS_SCRIPT,
        },
      );
    }
    // The phase reads ../web outside the Xcode project, which the user-script sandbox forbids.
    const configurations = project.pbxXCBuildConfigurationSection();
    for (const key of Object.keys(configurations)) {
      const settings = configurations[key].buildSettings;
      if (settings && settings.PRODUCT_NAME) settings.ENABLE_USER_SCRIPT_SANDBOXING = "NO";
    }
    return mod;
  });
}

module.exports = function withWebBundle(config) {
  return withIosWebBundle(withAndroidWebBundle(config));
};
