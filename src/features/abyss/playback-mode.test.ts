import assert from "node:assert/strict";
import test from "node:test";

import { readPlaybackMode, writePlaybackMode } from "./playback-mode.ts";

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
  };
}

test("repeats the current short by default", () => {
  assert.equal(readPlaybackMode(memoryStorage()), "repeat");
});

test("restores the saved auto-next setting", () => {
  const storage = memoryStorage();
  writePlaybackMode(storage, "next");
  assert.equal(readPlaybackMode(storage), "next");
  writePlaybackMode(storage, "repeat");
  assert.equal(readPlaybackMode(storage), "repeat");
});

test("uses repeat if the stored setting is invalid or unavailable", () => {
  assert.equal(readPlaybackMode({ getItem: () => "invalid" }), "repeat");
  assert.equal(readPlaybackMode({ getItem: () => { throw new Error("blocked"); } }), "repeat");
});
