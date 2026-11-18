import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import { InfiniteQueryObserver, QueryClient } from "@tanstack/react-query";

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

test("later reads no longer request deleted projects but can revalidate denied and temporarily failed visits", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  const { loadVisitedWorksPage } = await server.ssrLoadModule("/src/features/workspace/visited-works.ts");
  const visits = [visit(32), visit(6), visit(8), visit(9)];
  values.set(key(), JSON.stringify({ works: visits, resources: [] }));
  const calls = [];
  globalThis.fetch = async (url) => {
    const id = Number(String(url).match(/projects\/(\d+)/)[1]);
    calls.push(id);
    if (id === 32) return Response.json({ errorCode: "PROJECT_NOT_FOUND" }, { status: 404 });
    if (id === 6) return Response.json({ errorCode: "PROJECT_ACCESS_DENIED" }, { status: 403 });
    if (id === 9) return new Response(null, { status: 503 });
    return Response.json({ success: true, data: { project: { title: "live" } } });
  };
  const page = await loadVisitedWorksPage(visits, 0, new AbortController().signal);
  workspace.forgetMissingWorkVisits(page.items.flatMap(({ missingVisit }) => missingVisit ? [missingVisit] : []), scope);
  calls.length = 0;
  await loadVisitedWorksPage(JSON.parse(values.get(key())).works, 0, new AbortController().signal);
  assert.deepEqual(calls, [6, 8, 9]);
});

test("cleanup preserves loaded pages and adjusts cursors so the next page neither skips nor reloads works", async (t) => {
  const { cleanupMissingVisitedWorks } = await server.ssrLoadModule("/src/features/workspace/visited-works-cache.ts");
  const { pagedItemsKey } = await server.ssrLoadModule("/src/hooks/use-paged-items.ts");
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, gcTime: Infinity, retry: false } } });
  t.after(() => client.clear());
  const visits = Array.from({ length: 14 }, (_, i) => visit(i + 1));
  const missing = [visits[0], visits[6]];
  values.set(key(), JSON.stringify({ works: visits, resources: [] }));
  const item = (visit) => missing.includes(visit)
    ? { work: null, error: null, missingVisit: visit }
    : { work: { ...visit }, error: null, missingVisit: null };
  const queryKey = (visits) => pagedItemsKey(4, ["composition", "visited", false, visits]);
  client.setQueryData(queryKey(visits), {
    pages: [
      { items: visits.slice(0, 6).map(item), next: 6 },
      { items: visits.slice(6, 12).map(item), next: 12 },
    ],
    pageParams: [0, 6],
  });

  cleanupMissingVisitedWorks(client, visits, missing, scope, false);

  const remaining = JSON.parse(values.get(key())).works;
  const cached = client.getQueryData(queryKey(remaining));
  assert.deepEqual(cached.pageParams, [0, 5]);
  assert.deepEqual(cached.pages.map(({ next }) => next), [5, 10]);
  assert.deepEqual(cached.pages.flatMap(({ items }) => items.map(({ work }) => work.id)), [2, 3, 4, 5, 6, 8, 9, 10, 11, 12]);

  const reads = [];
  const observer = new InfiniteQueryObserver(client, {
    queryKey: queryKey(remaining),
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      reads.push(pageParam);
      return { items: remaining.slice(pageParam, pageParam + 6).map(item), next: null };
    },
    getNextPageParam: (last) => last.next,
  });
  const result = await observer.fetchNextPage();
  assert.deepEqual(reads, [10]);
  assert.deepEqual(result.data.pages.at(-1).items.map(({ work }) => work.id), [13, 14]);
  assert.equal(result.hasNextPage, false);
});

for (const missingPage of [0, 1]) {
  test(`an entirely deleted page ${missingPage + 1} cannot hide the remaining works`, async (t) => {
    const { cleanupMissingVisitedWorks } = await server.ssrLoadModule("/src/features/workspace/visited-works-cache.ts");
    const { pagedItemsKey } = await server.ssrLoadModule("/src/hooks/use-paged-items.ts");
    const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, gcTime: Infinity, retry: false } } });
    t.after(() => client.clear());
    const visits = Array.from({ length: 14 }, (_, i) => visit(i + 1));
    const missing = visits.slice(missingPage * 6, missingPage * 6 + 6);
    const item = (visit) => missing.includes(visit)
      ? { work: null, error: null, missingVisit: visit }
      : { work: { ...visit }, error: null, missingVisit: null };
    const queryKey = (history) => pagedItemsKey(4, ["composition", "visited", false, history]);
    values.set(key(), JSON.stringify({ works: visits, resources: [] }));
    client.setQueryData(queryKey(visits), {
      pages: Array.from({ length: missingPage + 1 }, (_, page) => ({
        items: visits.slice(page * 6, page * 6 + 6).map(item), next: page * 6 + 6,
      })),
      pageParams: Array.from({ length: missingPage + 1 }, (_, page) => page * 6),
    });
    cleanupMissingVisitedWorks(client, visits, missing, scope, false);
    const remaining = JSON.parse(values.get(key())).works;
    const observer = new InfiniteQueryObserver(client, {
      queryKey: queryKey(remaining),
      initialPageParam: 0,
      queryFn: async ({ pageParam }) => ({
        items: remaining.slice(pageParam, pageParam + 6).map(item),
        next: pageParam + 6 < remaining.length ? pageParam + 6 : null,
      }),
      getNextPageParam: (last, _pages, _lastParam, requested) =>
        last.next !== null && !requested.includes(last.next) ? last.next : undefined,
    });
    if (missingPage === 1) assert.equal(observer.getCurrentResult().hasNextPage, true);
    const result = await observer.fetchNextPage();
    assert.deepEqual(result.data.pages.at(-1).items.map(({ work }) => work.id),
      missingPage === 0 ? [7, 8, 9, 10, 11, 12] : [13, 14]);
  });
}
