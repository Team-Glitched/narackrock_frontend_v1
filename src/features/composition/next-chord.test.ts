import assert from "node:assert/strict";
import test from "node:test";
import type { CompositionDto, MidiNoteDto } from "../../lib/api/composition.ts";
import { recommendNextChord } from "./next-chord.ts";
import { applyNoteEdit } from "./note-editing.ts";

const note = (pitch: number, startTick = 0, durationTick = 480): MidiNoteDto => ({
  pitch,
  startTick,
  durationTick,
  velocity: 100,
  effectType: null,
  effectParams: {},
});
const chord = (pitches: number[]) => pitches.map((pitch) => note(pitch));
const clip = (id: number, startTick: number, midiNotes: MidiNoteDto[]) => ({
  clipId: id,
  clipType: "MIDI" as const,
  startTick,
  midiNotes,
  ownerId: 1,
  sourceType: "MIDI_INPUT",
  mediaFileId: null,
  mediaUrl: null,
  durationTick: 1920,
  startTimeMs: 0,
  durationMs: 2000,
  clipOffsetMs: 0,
  approvalStatus: "APPROVED",
});
const track = (
  trackId: number,
  instrument = "piano",
  clips: CompositionDto["tracks"][number]["clips"] = [],
) => ({
  trackId,
  instrument,
  clips,
  name: instrument,
  ownerId: 1,
  volume: 100,
  pan: 0,
  isMuted: false,
  isSolo: false,
  approvalStatus: "APPROVED",
});
function project(overrides: Partial<CompositionDto["project"]> = {}): CompositionDto {
  return {
    project: {
      projectId: 1,
      title: "test",
      ownerId: 1,
      albumImageFileId: null,
      songKey: "C major",
      bpm: 120,
      ppq: 480,
      timeSignatureNumerator: 4,
      timeSignatureDenominator: 4,
      maxTick: 11520,
      maxDurationMs: 12000,
      status: "DRAFT",
      isPublic: false,
      version: { major: 1, minor: 0, display: "1.0" },
      ...overrides,
    },
    viewerPermission: {
      userId: 1,
      canEdit: true,
      canContribute: true,
      canReviewContribution: true,
      canExport: true,
    },
    tracks: [track(1)],
  };
}

test("an empty layer and a percussion-only project do not invent pitched material", () => {
  const composition = project();
  const request = {
    composition,
    trackId: 1,
    clipId: null,
    clipStart: 0,
    editTick: null,
    draft: [],
  };
  assert.equal(recommendNextChord(request), null);
  composition.tracks = [track(1, "drum-kit", [clip(1, 0, chord([36, 38, 42]))])];
  assert.equal(recommendNextChord(request), null);
});

test("a saved clip is replaced by the unsaved draft at the selected offset and meter", () => {
  for (const [numerator, denominator, bar] of [
    [3, 4, 1440],
    [6, 8, 1440],
    [5, 8, 1200],
  ]) {
    const start = 1800;
    const composition = project({
      timeSignatureNumerator: numerator,
      timeSignatureDenominator: denominator,
    });
    composition.tracks = [track(1, "piano", [clip(1, start, chord([66, 70, 73]))])];
    const request = {
      composition,
      trackId: 1,
      clipId: 1,
      clipStart: start,
      editTick: 0,
      draft: chord([60, 64, 67]),
    };
    const result = recommendNextChord(request);
    assert.equal(result?.current, "C");
    assert.equal(result?.targetBar, 3);
    assert.equal(result.localTick, 2 * bar - start);
    assert.equal(result.candidates.length, 3);
    assert.ok(
      result.candidates.every(({ notes }) =>
        notes.every((n) => n.startTick === 2 * bar - start && n.durationTick === bar),
      ),
    );
    assert.deepEqual(
      result,
      recommendNextChord({ ...request, composition: { ...composition, tracks: [track(1)] } }),
    );
  }
});

test("target melody and bass move the recommendation; adding a candidate uses a single normal edit", () => {
  const request = {
    composition: project(),
    trackId: 1,
    clipId: null,
    clipStart: 0,
    editTick: 0,
    draft: chord([60, 64, 67]),
  };
  const first = recommendNextChord(request)!;
  request.composition.tracks.push(track(2, "electric-bass", [clip(2, 1920, [note(43, 0, 1080)])]));
  const result = recommendNextChord(request)!;
  assert.notEqual(result.candidates[0].name, first.candidates[0].name);
  const notes = result.candidates[0].notes;
  const bounds = { maxTick: 11520, minPitch: 0, maxPitch: 127, stepTick: 240, rows: [] };
  const resultEdit = applyNoteEdit(
    { notes: request.draft, selected: [] },
    { type: "insert", notes },
    bounds,
  );
  assert.equal(request.draft.length, 3);
  assert.equal(resultEdit.snapshot.notes.length, 3 + notes.length);
  assert.equal(
    applyNoteEdit(resultEdit.snapshot, { type: "insert", notes }, bounds).changed,
    false,
  );
});

test("analyses of original audio inform recommendations without using playable audio as MIDI", () => {
  const composition = project();
  composition.tracks.push(
    track(2, "piano", [
      {
        ...clip(2, 0, []),
        clipType: "AUDIO",
        audioAnalysis: {
          bpm: 100,
          ppq: 480,
          soundKind: "INSTRUMENT",
          engineVersion: "test",
          midiNotes: chord([60, 64, 67]),
        },
      },
    ]),
  );
  const result = recommendNextChord({
    composition,
    trackId: 1,
    clipId: null,
    clipStart: 0,
    editTick: 0,
    draft: [],
  });
  assert.equal(result?.current, "C");
  assert.equal(composition.tracks[1].clips[0].midiNotes.length, 0);
});

test("the last partial measure is clipped and nothing is suggested outside the song", () => {
  const composition = project({ maxTick: 2000 });
  const request = {
    composition,
    trackId: 1,
    clipId: null,
    clipStart: 0,
    editTick: 0,
    draft: chord([60, 64, 67]),
  };
  assert.ok(
    recommendNextChord(request)?.candidates.every((candidate) =>
      candidate.notes.every((item) => item.startTick + item.durationTick === 2000),
    ),
  );
  assert.equal(recommendNextChord({ ...request, editTick: 1920 }), null);
});
