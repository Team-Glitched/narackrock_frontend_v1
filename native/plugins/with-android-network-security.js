// Release builds allow cleartext HTTP only to the on-device web server (127.0.0.1) and the Metro dev
// server (localhost via adb reverse, 10.0.2.2 from the emulator); everything else is HTTPS-only.
// Debug builds override the same resource to allow any cleartext host, so a LAN API
// (e.g. http://192.168.0.10:8080) works on physical test devices.
const fs = require("node:fs");
const path = require("node:path");
const { withAndroidManifest, withDangerousMod } = require("expo/config-plugins");

const RELEASE_CONFIG = `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <base-config cleartextTrafficPermitted="false" />
    <domain-config cleartextTrafficPermitted="true">
        <domain includeSubdomains="false">127.0.0.1</domain>
        <domain includeSubdomains="false">localhost</domain>
        <domain includeSubdomains="false">10.0.2.2</domain>
    </domain-config>
</network-security-config>
`;

const DEBUG_CONFIG = `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <base-config cleartextTrafficPermitted="true" />
</network-security-config>
`;

function writeConfig(projectRoot, sourceSet, contents) {
  const dir = path.join(projectRoot, "app/src", sourceSet, "res/xml");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "network_security_config.xml"), contents);
}

module.exports = function withAndroidNetworkSecurity(config) {
  config = withDangerousMod(config, [
    "android",
    (mod) => {
      writeConfig(mod.modRequest.platformProjectRoot, "main", RELEASE_CONFIG);
      writeConfig(mod.modRequest.platformProjectRoot, "debug", DEBUG_CONFIG);
      return mod;
    },
  ]);
  return withAndroidManifest(config, (mod) => {
    const application = mod.modResults.manifest.application?.[0];
    if (application) {
      application.$["android:networkSecurityConfig"] = "@xml/network_security_config";
      delete application.$["android:usesCleartextTraffic"];
    }
    return mod;
  });
};
