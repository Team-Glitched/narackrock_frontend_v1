import assert from "node:assert/strict";
import { test } from "node:test";
import { clearPendingPublication, getPendingSourceAudioId, getPendingSourceInstrument, getSourceDraftRevision, hasPendingPublication, publishSource, withSourcePublicationLock } from "./publish-source.ts";

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
    size: () => values.size,
  };
}

function backend({ failVisibility = 0, loseCreateResponse = false } = {}) {
  const calls = [];
  const publications = [];
  return {
    calls,
    publications,
    deps: (storage) => ({
      storage,
      uploadMedia: async (file, type) => {
        calls.push(`upload:${type}`);
        return type === "AUDIO" ? 11 : 12;
      },
      createOpenSource: async (body) => {
        calls.push("create");
        publications.push({ openSourceId: 70 + publications.length, mediaFileId: body.mediaFileId });
        if (loseCreateResponse) {
          loseCreateResponse = false;
          throw new TypeError("network lost");
        }
        return publications.at(-1);
      },
      updateOpenSource: async () => {
        calls.push("update");
      },
      setOpenSourceVisibility: async (id, visibility) => {
        calls.push(`${visibility === "PUBLIC" ? "public" : "private"}:${id}`);
        if (failVisibility-- > 0) throw new Error("503");
        return { openSourceId: id, visibility };
      },
      listMyOpenSourcePublications: async () => {
        calls.push("list");
        return { page: 0, size: 50, hasNext: false, items: publications };
      },
    }),
  };
}

const input = {
  userId: 1,
  draftKey: "live:1:source",
  title: "Riff",
  description: "loop",
  audio: new File(["a"], "a.wav"),
  image: null,
  visibility: "PUBLIC",
};

test("an active publication blocks discard, and a finished draft cannot be submitted again from a stale tab", async () => {
  const storage = memoryStorage();
  const server = backend({ failVisibility: 1 });
  const deps = server.deps(storage);
  let active = false;
  const locks = {
    async request(_key, { ifAvailable }, callback) {
      assert.equal(ifAvailable, true);
      if (active) return callback(null);
      active = true;
      try {
        return await callback({});
      } finally {
        active = false;
      }
    },
  };
  const scope = { ...input, draftRevision: getSourceDraftRevision(input, storage) };
  const entered = Promise.withResolvers();
  const release = Promise.withResolvers();
  const setVisibility = deps.setOpenSourceVisibility;
  deps.setOpenSourceVisibility = async (...args) => {
    entered.resolve();
    await release.promise;
    return setVisibility(...args);
  };
  const submit = () => withSourcePublicationLock(scope, () => publishSource(input, deps), locks, storage);
  const firstAttempt = submit();
  await entered.promise;
  await assert.rejects(
    withSourcePublicationLock(scope, () => clearPendingPublication(input, storage), locks, storage),
    /다른 탭에서 이 초안을 처리하고 있습니다/,
  );
  release.resolve();
  await assert.rejects(firstAttempt, /503/);
  assert.equal(hasPendingPublication(input, storage), true);
  assert.equal(await submit(), 70);

  await assert.rejects(submit(), /다른 탭에서 이 초안을 등록하거나 삭제했습니다/);
  assert.equal(server.publications.length, 1);
  assert.deepEqual(server.calls.filter((call) => call === "upload:AUDIO"), ["upload:AUDIO"]);
});

test("a failed publish step is retried alone without uploading or creating again", async () => {
  const storage = memoryStorage();
  const server = backend({ failVisibility: 1 });

  await assert.rejects(() => publishSource(input, server.deps(storage)));
  assert.equal(hasPendingPublication(input, storage), true);
  assert.equal(await publishSource(input, server.deps(storage)), 70);

  assert.deepEqual(server.calls, ["upload:AUDIO", "list", "create", "public:70", "public:70"]);
  assert.equal(server.publications.length, 1);
  assert.equal(storage.size(), 0);
});

test("a lost create response is recovered from the owner's publications instead of creating twice", async () => {
  const storage = memoryStorage();
  const server = backend({ loseCreateResponse: true });

  await assert.rejects(() => publishSource(input, server.deps(storage)));
  assert.equal(hasPendingPublication(input, storage), false);
  assert.equal(getPendingSourceAudioId(input, storage), 11);
  assert.equal(await publishSource({ ...input, audio: null }, server.deps(storage)), 70);
  assert.equal(getPendingSourceAudioId(input, storage), null);

  assert.equal(server.calls.filter((call) => call === "create").length, 1);
  assert.equal(server.calls.filter((call) => call.startsWith("upload")).length, 1);
  assert.equal(server.publications.length, 1);
});

