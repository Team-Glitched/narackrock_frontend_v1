import assert from "node:assert/strict";
import test from "node:test";
import { DraftSession, draftStorageKey, readLocalDraft, type DraftContent, type ServerDraft, type DraftSaveRequest } from "./editor-draft.ts";

const content: DraftContent = { startTick: 0, durationTick: 480, midiNotes: [
  { pitch: 60, startTick: 0, durationTick: 480, velocity: 100, effectType: null, effectParams: {} },
] };
const empty: DraftContent = { ...content, midiNotes: [] };
const context = { userId: 1, projectId: 2, trackId: 3, targetClipId: null };
function setup(save?: (request: DraftSaveRequest) => Promise<ServerDraft>) {
  const values = new Map<string, string>();
  const storage = { getItem: (key: string) => values.get(key) ?? null,
    get length() { return values.size; }, key: (index: number) => [...values.keys()][index] ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
  const requests: DraftSaveRequest[] = [];
  const session = new DraftSession({ context, content, baseClip: null, storage,
    save: async (request, id) => {
      requests.push(request);
      return save ? save(request) : { ...context, ownerId: 1, draftId: id, content: request.content,
        baseClip: null, revision: request.expectedRevision + 1, mutationId: request.mutationId,
        updatedAt: new Date().toISOString(), status: "ACTIVE", committedClipId: null };
    } });
  return { session, storage, values, requests };
}

test("persists the latest edit before starting any network request and isolates users", () => {
  const { session, storage, requests } = setup();
  session.edit(empty);
  assert.deepEqual(readLocalDraft(storage, context)?.content.midiNotes, []);
  assert.equal(requests.length, 0);
  assert.equal(readLocalDraft(storage, { ...context, userId: 9 }), null);
  assert.notEqual(draftStorageKey(context), draftStorageKey({ ...context, targetClipId: 7 }));
});

test("serializes saves and sends edits made during an in-flight save afterwards", async () => {
  let finish!: (value: ServerDraft) => void;
  const { session, requests } = setup(async request => {
    if (requests.length === 1) return new Promise(resolve => { finish = resolve; });
    return { ...context, ownerId: 1, draftId: "draft", baseClip: null, content: request.content,
      revision: request.expectedRevision + 1, mutationId: request.mutationId, updatedAt: "now", status: "ACTIVE", committedClipId: null };
  });
  session.edit(empty);
  const saving = session.flush();
  session.edit(content);
  const second = session.flush();
  assert.equal(requests.length, 1);
  finish({ ...context, ownerId: 1, draftId: "draft", baseClip: null, content: empty, revision: 1,
    mutationId: requests[0].mutationId, updatedAt: "now", status: "ACTIVE", committedClipId: null });
  await Promise.all([saving, second]);
  assert.equal(requests.length, 2);
  assert.equal(requests[1].expectedRevision, 1);
  assert.deepEqual(requests[1].content, content);
  assert.equal(session.getSnapshot().status, "saved");
});

test("keeps local recovery and reuses the mutation ID after a lost save response", async () => {
  let fail = true;
  const { session, storage, requests } = setup(async request => {
    if (fail) { fail = false; throw new Error("offline"); }
    return { ...context, ownerId: 1, draftId: "draft", baseClip: null, content: request.content,
      revision: 1, mutationId: request.mutationId, updatedAt: "now", status: "ACTIVE", committedClipId: null };
  });
  session.edit(empty);
  await assert.rejects(session.flush());
  assert.equal(session.getSnapshot().status, "local");
  assert.deepEqual(readLocalDraft(storage, context)?.content, empty);
  await session.flush();
  assert.equal(requests[0].mutationId, requests[1].mutationId);
});

test("does not report protected edits when browser storage fails", () => {
  const { session } = setup();
  session.storage = { getItem: () => null, setItem: () => { throw new Error("quota"); }, removeItem: () => {} };
  session.edit(empty);
  assert.equal(session.getSnapshot().localProtected, false);
});

test("rejects corrupted recovery data and reports server conflicts without losing notes", async () => {
  const { session, storage, values } = setup(async () => { throw Object.assign(new Error("conflict"), { status: 409 }); });
  values.clear();
  storage.setItem(draftStorageKey(context), "{broken");
  assert.equal(readLocalDraft(storage, context), null);
  session.edit(empty);
  await assert.rejects(session.flush());
  assert.equal(session.getSnapshot().status, "conflict");
  assert.deepEqual(readLocalDraft(storage, context)?.content, empty);
});

test("restores an unsynced local edit without letting the server baseline erase it", () => {
  const { session, storage } = setup();
  session.edit(empty);
  const recovered = new DraftSession({ context, content, baseClip: null, storage,
    local: readLocalDraft(storage, context)!, save: async () => { throw new Error("unused"); } });
  assert.deepEqual(recovered.getSnapshot().content, empty);
  assert.equal(recovered.getSnapshot().status, "dirty");
});

test("a competing tab cannot overwrite the current tab and preserves its own recovery copy", () => {
  const { session, storage, values } = setup();
  session.edit(empty);
  const second = new DraftSession({ context, content, baseClip: null, storage,
    local: readLocalDraft(storage, context), save: async () => { throw new Error("unused"); } });
  second.edit(content);
  session.edit({ ...empty, durationTick: 960 });
  assert.equal(session.getSnapshot().status, "conflict");
  assert.equal(session.getSnapshot().localProtected, true);
  assert.ok([...values.values()].some(raw => JSON.parse(raw).content.durationTick === 960));
  assert.ok([...values.values()].some(raw => JSON.parse(raw).content.midiNotes.length === 1));
});
