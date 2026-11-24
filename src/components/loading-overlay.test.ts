import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_LOADING_DELAY_MS,
  SHARK_MEMBERS,
  SHARK_MEMBER_SPECS,
  pickRandomSharkMember,
} from "./shark-member.ts";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const loaderTsxPath = path.join(rootDir, "src", "components", "shark-band-loader.tsx");
const loaderCssPath = path.join(rootDir, "src", "components", "shark-band-loader.css");
const overlayTsxPath = path.join(rootDir, "src", "components", "loading-overlay.tsx");
const assetsDir = path.join(rootDir, "src", "assets", "loading-band");

test("shark band loader bundles all 55 local SVGs without temporary Figma URLs", () => {
  const loaderSource = readFileSync(loaderTsxPath, "utf8");
  const cssSource = readFileSync(loaderCssPath, "utf8");
  const overlaySource = readFileSync(overlayTsxPath, "utf8");

  assert.equal(loaderSource.includes("figma.com/api/mcp/asset"), false);
  assert.equal(cssSource.includes("figma.com/api/mcp/asset"), false);
  assert.equal(overlaySource.includes("figma.com/api/mcp/asset"), false);

  const assetMatches = [
    ...loaderSource.matchAll(/@\/assets\/loading-band\/([a-f0-9]+\.svg)\?raw/g),
  ].map((match) => match[1]);
  assert.equal(assetMatches.length, 55);
  assert.equal(new Set(assetMatches).size, 55);

  for (const filename of assetMatches) {
    const filePath = path.join(assetsDir, filename);
    assert.equal(existsSync(filePath), true, `missing SVG asset: ${filename}`);
    assert.ok(statSync(filePath).size > 0, `empty SVG asset: ${filename}`);
    assert.equal(readFileSync(filePath, "utf8").includes("<svg"), true, `invalid SVG: ${filename}`);
  }
});

test("shark band loader includes all 5 band members and matches all 31 motion nodes", () => {
  const loaderSource = readFileSync(loaderTsxPath, "utf8");
  const cssSource = readFileSync(loaderCssPath, "utf8");

  for (const member of SHARK_MEMBERS) {
    assert.equal(loaderSource.includes(`data-shark-member="${member}"`), true, `missing ${member}`);
  }

  const tsxMotionIds = [...loaderSource.matchAll(/data-motion-for="([^"]+)"/g)].map((m) => m[1]);
  const cssMotionIds = [...cssSource.matchAll(/\[data-motion-for="([^"]+)"\]/g)].map((m) => m[1]);

  assert.equal(tsxMotionIds.length, 31);
  assert.deepEqual(new Set(tsxMotionIds), new Set(cssMotionIds));
  assert.equal(cssSource.includes("@property --motion-rotate"), true);
  assert.equal(cssSource.includes("@property --motion-translate-x"), true);
  assert.equal(cssSource.includes("@property --motion-translate-y"), true);
  assert.equal(cssSource.includes("@media (prefers-reduced-motion: reduce)"), true);
});

test("loading overlay defaults to 1s slow-load threshold and configures accessibility semantics", () => {
  assert.equal(DEFAULT_LOADING_DELAY_MS, 1000);
  const overlaySource = readFileSync(overlayTsxPath, "utf8");
  assert.equal(overlaySource.includes("DEFAULT_LOADING_DELAY_MS"), true);
  assert.equal(overlaySource.includes('role="status"'), true);
  assert.equal(overlaySource.includes('aria-live="polite"'), true);
  assert.equal(overlaySource.includes('aria-busy="true"'), true);
  assert.equal(overlaySource.includes("bg-black/75"), true);
  assert.equal(overlaySource.includes("setTimeout"), true);
});

test("solo shark specs balance visual proportions across all 5 members and avoid back-to-back repeats", () => {
  for (const member of SHARK_MEMBERS) {
    const spec = SHARK_MEMBER_SPECS[member];
    const renderedW = spec.inkWidth * spec.scale;
    const renderedH = spec.inkHeight * spec.scale;
    assert.ok(renderedW >= 105 && renderedW <= 170, `${member} width out of balance: ${renderedW}`);
    assert.ok(renderedH >= 75 && renderedH <= 140, `${member} height out of balance: ${renderedH}`);
  }

  for (const previous of SHARK_MEMBERS) {
    const seen = new Set<string>();
    for (let i = 0; i < 4; i++) {
      const picked = pickRandomSharkMember(previous, () => i / 4);
      assert.notEqual(picked, previous);
      seen.add(picked);
    }
    assert.equal(seen.size, 4);
  }
});

test("loading overlay is gated on heavy audio operations and removed from lightweight screens", () => {
  const creationScreensSource = readFileSync(
    path.join(rootDir, "src", "features", "composition", "creation-screens.tsx"),
    "utf8",
  );
  const routesSource = readFileSync(path.join(rootDir, "src", "app", "routes.tsx"), "utf8");
  const newProjectSource = readFileSync(
    path.join(rootDir, "src", "features", "composition", "new-project-screen.tsx"),
    "utf8",
  );
  const createContentSource = readFileSync(
    path.join(rootDir, "src", "features", "community", "create-content.tsx"),
    "utf8",
  );

  assert.equal(creationScreensSource.includes('pendingKind === "transform"'), true);
  assert.equal(creationScreensSource.includes('pendingKind === "save"'), true);
  assert.equal(creationScreensSource.includes("{pending && !suppressLoadingOverlay"), false);
  assert.equal(routesSource.includes("<LoadingOverlay"), false);
  assert.equal(newProjectSource.includes("<LoadingOverlay"), false);
  assert.equal(createContentSource.includes('{kind === "source" && busy && <LoadingOverlay'), true);
});