test("a stale tab cannot publish with audio that differs from the pending upload it saw", async () => {
  const storage = memoryStorage();
  const server = backend({ failVisibility: 1 });
  const deps = server.deps(storage);
  const staleTab = { ...input, audio: new File(["b"], "b.wav"), expectedPendingAudioId: null };
  await assert.rejects(() => publishSource(input, deps), /503/);
  const callsAfterFailure = [...server.calls];

  await assert.rejects(() => publishSource(staleTab, deps), /다른 탭에서 등록 상태가 바뀌었습니다/);
  assert.deepEqual(server.calls, callsAfterFailure);
  assert.equal(await publishSource({ ...input, expectedPendingAudioId: 11 }, deps), 70);
});

test("discarding a failed draft lets the next draft create a separate publication with its own audio", async () => {
  const storage = memoryStorage();
  const server = backend({ failVisibility: 1 });
  const deps = server.deps(storage);
  const uploaded = [];
  deps.uploadMedia = async (file) => {
    uploaded.push(file.name);
    return uploaded.length;
  };

  await assert.rejects(() => publishSource(input, deps), /503/);
  clearPendingPublication(input, storage);
  const newDraft = { ...input, title: "New draft", audio: new File(["b"], "b.wav") };
  assert.equal(await publishSource(newDraft, deps), 71);

  assert.deepEqual(uploaded, ["a.wav", "b.wav"]);
  assert.deepEqual(server.publications.map((publication) => publication.mediaFileId), [1, 2]);
  assert.deepEqual(server.calls.filter((call) => call.startsWith("public:")), ["public:70", "public:71"]);
  assert.equal(server.calls.includes("update"), false);
});

test("edits made between attempts are applied to the existing publication before publishing", async () => {
  const storage = memoryStorage();
  const server = backend({ failVisibility: 1 });

  await assert.rejects(() => publishSource(input, server.deps(storage)));
  await publishSource({ ...input, title: "Riff v2" }, server.deps(storage));

  assert.deepEqual(server.calls.slice(-2), ["update", "public:70"]);
});

test("a retry applies the changed crop before publishing and reuses it on another retry", async () => {
  const storage = memoryStorage();
  const server = backend({ failVisibility: 2 });
  const deps = server.deps(storage);
  const uploads = [];
  const patches = [];
  deps.uploadMedia = async (file, type) => {
    if (type === "AUDIO") return 11;
    uploads.push(await file.text());
    return 11 + uploads.length;
  };
  deps.updateOpenSource = async (id, patch) => {
    patches.push([id, patch.thumbnailMediaFileId]);
    server.calls.push("update");
  };
  const crop = (bytes) => ({ ...input, image: new File([bytes], "same-name.png") });

  await assert.rejects(() => publishSource(crop("first crop"), deps), /503/);
  await assert.rejects(() => publishSource(crop("second crop"), deps), /503/);
  assert.equal(await publishSource(crop("second crop"), deps), 70);

  assert.deepEqual(uploads, ["first crop", "second crop"]);
  assert.deepEqual(patches, [[70, 13]]);
  assert.deepEqual(server.calls.slice(-4), ["public:70", "update", "public:70", "public:70"]);
  assert.equal(server.publications.length, 1);
});

test("private registration never exposes the source and finishes without a pending entry", async () => {
  const storage = memoryStorage();
  const server = backend({ failVisibility: 1 });
  const id = await publishSource({ ...input, visibility: "PRIVATE" }, server.deps(storage));

  assert.equal(id, 70);
  assert.equal(server.publications.length, 1);
  assert.equal(server.calls.some((call) => call.startsWith("public:")), false);
  assert.equal(storage.size(), 0);
});

