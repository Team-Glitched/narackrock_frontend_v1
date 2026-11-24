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
import {
  initialNativeOrientation,
  reduceNativeOrientation,
  resolveNativeLockMode,
  runWithPortraitAllowed,
  type NativeLockMode,
  type NativeOrientationState,
} from "../../native/orientation.ts";

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

  const webToggleSource = readFileSync(
    path.join(rootDir, "src", "components", "orientation-toggle-button.tsx"),
    "utf8",
  );
  const nativeToggleSource = readFileSync(
    path.join(rootDir, "native", "ui", "orientation-fab.tsx"),
    "utf8",
  );
  const portraitNoteSource = readFileSync(
    path.join(rootDir, "src", "features", "composition", "note-editor-portrait.tsx"),
    "utf8",
  );
  assert.equal(webToggleSource.includes("M5.42 8.54"), true);
  assert.equal(nativeToggleSource.includes("M5.42 8.54"), true);
  assert.equal(webToggleSource.includes("#23232a"), true);
  assert.equal(webToggleSource.includes("#32323d"), true);
  assert.equal(webToggleSource.includes("#9966ff"), false);
  assert.equal(webToggleSource.includes("#241e33"), false);
  assert.equal(nativeToggleSource.includes("#23232a"), true);
  assert.equal(nativeToggleSource.includes("#32323d"), true);
  assert.equal(nativeToggleSource.includes("#241e33"), false);
  assert.equal(nativeToggleSource.includes("153, 102, 255"), false);
  assert.equal(portraitNoteSource.includes("{rollOverlay}"), true);

  const bridgeSource = readFileSync(path.join(rootDir, "native", "bridge.ts"), "utf8");
  assert.equal(bridgeSource.includes("host.withPortraitAllowed("), true);
});

test("native orientation keeps manual canvas selection across empty view gaps and resets on non-canvas", () => {
  // Initial launch before any screen reports a view stays locked to portrait.
  let state = reduceNativeOrientation(initialNativeOrientation, null);
  assert.deepEqual(state, { allowsLandscape: false, manualOrientation: null });
  assert.equal(resolveNativeLockMode(state), "portrait");

  // Studio mounts and user toggles manually to landscape.
  state = reduceNativeOrientation(state, true);
  state = { ...state, manualOrientation: "landscape" };
  assert.equal(resolveNativeLockMode(state), "landscape");

  // Outgoing Studio sends `view: null` before Piano Roll (or loading -> ready bridge) reports its view:
  // `isCanvas === null` must preserve both canvas capability and manual landscape lock.
  state = reduceNativeOrientation(state, null);
  assert.deepEqual(state, { allowsLandscape: true, manualOrientation: "landscape" });
  assert.equal(resolveNativeLockMode(state), "landscape");

  // Confirming the next canvas (e.g., Piano Roll) keeps the manual landscape choice.
  state = reduceNativeOrientation(state, true);
  assert.deepEqual(state, { allowsLandscape: true, manualOrientation: "landscape" });
  assert.equal(resolveNativeLockMode(state), "landscape");

  // Confirming a non-canvas screen clears the manual choice and locks to portrait.
  state = reduceNativeOrientation(state, false);
  assert.deepEqual(state, { allowsLandscape: false, manualOrientation: null });
  assert.equal(resolveNativeLockMode(state), "portrait");
});

test("native temporarily permits portrait for image picker without erasing canvas landscape lock", async () => {
  const state: NativeOrientationState = { allowsLandscape: true, manualOrientation: "landscape" };
  const countRef = { current: 0 };
  const counts: number[] = [];
  const events: string[] = [];

  const picked = await runWithPortraitAllowed({
    getState: () => state,
    countRef,
    onCountChange: (count) => counts.push(count),
    applyLock: async (mode: NativeLockMode) => {
      events.push(`lock:${mode}`);
    },
    task: async () => {
      events.push("task:start");
      assert.equal(resolveNativeLockMode(state, countRef.current), "default");
      events.push("task:end");
      return "image.jpg";
    },
  });

  assert.equal(picked, "image.jpg");
  assert.deepEqual(events, ["lock:default", "task:start", "task:end", "lock:landscape"]);
  assert.deepEqual(counts, [1, 0]);
  assert.deepEqual(state, { allowsLandscape: true, manualOrientation: "landscape" });

  // Also restores landscape lock if the picker throws / fails.
  const failEvents: string[] = [];
  await assert.rejects(
    runWithPortraitAllowed({
      getState: () => state,
      countRef,
      applyLock: async (mode) => {
        failEvents.push(`lock:${mode}`);
      },
      task: async () => {
        failEvents.push("task:throw");
        throw new Error("picker failed");
      },
    }),
    /picker failed/,
  );
  assert.deepEqual(failEvents, ["lock:default", "task:throw", "lock:landscape"]);
  assert.equal(countRef.current, 0);

  // Overlapping concurrent calls keep portrait allowed until the last request finishes.
  const overlapEvents: string[] = [];
  let releaseFirst!: () => void;
  const first = runWithPortraitAllowed({
    getState: () => state,
    countRef,
    applyLock: async (mode) => {
      overlapEvents.push(`lock:${mode}`);
    },
    task: () =>
      new Promise<void>((resolve) => {
        overlapEvents.push("first:open");
        releaseFirst = resolve;
      }),
  });
  // Allow first microtask turn (`applyLock("default")`) before second call starts.
  await Promise.resolve();
  const second = runWithPortraitAllowed({
    getState: () => state,
    countRef,
    applyLock: async (mode) => {
      overlapEvents.push(`lock:${mode}`);
    },
    task: async () => {
      overlapEvents.push("second:run");
    },
  });
  await second;
  assert.equal(overlapEvents.includes("lock:landscape"), false);
  releaseFirst();
  await first;
  assert.equal(overlapEvents.at(-1), "lock:landscape");
  assert.equal(countRef.current, 0);

  // On a non-canvas screen, portrait lock stays "portrait" throughout without unlocking landscape.
  const nonCanvas: NativeOrientationState = { allowsLandscape: false, manualOrientation: null };
  const nonCanvasLocks: NativeLockMode[] = [];
  await runWithPortraitAllowed({
    getState: () => nonCanvas,
    countRef,
    applyLock: async (mode) => {
      nonCanvasLocks.push(mode);
    },
    task: async () => {
      assert.equal(resolveNativeLockMode(nonCanvas, countRef.current), "portrait");
    },
  });
  assert.deepEqual(nonCanvasLocks, ["portrait"]);
});
