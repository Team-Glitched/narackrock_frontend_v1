import test from "node:test";
import assert from "node:assert/strict";
import {
  migrateBookmark,
  migratePrivateAudio,
  migrationKey,
  type MigrationJournal,
} from "./migration-journal.ts";

test("already saved bookmark is never inverted", async () => {
  let toggles = 0;
  await migrateBookmark({
    readSaved: async () => true,
    validate: async () => {},
    toggle: async () => {
      toggles++;
    },
    journal: () => {},
  });
  assert.equal(toggles, 0);
});

test("lost bookmark response is reconciled and a resumed migration does not toggle again", async () => {
  let saved = false,
    toggles = 0;
  let entry: MigrationJournal | null = null;
  const options = {
    readSaved: async () => saved,
    validate: async () => {},
    toggle: async () => {
      toggles++;
      saved = true;
      throw new Error("lost response");
    },
    journal: (value: MigrationJournal) => {
      entry = value;
    },
  };
  await migrateBookmark(options);
  await migrateBookmark(options);
  assert.equal(toggles, 1);
  assert.equal(JSON.parse(JSON.stringify(entry)).phase, "done");
});

test("unverified target cannot mutate bookmark", async () => {
  let toggles = 0;
  await assert.rejects(
    migrateBookmark({
      readSaved: async () => false,
      validate: async () => {
        throw new Error("wrong author");
      },
      toggle: async () => {
        toggles++;
      },
      journal: () => {},
    }),
    /wrong author/,
  );
  assert.equal(toggles, 0);
});

test("interrupted publication is adopted only when its exact new media match is unique", async () => {
  let entry: MigrationJournal = { phase: "creating", mediaFileId: 44, beforeIds: [1] };
  let creates = 0,
    uploads = 0;
  await migratePrivateAudio({
    previous: entry,
    payload: { title: "mine", description: null },
    list: async () => [
      { openSourceId: 1, mediaFileId: 44, title: "mine", description: null },
      { openSourceId: 2, mediaFileId: 44, title: "mine", description: null },
    ],
    upload: async () => {
      uploads++;
      return 44;
    },
    create: async () => {
      creates++;
      return { openSourceId: 3 };
    },
    journal: (value) => {
      entry = value;
    },
  });
  assert.equal(entry.publicationId, 2);
  assert.equal(entry.phase, "done");
  assert.equal(creates, 0);
  assert.equal(uploads, 0);
});

test("unknown upload and ambiguous publication never blindly retry", async () => {
  for (const previous of [
    { phase: "sending" as const },
    { phase: "creating" as const, mediaFileId: 4, beforeIds: [] },
  ]) {
    let creates = 0,
      uploads = 0;
    await assert.rejects(
      migratePrivateAudio({
        previous,
        payload: { title: "mine", description: null },
        list: async () => [],
        upload: async () => {
          uploads++;
          return 4;
        },
        create: async () => {
          creates++;
          return { openSourceId: 2 };
        },
        journal: () => {},
      }),
    );
    assert.equal(creates, 0);
    assert.equal(uploads, 0);
  }
});

test("migration receipts cannot cross backend or account boundaries", () => {
  const a = migrationKey("http://a", 1, "song", "9");
  assert.notEqual(a, migrationKey("http://b", 1, "song", "9"));
  assert.notEqual(a, migrationKey("http://a", 2, "song", "9"));
});
