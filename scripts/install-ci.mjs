import { spawnSync } from "node:child_process";
import { accessSync, constants } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));

if (!process.env.npm_execpath) {
  throw new Error("Run this installer with npm run install:ci.");
}

// Invoke npm's JavaScript entrypoint, avoiding platform-specific shell shims.
const installed = spawnSync(
  process.execPath,
  [
    process.env.npm_execpath,
    "ci",
    "--prefix",
    projectRoot,
    "--workspaces=false",
    "--include=dev",
    "--include=optional",
    "--prefer-offline",
    "--no-audit",
    "--no-fund",
  ],
  { stdio: "inherit" },
);
if (installed.error) throw installed.error;
if (installed.status !== 0) process.exit(installed.status ?? 1);

try {
  accessSync(
    path.join(
      projectRoot,
      "node_modules",
      ".bin",
      process.platform === "win32" ? "vite.cmd" : "vite",
    ),
    process.platform === "win32" ? constants.F_OK : constants.X_OK,
  );
} catch {
  console.error("npm ci exited successfully but the local vite executable is unavailable.");
  process.exitCode = 69;
}
