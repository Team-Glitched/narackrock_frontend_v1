import assert from "node:assert/strict";
import test from "node:test";
import {
  emptyLayerEditor,
  layerEditorTarget,
  canChangeTrackInstrument,
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
