import assert from "node:assert/strict";
import test from "node:test";
import { canLeaveUnchangedDraft } from "./note-editor-exit.ts";
import type { DraftContent, DraftState } from "./editor-draft.ts";

const original: DraftContent = {
  startTick: 480,
  durationTick: 1920,
  midiNotes: [{
    pitch: 60, startTick: 0, durationTick: 240, velocity: 100,
    effectType: null, effectParams: { gain: 0.5, pan: 0 },
  }],
};
const state = (changes: Partial<DraftState> = {}): DraftState => ({
  content: structuredClone(original), status: "idle", localProtected: true, error: null,
  serverRevision: 0, draftId: "draft", hasUnsavedChanges: false, retryable: true,
  ...changes,
});

test("opening an existing clip or changing only selection/grid tools can leave without saving", () => {
  assert.equal(canLeaveUnchangedDraft(original, state()), true);
});

test("returning to the original notes does not prompt even when a draft was saved or is dirty", () => {
  for (const status of ["saved", "dirty", "saving"] as const) {
    assert.equal(canLeaveUnchangedDraft(original, state({
      status, hasUnsavedChanges: status !== "saved", serverRevision: 1,
    })), true);
  }
});

test("autosaved personal edits still need a choice before leaving the shared clip", () => {
  const changed = structuredClone(original);
  changed.midiNotes[0].pitch = 62;
  assert.equal(canLeaveUnchangedDraft(original, state({
    content: changed, status: "saved", serverRevision: 1,
  })), false);
});

test("note properties, effect values, clip position, and clip duration count as edits", () => {
  const edits = [
    (content: DraftContent) => { content.midiNotes[0].startTick = 240; },
    (content: DraftContent) => { content.midiNotes[0].durationTick = 480; },
    (content: DraftContent) => { content.midiNotes[0].velocity = 70; },
    (content: DraftContent) => { content.midiNotes[0].effectParams.gain = 0.9; },
    (content: DraftContent) => { content.midiNotes = []; },
    (content: DraftContent) => { content.startTick = 0; },
    (content: DraftContent) => { content.durationTick = 960; },
  ];
  for (const edit of edits) {
    const content = structuredClone(original);
    edit(content);
    assert.equal(canLeaveUnchangedDraft(original, state({ content })), false);
  }
});

test("object property order does not create a false change", () => {
  const content = structuredClone(original);
  content.midiNotes[0].effectParams = { pan: 0, gain: 0.5 };
  assert.equal(canLeaveUnchangedDraft(original, state({ content })), true);
});

test("loading, conflicts, and new clips retain their existing guarded exit flow", () => {
  assert.equal(canLeaveUnchangedDraft(original, null), false);
  assert.equal(canLeaveUnchangedDraft(original, state({ status: "conflict" })), false);
  assert.equal(canLeaveUnchangedDraft(null, state()), false);
});
