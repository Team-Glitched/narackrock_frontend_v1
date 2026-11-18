import assert from "node:assert/strict";
import test from "node:test";
import { emptyLayerEditor } from "./studio-layer-editor.ts";

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
    { clips: [{}] },
  ])
    assert.equal(emptyLayerEditor(permission, "IN_PROGRESS", { ...track, ...patch }), null);
  assert.equal(emptyLayerEditor(permission, "COMPLETED", track), null);
  assert.equal(
    emptyLayerEditor({ ...permission, canEdit: false, canContribute: false }, "IN_PROGRESS", track),
    null,
  );
});
