import assert from "node:assert/strict";
import { test } from "node:test";
import { hasPendingPublication, publishSource } from "./publish-source.ts";

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
      setOpenSourceVisibility: async (id) => {
        calls.push(`public:${id}`);
        if (failVisibility-- > 0) throw new Error("503");
        return { openSourceId: id, visibility: "PUBLIC" };
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
};

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
  assert.equal(await publishSource(input, server.deps(storage)), 70);

  assert.equal(server.calls.filter((call) => call === "create").length, 1);
  assert.equal(server.calls.filter((call) => call.startsWith("upload")).length, 1);
  assert.equal(server.publications.length, 1);
});

test("edits made between attempts are applied to the existing publication before publishing", async () => {
  const storage = memoryStorage();
  const server = backend({ failVisibility: 1 });

  await assert.rejects(() => publishSource(input, server.deps(storage)));
  await publishSource({ ...input, title: "Riff v2" }, server.deps(storage));

  assert.deepEqual(server.calls.slice(-2), ["update", "public:70"]);
});
