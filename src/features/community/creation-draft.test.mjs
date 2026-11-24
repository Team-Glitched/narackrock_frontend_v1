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

test("a failed image restore survives autosave and reload until the user resolves it", async () => {
  const values = new Map();
  const previousStorage = globalThis.localStorage;
  globalThis.localStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
  try {
    const key = "live:3:source";
    const image = new File(["cover"], "cover.png");
    await rememberCreationDraft(key, { title: "Draft", content: "", image, audio: null, notes: [], bpm: 120 });

    const first = await import("./creation-draft.ts?image-restore-first");
    const restored = await first.restoreCreationDraft(key);
    assert.equal(restored.image, null);
    assert.equal(restored.imageRestoreFailed, true);
    await first.rememberCreationDraft(key, restored);

    const second = await import("./creation-draft.ts?image-restore-second");
    const reloaded = await second.restoreCreationDraft(key);
    assert.equal(reloaded.imageRestoreFailed, true);
    await second.rememberCreationDraft(key, { ...reloaded, imageRestoreFailed: false });

    const third = await import("./creation-draft.ts?image-restore-third");
    assert.equal((await third.restoreCreationDraft(key)).imageRestoreFailed, false);
  } finally {
    if (previousStorage === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = previousStorage;
  }
});

test("sample drafts restore the attached part and the piano-roll instrument independently", async () => {
  const values = new Map();
  const previousStorage = globalThis.localStorage;
  globalThis.localStorage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
  try {
    await rememberCreationDraft("source-instruments", { title: "악기 초안", content: "", image: null, audio: null, notes: [], bpm: 120, sourceInstrument: "vocal", pianoInstrument: "drum-kit" });
    const { restoreCreationDraft } = await import("./creation-draft.ts?instrument-restoration");
    const restored = await restoreCreationDraft("source-instruments");
    assert.equal(restored.sourceInstrument, "vocal");
    assert.equal(restored.pianoInstrument, "drum-kit");
  } finally {
    clearCreationDraft("source-instruments");
    if (previousStorage === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = previousStorage;
  }
});

test("renderedMidi snapshot stays independent from later sketch edits and clears if audio is missing", async () => {
  const values = new Map();
  const previousStorage = globalThis.localStorage;
  globalThis.localStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
  try {
    const renderedNotes = [{ pitch: 60, startTick: 0, durationTick: 480, velocity: 100 }];
    const editedNotes = [{ pitch: 72, startTick: 480, durationTick: 480, velocity: 90 }];
    const renderedAudio = new File(["wav"], "piano.wav", { type: "audio/wav" });
    await rememberCreationDraft("source-rendered-midi", {
      title: "피아노 샘플",
      content: "",
      image: null,
      audio: renderedAudio,
      renderedMidi: { ppq: 480, bpm: 120, notes: renderedNotes },
      notes: editedNotes,
      bpm: 155,
    });

    const reloaded = await import("./creation-draft.ts?rendered-midi-snapshot");
    const serialized = reloaded.readCreationDraft("source-rendered-midi");
    assert.deepEqual(serialized.renderedMidi, { ppq: 480, bpm: 120, notes: renderedNotes });
    assert.deepEqual(serialized.notes, editedNotes);
    assert.equal(serialized.bpm, 155);

    const restoredWithoutAudio = await reloaded.restoreCreationDraft("source-rendered-midi");
    assert.equal(restoredWithoutAudio.audio, null);
    assert.equal(restoredWithoutAudio.renderedMidi, null);
  } finally {
    clearCreationDraft("source-rendered-midi");
    if (previousStorage === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = previousStorage;
  }
});
