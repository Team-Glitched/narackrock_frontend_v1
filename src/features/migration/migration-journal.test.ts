import test from "node:test";
import assert from "node:assert/strict";
import {
  migrateBookmark,
  migratePrivateAudio,
  migrateDraftPointer,
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

test("pointer adoption validates before writing, requires replacement consent, and journals first", async () => {
  const events: string[] = [];
  let pointer: number | null = 8;
  const options = {
    origin: "http://a",
    projectId: 42,
    destinationKey: "scope:1",
    consent: { origin: "http://a", projectId: 42, title: "mine", replaceExisting: false },
    validate: async () => { events.push("validate"); return { projectId: 42, title: "mine" }; },
    read: () => pointer,
    write: (value: number) => { events.push("write"); pointer = value; },
    journal: (entry: MigrationJournal) => { events.push(entry.phase); },
  };
  await assert.rejects(migrateDraftPointer(options), /별도로 동의/);
  assert.equal(pointer, 8);
  assert.deepEqual(events, ["validate"]);
  events.length = 0;
  await migrateDraftPointer({ ...options, consent: { ...options.consent, replaceExisting: true } });
  assert.equal(pointer, 42);
  assert.deepEqual(events, ["validate", "adopting", "write", "done"]);
  events.length = 0;
  await migrateDraftPointer(options);
  assert.deepEqual(events, ["validate", "done"]);
});

test("pointer adoption rejects stale scope, title, and authority without modifying the destination", async () => {
  let writes = 0;
  const options = {
    origin: "http://a", projectId: 42, destinationKey: "scope:1",
    consent: { origin: "http://a", projectId: 42, title: "mine", replaceExisting: false },
    validate: async () => ({ projectId: 42, title: "mine" }),
    read: () => null,
    write: () => { writes++; },
    journal: () => {},
  };
  await assert.rejects(migrateDraftPointer({ ...options, consent: undefined }));
  await assert.rejects(migrateDraftPointer({ ...options, consent: { ...options.consent, origin: "http://b" } }));
  await assert.rejects(migrateDraftPointer({ ...options, validate: async () => ({ projectId: 42, title: "changed" }) }));
  await assert.rejects(migrateDraftPointer({ ...options, validate: async () => { throw new Error("not owner"); } }), /not owner/);
  assert.equal(writes, 0);
});

test("journal quota failure prevents pointer write; receipt failure reports adoption and retries only the receipt", async () => {
  let pointer: number | null = null;
  let writes = 0;
  let entry: MigrationJournal | null = null;
  const options = {
    origin: "http://a", projectId: 42, destinationKey: "scope:1",
    consent: { origin: "http://a", projectId: 42, title: "mine", replaceExisting: false },
    validate: async () => ({ projectId: 42, title: "mine" }),
    read: () => pointer,
    write: (value: number) => { writes++; pointer = value; },
    journal: (value: MigrationJournal) => { entry = value; },
  };
  await assert.rejects(migrateDraftPointer({
    ...options, journal: () => { throw new Error("journal quota"); },
  }), /journal quota/);
  assert.equal(writes, 0);
  await assert.rejects(migrateDraftPointer({
    ...options,
    journal: (value) => {
      if (value.phase === "done") throw new Error("receipt quota");
      entry = value;
    },
  }), /연결됨, 기록 저장 실패/);
  assert.equal(pointer, 42);
  assert.equal(JSON.parse(JSON.stringify(entry)).phase, "adopting");
  await migrateDraftPointer(options);
  assert.equal(writes, 1);
  assert.equal(JSON.parse(JSON.stringify(entry)).phase, "done");
});

test("a failed pointer write never creates a completed receipt", async () => {
  const phases: string[] = [];
  await assert.rejects(migrateDraftPointer({
    origin: "http://a", projectId: 42, destinationKey: "scope:1",
    consent: { origin: "http://a", projectId: 42, title: "mine", replaceExisting: false },
    validate: async () => ({ projectId: 42, title: "mine" }),
    read: () => null,
    write: () => { throw new Error("pointer quota"); },
    journal: (entry) => { phases.push(entry.phase); },
  }), /pointer quota/);
  assert.deepEqual(phases, ["adopting"]);
});
