import test from "node:test";
import assert from "node:assert/strict";
import { readBrowserRecord } from "../../lib/browser/records.ts";
// Minimal asynchronous IndexedDB/Storage adapter: exercise refresh, serialization and ordering.
const files = new Map(),
  metadata = new Map();
globalThis.localStorage = {
  getItem: (key) => metadata.get(key) ?? null,
  setItem: (key, value) => metadata.set(key, String(value)),
  removeItem: (key) => metadata.delete(key),
};
const database = {
  objectStoreNames: { contains: () => true },
  transaction() {
    const transaction = {
      objectStore() {
        return {
          put(value, key) {
            files.set(key, value);
            queueMicrotask(() => transaction.oncomplete?.());
          },
          delete(key) {
            files.delete(key);
            queueMicrotask(() => transaction.oncomplete?.());
          },
          get(key) {
            const request = {};
            queueMicrotask(() => {
              request.result = files.get(key);
              request.onsuccess?.();
            });
            return request;
          },
        };
      },
    };
    return transaction;
  },
};
globalThis.indexedDB = {
  open() {
    const request = {};
    queueMicrotask(() => {
      request.result = database;
      request.onsuccess?.();
    });
    return request;
  },
};

test("refresh restores draft text and files, while discard cannot resurrect queued writes", async () => {
  const first = await import("./creation-draft.ts?first");
  const image = new File(["image data"], "cover.png", { type: "image/png" });
  const audio = new File(["wave data"], "track.wav", { type: "audio/wav" });
  const draft = { title: "제목", content: "본문", image, audio, notes: [], bpm: 123 };
  await first.rememberCreationDraft("live:1:post", draft);
  const refreshed = await import("./creation-draft.ts?refresh");
  const restored = await refreshed.restoreCreationDraft("live:1:post");
  assert.equal(restored.title, "제목");
  assert.equal(await restored.image.text(), "image data");
  assert.equal(await restored.audio.text(), "wave data");
  assert.equal(await refreshed.restoreCreationDraft("live:2:post"), undefined);
  const writing = refreshed.rememberCreationDraft("live:1:post", { ...draft, image: null });
  refreshed.clearCreationDraft("live:1:post");
  await writing;
  assert.equal(await readBrowserRecord("narackrock.creation-draft.live:1:post"), undefined);
  assert.equal(files.has("narackrock.creation-draft.live:1:post"), false);
  assert.equal(
    (await import("./creation-draft.ts?after-discard")).readCreationDraft("live:1:post"),
    undefined,
  );
});
test("source bookmarks survive refresh with audio, share remove state and isolate accounts", async () => {
  const first = await import("./saved-sources.ts?first");
  const source = {
    id: 987,
    title: "저장한 레이어",
    description: "설명",
    author: "작성자",
    userId: 2,
    mediaUrl: null,
    imageUrl: null,
  };
  const file = new File(["saved audio"], "layer.wav", { type: "audio/wav" });
  await first.toggleSavedSource("live.1", source, file);
  const refreshed = await import("./saved-sources.ts?refresh");
  const saved = refreshed.savedSourcesSnapshot("live.1");
  assert.equal(saved.length, 1);
  assert.equal(await (await refreshed.readSavedSourceAudio(saved[0])).text(), "saved audio");
  assert.equal(refreshed.savedSourcesSnapshot("live.2").length, 0);
  refreshed.removeSavedSource("live.1", source.id);
  assert.equal(first.savedSourcesSnapshot("live.1").length, 0);
});

test("stale attachment bytes cannot reappear after image removal metadata is saved", async () => {
  const drafts = await import("./creation-draft.ts?remove-image");
  const image = new File(["old image"], "old.png", { type: "image/png" });
  const draft = { title: "유지", content: "본문", image, audio: null, notes: [], bpm: 120 };
  await drafts.rememberCreationDraft("live:1:image-removal", draft);
  await drafts.rememberCreationDraft("live:1:image-removal", { ...draft, image: null });
  files.set("narackrock.creation-draft.live:1:image-removal", { image, audio: null }); // interrupted old transaction
  const refreshed = await import("./creation-draft.ts?removed-image-refresh");
  const restored = await refreshed.restoreCreationDraft("live:1:image-removal");
  assert.equal(restored.image, null);
  assert.equal(restored.title, "유지");
});
