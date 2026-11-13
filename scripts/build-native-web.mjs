// Builds the web app for the React Native shell (native/) into native/web/webroot.
// Env comes from Vite mode "native": .env.native(.local) override .env(.local).
import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { build, loadEnv } from "vite";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));
const outDir = fileURLToPath(new URL("../native/web/webroot", import.meta.url));
const mode = "native";

const env = loadEnv(mode, projectRoot, "VITE_");
// The app has no meaningful page origin (127.0.0.1), so share links need VITE_PUBLIC_WEB_ORIGIN.
for (const key of ["VITE_API_BASE_URL", "VITE_GOOGLE_CLIENT_ID", "VITE_PUBLIC_WEB_ORIGIN"]) {
  if (!env[key]?.trim()) {
    throw new Error(`${key} is empty. Copy .env.native.example to .env.native and set it.`);
  }
}
const apiHost = new URL(env.VITE_API_BASE_URL).hostname;
if (apiHost === "localhost" || apiHost === "127.0.0.1") {
  console.warn(
    `warning: VITE_API_BASE_URL=${env.VITE_API_BASE_URL} points at the device itself, not this machine. ` +
      "Use a deployed https API, or for debug builds a LAN IP / 10.0.2.2 (Android emulator); " +
      "Android release builds block cleartext HTTP to other hosts.",
  );
}

await build({ root: projectRoot, mode, build: { outDir, emptyOutDir: true } });
// Read by native/App.tsx: `buildId` triggers re-extraction on Android, `apiOrigin`
// receives legacy relative /files/... URLs that the web ingress normally routes to the backend.
const manifest = { buildId: randomUUID(), apiOrigin: new URL(env.VITE_API_BASE_URL).origin };
writeFileSync(`${outDir}/native-build.json`, JSON.stringify(manifest));
console.log(`native web build written to ${outDir} (API: ${manifest.apiOrigin})`);
