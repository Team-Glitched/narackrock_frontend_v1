import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  canvasPortrait,
  resetCanvasOrientation,
  retainCanvasOrientation,
  subscribeCanvasOrientation,
  toggleCanvasOrientation,
} from "./canvas-orientation.ts";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

function mockWindow({ coarse = false, type = "portrait-primary" }: { coarse?: boolean; type?: string } = {}) {
  const events = new EventTarget();
  const pointer = Object.assign(new EventTarget(), { matches: coarse });
  const orientation = Object.assign(new EventTarget(), { type: type as string | undefined });
  const screen = { orientation, width: 390, height: 844 };
  const target = Object.assign(events, {
    screen,
    innerWidth: 390,
    innerHeight: 844,
    matchMedia: () => pointer,
  });
  return { target: target as unknown as Window, screen, pointer, orientation };
}

test("canvas orientation defaults to physical orientation and toggles manually", () => {
  resetCanvasOrientation();
  const desktop = mockWindow({ coarse: false, type: "landscape-primary" });
  assert.equal(canvasPortrait(desktop.target), true);
  assert.equal(toggleCanvasOrientation(desktop.target), false);
  assert.equal(canvasPortrait(desktop.target), false);
  assert.equal(toggleCanvasOrientation(desktop.target), true);
  assert.equal(canvasPortrait(desktop.target), true);

  resetCanvasOrientation();
  const phone = mockWindow({ coarse: true, type: "landscape-primary" });
  assert.equal(canvasPortrait(phone.target), false);
  assert.equal(toggleCanvasOrientation(phone.target), true);
  assert.equal(canvasPortrait(phone.target), true);
  resetCanvasOrientation();
});

test("window resize does not clear manual override, while physical orientation change syncs back", () => {
  resetCanvasOrientation();
  const { target, orientation } = mockWindow({ coarse: true, type: "portrait-primary" });
  const seen: boolean[] = [];
  const unsubscribe = subscribeCanvasOrientation(() => seen.push(canvasPortrait(target)), target);

  assert.equal(toggleCanvasOrientation(target), false);
  assert.equal(canvasPortrait(target), false);

  // Keyboard or resize without physical orientation change keeps manual landscape.
  Object.assign(target, { innerHeight: 300 });
  target.dispatchEvent(new Event("resize"));
  assert.equal(canvasPortrait(target), false);

  // Turning the physical device to landscape then back to portrait clears manual override.
  orientation.type = "landscape-primary";
  orientation.dispatchEvent(new Event("change"));
  orientation.type = "portrait-primary";
  orientation.dispatchEvent(new Event("change"));
  assert.equal(canvasPortrait(target), true);

  assert.deepEqual(seen, [false, false, false, true]);
  unsubscribe();
  resetCanvasOrientation();
});

test("manual orientation persists across canvas handoff and resets once all canvases unmount", async () => {
  resetCanvasOrientation();
  const desktop = mockWindow({ coarse: false });

  const releaseStudio = retainCanvasOrientation();
  assert.equal(toggleCanvasOrientation(desktop.target), false);
  assert.equal(canvasPortrait(desktop.target), false);

  // Synchronous handoff from Studio to NoteEditor keeps the chosen orientation.
  releaseStudio();
  const releaseEditor = retainCanvasOrientation();
  await Promise.resolve();
  assert.equal(canvasPortrait(desktop.target), false);

  // Leaving the last canvas resets orientation to default.
  releaseEditor();
  await Promise.resolve();
  assert.equal(canvasPortrait(desktop.target), true);
});

test("native locks non-canvas screens to portrait and renders OrientationFab on all 3 canvas screens", () => {
  const nativeAppSource = readFileSync(path.join(rootDir, "native", "App.tsx"), "utf8");
  const appConfigSource = readFileSync(path.join(rootDir, "native", "app.config.ts"), "utf8");
  const studioSource = readFileSync(
    path.join(rootDir, "src", "features", "composition", "studio-screen.tsx"),
    "utf8",
  );
  const noteEditorSource = readFileSync(
    path.join(rootDir, "src", "features", "composition", "note-editor-screen.tsx"),
    "utf8",
  );
  const sourcePianoSource = readFileSync(
    path.join(rootDir, "src", "features", "composition", "source-piano-editor.tsx"),
    "utf8",
  );
  const nativeTimelineSource = readFileSync(
    path.join(rootDir, "native", "screens", "studio", "timeline.tsx"),
    "utf8",
  );
  const nativeEditorSource = readFileSync(
    path.join(rootDir, "native", "screens", "editor", "note-editor.tsx"),
    "utf8",
  );
  const nativePianoSource = readFileSync(
    path.join(rootDir, "native", "screens", "creation", "piano.tsx"),
    "utf8",
  );

  assert.equal(nativeAppSource.includes("ScreenOrientation.OrientationLock.PORTRAIT_UP"), true);
  assert.equal(nativeAppSource.includes("canvasKinds.has(activeView.kind)"), true);
  assert.equal(nativeAppSource.includes("ScreenOrientation.OrientationLock.LANDSCAPE"), true);
  assert.equal(nativeAppSource.includes("ScreenOrientation.OrientationLock.DEFAULT"), true);

  assert.equal(appConfigSource.includes("expo-screen-orientation"), true);
  assert.equal(appConfigSource.includes('initialOrientation: "PORTRAIT_UP"'), true);

  assert.equal(studioSource.includes("<OrientationToggleButton"), true);
  assert.equal(noteEditorSource.includes("<OrientationToggleButton"), true);
  assert.equal(sourcePianoSource.includes("<OrientationToggleButton"), true);

  assert.equal(nativeTimelineSource.includes("<OrientationFab"), true);
  assert.equal(nativeEditorSource.includes("<OrientationFab"), true);
  assert.equal(nativePianoSource.includes("<OrientationFab"), true);
});
