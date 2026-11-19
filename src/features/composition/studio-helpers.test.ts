import test, { beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { setAuthSession, clearAuthSession } from "../../lib/api/client.ts";
import {
  getResumableProject, projectDraftKey, setStoredDraftId, storedDraftId, subscribeToDraft,
} from "./studio-helpers.ts";
import type { CompositionDto } from "../../lib/api/composition.ts";

const scope = { origin: "http://draft.test", userId: 1 };
const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
const originalFetch = globalThis.fetch;
let rows: Map<string, string>;
let events: EventTarget;
let storage: Storage;
let requests: Array<{ url: string; method: string }>;

function composition(): CompositionDto {
  return {
    viewerPermission: { userId: 1, canEdit: true, canContribute: true, canReviewContribution: true, canExport: true },
    project: {
      projectId: 42, title: "mine", ownerId: 1, albumImageFileId: null,
      bpm: 120, ppq: 480, timeSignatureNumerator: 4, timeSignatureDenominator: 4,
      maxTick: 57600, maxDurationMs: 60000, status: "DRAFT", isPublic: false,
      version: { major: 1, minor: 0, display: "1.0" },
    },
    tracks: [],
  };
}

beforeEach(() => {
  rows = new Map();
  events = new EventTarget();
  requests = [];
  storage = {
    get length() { return rows.size; },
    key: (index) => [...rows.keys()][index] ?? null,
    getItem: (key) => rows.get(key) ?? null,
    setItem: (key, value) => { rows.set(key, value); },
    removeItem: (key) => { rows.delete(key); },
    clear: () => { rows.clear(); },
  };
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      localStorage: storage, location: { origin: scope.origin },
      addEventListener: events.addEventListener.bind(events),
      removeEventListener: events.removeEventListener.bind(events),
    },
  });
  setAuthSession({ accessToken: "test", refreshToken: "test-refresh", userId: 1 });
  globalThis.fetch = async (url, init) => {
    requests.push({ url: String(url), method: init?.method ?? "GET" });
    return Response.json({ success: true, data: composition() });
  };
});
afterEach(() => {
  clearAuthSession();
  globalThis.fetch = originalFetch;
  if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
  else Reflect.deleteProperty(globalThis, "window");
});

test("resuming validates the live identity, owner, permission, and active status using only GET", async () => {
  assert.equal((await getResumableProject(42, scope)).project.projectId, 42);
  for (const change of [
    (dto: CompositionDto) => { dto.project.projectId = 43; },
    (dto: CompositionDto) => { dto.project.ownerId = 2; },
    (dto: CompositionDto) => { dto.viewerPermission.userId = 2; },
    (dto: CompositionDto) => { dto.viewerPermission.canEdit = false; },
    (dto: CompositionDto) => { dto.project.status = "COMPLETED"; },
  ]) {
    const dto = composition();
    change(dto);
    globalThis.fetch = async () => Response.json({ success: true, data: dto });
    await assert.rejects(getResumableProject(42, scope), /소유한 편집 가능한/);
  }
  assert.deepEqual(requests, [{ url: "/api/v1/projects/42/tracks?view=WORKING", method: "GET" }]);
});

test("scope mismatches prevent requests and in-flight account/origin replacements are rejected", async () => {
  await assert.rejects(getResumableProject(42, { ...scope, userId: 2 }), /변경/);
  assert.equal(requests.length, 0);
  globalThis.fetch = async () => {
    setAuthSession({ accessToken: "other", refreshToken: "other-refresh", userId: 2 });
    return Response.json({ success: true, data: composition() });
  };
  await assert.rejects(getResumableProject(42, scope), /계정/);
  setAuthSession({ accessToken: "test", refreshToken: "test-refresh", userId: 1 });
  globalThis.fetch = async () => {
    Object.assign(window.location, { origin: "http://other.test" });
    return Response.json({ success: true, data: composition() });
  };
  await assert.rejects(getResumableProject(42, scope), /변경/);
});

test("permission and missing-project errors are not converted into empty projects", async () => {
  for (const status of [403, 404, 401]) {
    globalThis.fetch = async () => Response.json({ message: `denied ${status}` }, { status });
    await assert.rejects(getResumableProject(42, scope), new RegExp(`denied ${status}`));
  }
});

test("pointer subscriptions observe same-tab writes, scoped storage events, and account changes", () => {
  let notifications = 0;
  const unsubscribe = subscribeToDraft(() => { notifications++; });
  rows.set("glitched-composition-draft-id", "9");
  setStoredDraftId(42, scope);
  assert.equal(storedDraftId(), 42);
  assert.equal(notifications, 1);
  assert.equal(rows.get("glitched-composition-draft-id"), "9");
  const dispatch = (key: string | null) => {
    const event = new Event("storage");
    Object.defineProperty(event, "key", { value: key });
    events.dispatchEvent(event);
  };
  dispatch(projectDraftKey({ ...scope, userId: 2 }));
  assert.equal(notifications, 1);
  dispatch(projectDraftKey(scope));
  assert.equal(notifications, 2);
  setAuthSession({ accessToken: "other", refreshToken: "other-refresh", userId: 2 });
  assert.equal(notifications, 3);
  assert.equal(storedDraftId(), null);
  assert.throws(() => setStoredDraftId(99, scope), /변경/);
  unsubscribe();
  dispatch(null);
  clearAuthSession();
  assert.equal(notifications, 3);
});

test("read failures return null, write failures propagate, and invalid ids never write", () => {
  assert.throws(() => setStoredDraftId(0, scope), /유효/);
  assert.equal(storedDraftId(), null);
  for (const value of ["0", "-1", "1.5", "1e2", "9007199254740992"]) {
    rows.set(projectDraftKey(scope), value);
    assert.equal(storedDraftId(), null);
  }
  storage.getItem = () => { throw new Error("read blocked"); };
  assert.equal(storedDraftId(), null);
  storage.setItem = () => { throw new Error("write quota"); };
  assert.throws(() => setStoredDraftId(42, scope), /write quota/);
});
