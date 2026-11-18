import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { clearAuthSession, SessionChangedError, setAuthSession } from "../../lib/api/client.ts";
import { loadVisitedWorksPage } from "./visited-works.ts";

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
  clearAuthSession();
});

const visit = (id) => ({ id, shortId: null, title: "old title", updatedAt: "2026-11-18T00:00:00Z" });
const composition = (id, status = "DRAFT") => ({
  project: { projectId: id, title: `live title ${id}`, status },
  viewerPermission: { userId: 4, canEdit: true, canContribute: true },
  tracks: [],
});
const success = (id, status) => Response.json({ success: true, data: composition(id, status) });
const failure = (status, errorCode) => Response.json({ errorCode }, { status });
const read = (visits, { start = 0, home = false, signal = new AbortController().signal } = {}) =>
  loadVisitedWorksPage(visits, start, signal, home);

test("uses current server data while preserving the visit snapshot", async () => {
  globalThis.fetch = async () => success(8);
  const visits = [visit(8)];
  const page = await read(visits);
  assert.equal(page.items[0].work.title, "live title 8");
  assert.equal(page.items[0].work.updatedAt, visits[0].updatedAt);
  assert.equal(visits[0].title, "old title");
  assert.equal(page.next, null);
});

test("only PROJECT_NOT_FOUND marks a visit for cleanup; denied projects are quietly skipped", async () => {
  globalThis.fetch = async (url) => String(url).includes("/32/")
    ? failure(404, "PROJECT_NOT_FOUND")
    : failure(403, "PROJECT_ACCESS_DENIED");
  const page = await read([visit(32), visit(6)]);
  assert.deepEqual(page.items.map(({ missingVisit }) => missingVisit), [visit(32), null]);
  assert.ok(page.items.every(({ error, work }) => error === null && work === null));
});

test("unrecognized 404 and 403 failures remain visible and never remove history", async () => {
  for (const [status, errorCode] of [[404, "TRACK_NOT_FOUND"], [404, undefined], [403, "OTHER_DENIAL"]]) {
    globalThis.fetch = async () => failure(status, errorCode);
    const page = await read([visit(8)]);
    assert.match(page.items[0].error, /일부 작업/);
    assert.equal(page.items[0].missingVisit, null);
  }
});

test("authentication, network and server failures have distinct messages and retain history", async () => {
  for (const [response, message] of [
    [() => failure(401), /로그인/],
    [() => { throw new TypeError("Failed to fetch"); }, /네트워크/],
    [() => failure(503), /잠시 후/],
  ]) {
    globalThis.fetch = async () => response();
    const page = await read([visit(8)]);
    assert.match(page.items[0].error, message);
    assert.equal(page.items[0].missingVisit, null);
  }
});

test("home stops scanning after an authentication failure", async () => {
  let calls = 0;
  globalThis.fetch = async () => { calls++; return failure(401); };
  await read(Array.from({ length: 10 }, (_, i) => visit(i + 1)), { home: true });
  assert.equal(calls, 3);
});

test("a cancelled read cannot return missing visits to the cleanup effect", async () => {
  const controller = new AbortController();
  globalThis.fetch = async () => {
    controller.abort();
    return failure(404, "PROJECT_NOT_FOUND");
  };
  await assert.rejects(read([visit(32)], { signal: controller.signal }), { name: "AbortError" });
});

test("an account replacement discards the whole read instead of displaying a load error", async () => {
  setAuthSession({ accessToken: "old", refreshToken: "old", userId: 4 });
  globalThis.fetch = async () => {
    setAuthSession({ accessToken: "new", refreshToken: "new", userId: 7 });
    return success(8);
  };
  await assert.rejects(read([visit(8)]), SessionChangedError);
});

test("home scans past unavailable and ineligible visits and stops after three eligible works", async () => {
  const calls = [];
  globalThis.fetch = async (url) => {
    const id = Number(String(url).match(/projects\/(\d+)/)[1]);
    calls.push(id);
    if (id === 1) return failure(404, "PROJECT_NOT_FOUND");
    if (id === 2) return failure(403, "PROJECT_ACCESS_DENIED");
    return success(id, id === 3 ? "IN_PROGRESS" : "DRAFT");
  };
  const page = await read(Array.from({ length: 9 }, (_, i) => visit(i + 1)), { home: true });
  assert.deepEqual(calls, [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(page.items.flatMap(({ work }) => work ? [work.id] : []), [3, 4, 5, 6]);
  assert.ok(page.items.every(({ error }) => error === null));
});

test("workspace pagination advances over unavailable visits without skipping later works", async () => {
  globalThis.fetch = async (url) => {
    const id = Number(String(url).match(/projects\/(\d+)/)[1]);
    return id === 1 ? failure(404, "PROJECT_NOT_FOUND") : success(id);
  };
  const visits = Array.from({ length: 8 }, (_, i) => visit(i + 1));
  const first = await read(visits);
  const second = await read(visits, { start: first.next });
  assert.deepEqual(first.items.flatMap(({ work }) => work ? [work.id] : []), [2, 3, 4, 5, 6]);
  assert.deepEqual(second.items.map(({ work }) => work.id), [7, 8]);
  assert.equal(second.next, null);
});
