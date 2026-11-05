import test from "node:test";
import assert from "node:assert/strict";
import { rememberCreationDraft, readCreationDraft, clearCreationDraft } from "./creation-draft.ts";
test("drafts retain attachments across screen navigation and are isolated by user and form", () => {
  const image = new File(["image"], "cover.png", { type: "image/png" });
  const draft = { title: "작성 중", content: "본문", image, audio: null, notes: [], bpm: 120 };
  rememberCreationDraft("live:1:post", draft);
  assert.equal(readCreationDraft("live:1:post").image, image);
  assert.equal(readCreationDraft("live:2:post"), undefined);
  assert.equal(readCreationDraft("live:1:source"), undefined);
  clearCreationDraft("live:1:post");
  assert.equal(readCreationDraft("live:1:post"), undefined);
});

test("private source visibility survives persistent restoration and never publishes", async () => {
  const values = new Map();
  const previousStorage = globalThis.localStorage;
  globalThis.localStorage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
  try {
    await rememberCreationDraft("source-visibility", { title: "비공개", content: "", image: null, audio: null, notes: [], bpm: 120, sourceVisibility: "PRIVATE" });
    const { restoreCreationDraft } = await import(`./creation-draft.ts?reload=${Date.now()}`);
    const restored = await restoreCreationDraft("source-visibility");
    assert.equal(restored.sourceVisibility, "PRIVATE");
    const { publishSource } = await import("../sources/publish-source.ts");
    let visibilityCalls = 0;
    await publishSource({ userId: 1, draftKey: "restored-private", title: restored.title, description: null, audio: new File(["audio"], "a.wav"), image: null, visibility: restored.sourceVisibility }, {
      storage: globalThis.localStorage,
      uploadMedia: async () => 10,
      listMyOpenSourcePublications: async () => ({ items: [], hasNext: false }),
      createOpenSource: async () => ({ openSourceId: 20 }),
      updateOpenSource: async () => {},
      setOpenSourceVisibility: async () => { visibilityCalls++; },
    });
    assert.equal(visibilityCalls, 0);
  } finally { clearCreationDraft("source-visibility"); if (previousStorage === undefined) delete globalThis.localStorage; else globalThis.localStorage = previousStorage; }
});
