import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { transformRecordingToMidi } from "./composition.ts";
const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});
test("recording conversion requests automatic routing and preserves simultaneous notes and routing metadata", async () => {
  const notes = [60, 64, 67].map((pitch) => ({
    pitch,
    startTick: 0,
    durationTick: 480,
    velocity: 90,
    effectType: null,
    effectParams: {},
  }));
  globalThis.fetch = async (input, init) => {
    assert.equal(String(input), "/api/v1/projects/10/hti-transform");
    assert.ok(init?.body instanceof FormData);
    assert.equal(init.body.get("soundKind"), "AUTO");
    assert.ok(init.body.get("audio") instanceof Blob);
    return Response.json({
      success: true,
      data: {
        durationTick: 960,
        midiNotes: notes,
        routing: {
          engine: "BASIC_PITCH",
          kind: "POLYPHONIC",
          reason: "여러 음",
          version: "signal-rules-v1",
        },
      },
    });
  };
  const result = await transformRecordingToMidi(10, new File(["audio"], "piano.wav"));
  assert.deepEqual(result.midiNotes, notes);
  assert.equal(result.routing?.engine, "BASIC_PITCH");
});
test("the input override is independent of the MIDI playback instrument", async () => {
  globalThis.fetch = async (_input, init) => {
    assert.equal((init?.body as FormData).get("soundKind"), "INSTRUMENT");
    assert.equal((init?.body as FormData).get("instrument"), null);
    return Response.json({ success: true, data: { durationTick: 480, midiNotes: [] } });
  };
  await transformRecordingToMidi(10, new File(["audio"], "piano.wav"), "INSTRUMENT");
});
