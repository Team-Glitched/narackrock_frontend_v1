import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import { DraftSession, draftStorageKey, removeLocalDraft } from "./editor-draft.ts";

let server;
let releaseAbandonedLayer;
const originalWindow = globalThis.window;
const originalFetch = globalThis.fetch;
const context = {
  origin: "http://api.test",
  userId: 1,
  projectId: 2,
  trackId: 3,
  targetClipId: null,
};
const empty = { startTick: 0, durationTick: 480, midiNotes: [] };

before(async () => {
  const root = fileURLToPath(new URL("../../..", import.meta.url));
  server = await createServer({
    root,
    configFile: false,
    resolve: { alias: { "@": `${root}/src` } },
    server: { middlewareMode: true, watch: null, hmr: false, ws: false },
    optimizeDeps: { noDiscovery: true, include: [] },
    appType: "custom",
  });
  ({ releaseAbandonedLayer } = await server.ssrLoadModule(
    "/src/features/composition/composition-actions.ts",
  ));
});

after(async () => {
  globalThis.window = originalWindow;
  globalThis.fetch = originalFetch;
  await server?.close();
});

function setup(t, { clips = [], drafts = [], ownerId = 1 } = {}) {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
    get length() {
      return values.size;
    },
    key: (index) => [...values.keys()][index] ?? null,
  };
  globalThis.window = { localStorage: storage, location: { origin: context.origin } };
  const deleted = [];
  globalThis.fetch = async (url, init) => {
    let data;
    if (init?.method === "DELETE") {
      deleted.push(String(url));
      data = {};
    } else if (String(url).endsWith("/editor-drafts")) data = drafts;
    else if (String(url).endsWith("/projects/2/tracks")) {
      data = { viewerPermission: { userId: 1 }, tracks: [{ trackId: 3, ownerId, clips }] };
    } else throw new Error(`Unexpected request: ${url}`);
    return new Response(JSON.stringify({ success: true, data }), { status: 200 });
  };
  t.after(() => {
    globalThis.window = originalWindow;
    globalThis.fetch = originalFetch;
  });
  return { values, storage, deleted };
}

test("preserves locally kept notes after the first server save fails, including recovery-only copies", async (t) => {
  const { storage, values, deleted } = setup(t);
  const session = new DraftSession({
    context,
    content: empty,
    baseClip: null,
    storage,
    save: async () => {
      throw new Error("offline");
    },
  });
  session.edit({
    ...empty,
    midiNotes: [
      {
        pitch: 60,
        startTick: 0,
        durationTick: 480,
        velocity: 100,
        effectType: null,
        effectParams: {},
      },
    ],
  });
  await assert.rejects(session.flush(), /offline/);
  assert.equal(session.getSnapshot().localProtected, true);
  session.dispose();
  await releaseAbandonedLayer(2);
  assert.deepEqual(deleted, []);
  values.delete(draftStorageKey(context));
  await releaseAbandonedLayer(2);
  assert.deepEqual(deleted, []);
  removeLocalDraft(storage, context, session.getLocalRecord().draftId);
  await releaseAbandonedLayer(2);
  assert.deepEqual(deleted, ["/api/v1/tracks/3"]);
});

test("releases an empty track without any server or local draft", async (t) => {
  const { deleted } = setup(t);
  await releaseAbandonedLayer(2);
  assert.deepEqual(deleted, ["/api/v1/tracks/3"]);
});

test("preserves tracks with server drafts, shared clips, or another owner", async (t) => {
  for (const options of [
    { drafts: [{ trackId: 3, status: "ACTIVE" }] },
    { clips: [{ clipId: 4 }] },
    { ownerId: 9 },
  ]) {
    const { deleted } = setup(t, options);
    await releaseAbandonedLayer(2);
    assert.deepEqual(deleted, []);
  }
});

test("unrelated accounts, projects and servers do not prevent abandoned track cleanup", async (t) => {
  const { storage, deleted } = setup(t);
  for (const other of [{ userId: 9 }, { projectId: 9 }, { origin: "http://other.test" }]) {
    const session = new DraftSession({
      context: { ...context, ...other },
      content: empty,
      baseClip: null,
      storage,
      save: async () => {
        throw new Error("offline");
      },
    });
    session.edit(empty);
    session.dispose();
  }
  await releaseAbandonedLayer(2);
  assert.deepEqual(deleted, ["/api/v1/tracks/3"]);
});

test("does not delete a track when browser recovery storage is inaccessible", async (t) => {
  const { deleted } = setup(t);
  Object.defineProperty(globalThis.window, "localStorage", {
    get() {
      throw new Error("storage unavailable");
    },
  });
  await releaseAbandonedLayer(2);
  assert.deepEqual(deleted, []);
});
