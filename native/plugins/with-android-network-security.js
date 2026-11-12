// Allows cleartext HTTP only for the on-device web server (127.0.0.1) and the Metro dev
// server (localhost via adb reverse, 10.0.2.2 from the emulator); everything else stays HTTPS-only.
const fs = require("node:fs");
const path = require("node:path");
const { withAndroidManifest, withDangerousMod } = require("expo/config-plugins");

const CONFIG = `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <base-config cleartextTrafficPermitted="false" />
    <domain-config cleartextTrafficPermitted="true">
        <domain includeSubdomains="false">127.0.0.1</domain>
        <domain includeSubdomains="false">localhost</domain>
        <domain includeSubdomains="false">10.0.2.2</domain>
    </domain-config>
</network-security-config>
`;

module.exports = function withAndroidNetworkSecurity(config) {
  config = withDangerousMod(config, [
    "android",
    (mod) => {
      const dir = path.join(mod.modRequest.platformProjectRoot, "app/src/main/res/xml");
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, "network_security_config.xml"), CONFIG);
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