test("a failed public attempt can be completed privately without creating a second source", async () => {
  const storage = memoryStorage();
  const server = backend({ failVisibility: 1 });
  await assert.rejects(() => publishSource(input, server.deps(storage)));

  await publishSource({ ...input, title: "Keep private", visibility: "PRIVATE" }, server.deps(storage));

  assert.equal(server.publications.length, 1);
  assert.equal(server.calls.filter((call) => call.startsWith("public:")).length, 1);
  assert.equal(server.calls.at(-1), "private:70");
  assert.equal(storage.size(), 0);
});

test("sample registration sends the selected instrument to the server", async () => {
  const server = backend();
  const deps = server.deps(memoryStorage());
  const requests = [];
  const create = deps.createOpenSource;
  deps.createOpenSource = async body => {
    requests.push(body);
    return { ...await create(body), instrument: body.instrument };
  };
  await publishSource({ ...input, instrument: "violin" }, deps);
  assert.equal(requests[0].instrument, "violin");
});

test("a lost creation response reconciles the server instrument before a retry completes", async () => {
  const server = backend({ loseCreateResponse: true });
  const deps = server.deps(memoryStorage());
  const updates = [];
  deps.updateOpenSource = async (id, patch) => updates.push([id, patch.instrument]);
  await assert.rejects(publishSource({ ...input, instrument: "vocal" }, deps), /network lost/);
  await publishSource({ ...input, audio: null, instrument: "vocal" }, deps);
  assert.deepEqual(updates, [[70, "vocal"]]);
  assert.equal(server.calls.filter(call => call === "create").length, 1);
  assert.equal(server.calls.filter(call => call === "upload:AUDIO").length, 1);
});

test("another tab continuing a failed upload publishes the instrument chosen for that audio", async () => {
  const storage = memoryStorage();
  const server = backend({ failVisibility: 1 });
  const deps = server.deps(storage);
  const requests = [];
  const create = deps.createOpenSource;
  deps.createOpenSource = async body => {
    requests.push(body.instrument);
    return { ...await create(body), instrument: body.instrument };
  };
  await assert.rejects(publishSource({ ...input, instrument: "violin" }, deps), /503/);
  assert.equal(getPendingSourceInstrument(input, storage), "violin");

  const otherTab = { ...input, audio: new File(["b"], "b.wav"), instrument: "vocal", expectedPendingAudioId: 11 };
  assert.equal(await publishSource(otherTab, deps), 70);
  assert.deepEqual(requests, ["violin"]);
  assert.equal(server.calls.includes("update"), false);
  assert.equal(getPendingSourceInstrument(input, storage), null);
});

test("another tab recovering a lost create reconciles to the uploaded audio's instrument, not its own", async () => {
  const server = backend({ loseCreateResponse: true });
  const deps = server.deps(memoryStorage());
  const updates = [];
  deps.updateOpenSource = async (id, patch) => updates.push([id, patch.instrument]);
  await assert.rejects(publishSource({ ...input, instrument: "violin" }, deps), /network lost/);
  await publishSource({ ...input, audio: null, instrument: null, expectedPendingAudioId: 11 }, deps);
  assert.deepEqual(updates, [[70, "violin"]]);
  assert.equal(server.calls.filter(call => call === "create").length, 1);
});

test("legacy drafts register an unknown instrument as null", async () => {
  const server = backend();
  const deps = server.deps(memoryStorage());
  const create = deps.createOpenSource;
  let request;
  deps.createOpenSource = async body => { request = body; return create(body); };
  await publishSource(input, deps);
  assert.equal(request.instrument, null);
});

test("MIDI sample publication sends midiPpq, midiBpm and midiNotes and retries preserve them", async () => {
  const storage = memoryStorage();
  const server = backend({ failVisibility: 1 });
  const deps = server.deps(storage);
  const requests = [];
  const create = deps.createOpenSource;
  deps.createOpenSource = async (body) => {
    requests.push(body);
    return create(body);
  };
  const midiNotes = [{ pitch: 60, startTick: 0, durationTick: 480, velocity: 100 }];
  await assert.rejects(
    publishSource({ ...input, instrument: "piano", midiPpq: 480, midiBpm: 120, midiNotes }, deps),
    /503/,
  );
  assert.equal(requests.length, 1);
  assert.equal(requests[0].midiPpq, 480);
  assert.equal(requests[0].midiBpm, 120);
  assert.deepEqual(requests[0].midiNotes, midiNotes);
  assert.equal(await publishSource({ ...input, audio: null, instrument: "piano" }, deps), 70);
});
