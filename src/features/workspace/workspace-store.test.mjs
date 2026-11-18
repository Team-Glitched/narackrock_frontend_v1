import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

let server;
let workspace;
let auth;
let values;
const originalWindow = globalThis.window;
const originalStorage = globalThis.localStorage;
const scope = { origin: "http://workspace.test", userId: 4 };
const key = (userId = scope.userId) => `narackrock.workspace.v2:${scope.origin}:${userId}`;

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
});

beforeEach(async () => {
  values = new Map();
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
  globalThis.window = { localStorage: storage, location: { origin: scope.origin } };
  globalThis.localStorage = storage;
  server.moduleGraph.invalidateAll();
  auth = await server.ssrLoadModule("/src/lib/api/client.ts");
  workspace = await server.ssrLoadModule("/src/features/workspace/workspace-store.ts");
  auth.setAuthSession({ accessToken: "test", refreshToken: "test", userId: scope.userId });
});

after(async () => {
  globalThis.window = originalWindow;
  globalThis.localStorage = originalStorage;
  await server?.close();
});

function visit(id, updatedAt = "2026-11-18T00:00:00Z") {
  return { id, shortId: null, title: `work ${id}`, updatedAt };
}

test("removes only confirmed missing visits and preserves local resources and other accounts", () => {
  const resources = [{ id: 99, composition: { tracks: ["local MIDI"] } }];
  values.set(key(), JSON.stringify({ works: [visit(32), visit(8)], resources }));
  const otherAccount = JSON.stringify({ works: [visit(32)], resources: [] });
  values.set(key(7), otherAccount);
  values.set("narackrock.project-draft.v2:http://workspace.test:4", "32");

  workspace.forgetMissingWorkVisits([visit(32)], scope);

  assert.deepEqual(JSON.parse(values.get(key())), { works: [visit(8)], resources });
  assert.equal(values.get(key(7)), otherAccount);
  assert.equal(values.get("narackrock.project-draft.v2:http://workspace.test:4"), "32");
  const cleaned = values.get(key());
  workspace.forgetMissingWorkVisits([visit(32)], scope);
  assert.equal(values.get(key()), cleaned);
});

test("an old lookup cannot remove a newly revisited project", () => {
  values.set(key(), JSON.stringify({ works: [visit(32, "2026-11-18T01:00:00Z")], resources: [] }));
  workspace.forgetMissingWorkVisits([visit(32)], scope);
  assert.deepEqual(JSON.parse(values.get(key())).works, [visit(32, "2026-11-18T01:00:00Z")]);
});

test("a late lookup cannot edit the workspace after the account or backend changes", () => {
  const stored = JSON.stringify({ works: [visit(32)], resources: [] });
  values.set(key(), stored);
  values.set(key(7), stored);
  auth.setAuthSession({ accessToken: "other", refreshToken: "other", userId: 7 });
  workspace.forgetMissingWorkVisits([visit(32)], scope);
  assert.equal(values.get(key()), stored);
  assert.equal(values.get(key(7)), stored);

  auth.setAuthSession({ accessToken: "test", refreshToken: "test", userId: scope.userId });
  window.location.origin = "http://other.test";
  workspace.forgetMissingWorkVisits([visit(32)], scope);
  assert.equal(values.get(key()), stored);
});

test("blocked storage still removes missing pointers from memory without discarding local music", () => {
  const resources = [{ id: 99, composition: { tracks: ["local MIDI"] } }];
  values.set(key(), JSON.stringify({ works: [visit(32), visit(8)], resources }));
  const write = window.localStorage.setItem;
  window.localStorage.setItem = () => { throw new Error("storage blocked"); };
  workspace.forgetMissingWorkVisits([visit(32)], scope);
  window.localStorage.setItem = write;
  workspace.rememberWork({ project: { projectId: 9, title: "new" } }, null);

  const stored = JSON.parse(values.get(key()));
  assert.deepEqual(stored.works.map(({ id }) => id), [9, 8]);
  assert.deepEqual(stored.resources, resources);
});
