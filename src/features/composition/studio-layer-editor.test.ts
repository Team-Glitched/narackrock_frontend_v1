import assert from "node:assert/strict";
import test from "node:test";
import {
  emptyLayerEditor,
  layerEditorTarget,
  canChangeTrackInstrument,
  midiEditorView,
} from "./studio-layer-editor.ts";

const permission = { userId: 2, canEdit: true, canContribute: true };
const track = { trackId: 12, ownerId: 2, instrument: "piano", approvalStatus: "DRAFT", clips: [] };

test("an unfinished own MIDI layer can be resumed without creating another track", () => {
  assert.deepEqual(emptyLayerEditor(permission, "IN_PROGRESS", track), {
    trackId: 12,
    clipId: null,
  });
});

test("does not offer empty-layer editing for someone else, audio, pending or finished work", () => {
  for (const patch of [
    { ownerId: 1 },
    { instrument: "vocal" },
    { approvalStatus: "PENDING" },
    { clips: [{ clipId: 1, clipType: "MIDI" as const }] },
  ])
    assert.equal(emptyLayerEditor(permission, "IN_PROGRESS", { ...track, ...patch }), null);
  assert.equal(emptyLayerEditor(permission, "COMPLETED", track), null);
  assert.equal(
    emptyLayerEditor({ ...permission, canEdit: false, canContribute: false }, "IN_PROGRESS", track),
    null,
  );
});

test("a MIDI layer resolves straight to its first clip, including another user's read-only layer", () => {
  const layer = { ...track, ownerId: 3, clips: [{ clipId: 44, clipType: "MIDI" as const }] };
  assert.deepEqual(layerEditorTarget(permission, "IN_PROGRESS", layer), {
    trackId: 12,
    clipId: 44,
  });
  assert.deepEqual(layerEditorTarget(permission, "COMPLETED", layer), { trackId: 12, clipId: 44 });
});

test("personal preview clips reopen the new draft, and audio retains track settings", () => {
  assert.deepEqual(
    layerEditorTarget(permission, "IN_PROGRESS", {
      ...track,
      clips: [{ clipId: -12, clipType: "MIDI" as const }],
    }),
    { trackId: 12, clipId: null },
  );
  assert.equal(
    layerEditorTarget(permission, "IN_PROGRESS", {
      ...track,
      clips: [{ clipId: 44, clipType: "AUDIO" as const }],
    }),
    null,
  );
});

test("public studio allows owners to change their approved instrument without composition write permission", () => {
  const viewer = { ...permission, canEdit: false, canContribute: false };
  assert.equal(
    canChangeTrackInstrument(viewer.userId, "IN_PROGRESS", {
      ...track,
      approvalStatus: "APPROVED",
    }),
    true,
  );
  assert.equal(canChangeTrackInstrument(viewer.userId, "DRAFT", track), true);
  for (const status of ["PENDING", "REJECTED", "DELETED"])
    assert.equal(
      canChangeTrackInstrument(viewer.userId, "IN_PROGRESS", { ...track, approvalStatus: status }),
      false,
    );
  assert.equal(canChangeTrackInstrument(viewer.userId, "COMPLETED", track), false);
  assert.equal(
    canChangeTrackInstrument(viewer.userId, "IN_PROGRESS", { ...track, ownerId: 1 }),
    false,
  );
});

test("own approved MIDI opens personal working view even when public permissions are read-only", () => {
  const own = {
    ...track,
    approvalStatus: "APPROVED",
    clips: [{ clipId: 44, clipType: "MIDI" as const, ownerId: 2, approvalStatus: "APPROVED" }],
  };
  assert.equal(midiEditorView(2, "IN_PROGRESS", own, 44, "approved"), "working");
  assert.equal(midiEditorView(2, "IN_PROGRESS", own, 44, "studio"), "working");
  assert.equal(midiEditorView(2, "IN_PROGRESS", own, 44, "working"), "working");
  const review = { contributionId: 7 };
  assert.equal(midiEditorView(2, "IN_PROGRESS", own, 44, review), review);
  for (const patch of [
    { ownerId: 3 },
    { approvalStatus: "PENDING" },
    { approvalStatus: "REJECTED" },
    { instrument: "vocal" },
  ])
    assert.equal(
      midiEditorView(2, "IN_PROGRESS", { ...own, ...patch }, 44, "approved"),
      "approved",
    );
  assert.equal(midiEditorView(2, "COMPLETED", own, 44, "approved"), "approved");
  for (const patch of [
    { ownerId: 3 },
    { approvalStatus: "PENDING" },
    { approvalStatus: "REJECTED" },
    { clipType: "AUDIO" as const },
  ])
    assert.equal(
      midiEditorView(
        2,
        "IN_PROGRESS",
        { ...own, clips: [{ ...own.clips[0], ...patch }] },
        44,
        "approved",
      ),
      "approved",
    );
  assert.equal(midiEditorView(2, "IN_PROGRESS", own, 99, "approved"), "approved");
  assert.equal(midiEditorView(2, "IN_PROGRESS", undefined, 44, "approved"), "approved");
});
