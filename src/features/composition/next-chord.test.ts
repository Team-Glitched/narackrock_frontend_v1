import assert from "node:assert/strict";
import test from "node:test";
import type { CompositionDto, MidiNoteDto } from "../../lib/api/composition.ts";
import { recommendNextChord } from "./next-chord.ts";
import { applyNoteEdit } from "./note-editing.ts";
import { NoteEditorSession } from "./note-editor.ts";

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

test("accepted chord edits keep recommending each following measure until the song ends", () => {
  for (const [numerator, denominator, bar, clipStart] of [
    [4, 4, 1920, 0],
    [3, 4, 1440, 1800],
    [6, 8, 1440, 1800],
  ]) {
    const composition = project({
      timeSignatureNumerator: numerator,
      timeSignatureDenominator: denominator,
      maxTick: 6 * bar,
    });
    const initial = chord([60, 64, 67]);
    const session = new NoteEditorSession({
      contextKey: "continuous-chords",
      notes: initial,
      ppq: composition.project.ppq,
      signature: { numerator, denominator },
      instrument: "piano",
      bounds: { minPitch: 0, maxPitch: 127, maxTick: composition.project.maxTick - clipStart },
      editable: true,
      onCommit: () => true,
    });
    const recommend = () => {
      const state = session.getSnapshot();
      return recommendNextChord({
        composition, trackId: 1, clipId: null, clipStart,
        editTick: state.lastChange?.focusTick ?? 0,
        draft: state.history.present.notes,
      });
    };
    for (let targetBar = Math.floor(clipStart / bar) + 2; targetBar <= 6; targetBar++) {
      const before = session.getSnapshot();
      const result = recommend()!;
      assert.equal(result.targetBar, targetBar);
      assert.equal(result.localTick, (targetBar - 1) * bar - clipStart);
      // Candidate calculation/selection never inserts the preview.
      const candidate = result.candidates[targetBar % result.candidates.length];
      assert.strictEqual(session.getSnapshot(), before);
      assert.equal(session.execute({ type: "insert", notes: candidate.notes }), true);
      const after = session.getSnapshot();
      assert.equal(after.lastChange?.focusTick, result.localTick);
      assert.equal(after.history.present.notes.length, before.history.present.notes.length + candidate.notes.length);
      assert.deepEqual(after.history.present.notes.slice(0, initial.length), initial);
      assert.equal(session.execute({ type: "insert", notes: candidate.notes }), false);
      assert.equal(session.getSnapshot().lastChange?.revision, after.lastChange?.revision);
    }
    assert.equal(recommend(), null);
  }
});

test("continuing after an insertion stops at an occupied following measure", () => {
  const composition = project();
  composition.tracks[0].clips.push(clip(3, 3840, [note(60)]));
  const draft = chord([60, 64, 67]);
  const request = { composition, trackId: 1, clipId: null, clipStart: 0, editTick: 0, draft };
  const secondBar = recommendNextChord(request)!;
  assert.equal(secondBar.targetBar, 2);
  assert.equal(recommendNextChord({
    ...request, editTick: secondBar.localTick,
    draft: [...draft, ...secondBar.candidates[0].notes],
  }), null);
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

test("an occupied next measure in the edited layer does not offer extra chord tones", () => {
  for (const targetNote of [note(64, 1920, 1920), note(69, 2400, 120), note(60, 1800, 240)]) {
    assert.equal(
      recommendNextChord({
        composition: project(),
        trackId: 1,
        clipId: null,
        clipStart: 0,
        editTick: 0,
        draft: [...chord([60, 64, 67]), targetNote],
      }),
      null,
    );
  }
});

test("occupancy includes other clips of the edited layer in project coordinates", () => {
  const composition = project({ timeSignatureNumerator: 3 });
  composition.tracks = [track(1, "piano", [clip(2, 2880, [note(64)])])];
  assert.equal(
    recommendNextChord({
      composition,
      trackId: 1,
      clipId: 1,
      clipStart: 1800,
      editTick: 0,
      draft: chord([60, 64, 67]),
    }),
    null,
  );
});

test("removing saved target notes in the draft makes the measure available again", () => {
  const composition = project();
  const draft = chord([60, 64, 67]);
  composition.tracks = [track(1, "piano", [clip(1, 0, [...draft, note(64, 1920)])])];
  const request = { composition, trackId: 1, clipId: 1, clipStart: 0, editTick: 0, draft };
  assert.ok(recommendNextChord(request));
  assert.equal(recommendNextChord({ ...request, draft: [...draft, note(64, 1920)] }), null);
});

test("notes ending at the target boundary or starting in the following bar leave it empty", () => {
  const request = {
    composition: project(),
    trackId: 1,
    clipId: null,
    clipStart: 0,
    editTick: 0,
    draft: [note(60, 0, 1920), note(64, 3840)],
  };
  assert.ok(recommendNextChord(request));
});

test("dominant sevenths resolve to the tonic in all supported major and minor keys", () => {
  const roots = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  for (let root = 0; root < 12; root++) {
    for (const mode of ["major", "minor"]) {
      const composition = project({ songKey: `${roots[root]} ${mode}` });
      const dominant = chord([0, 4, 7, 10].map((interval) => 55 + root + interval));
      const result = recommendNextChord({
        composition,
        trackId: 1,
        clipId: null,
        clipStart: 0,
        editTick: 0,
        draft: dominant,
      })!;
      assert.equal(result.candidates[0].name, roots[root] + (mode === "minor" ? "m" : ""));
      assert.equal(result.candidates.length, 3);
      for (const candidate of result.candidates) {
        assert.deepEqual(
          candidate.notes.map((n) => n.pitch % 12).sort((a, b) => a - b),
          candidate.tones.map((name) => roots.indexOf(name)).sort((a, b) => a - b),
        );
        assert.ok(
          candidate.notes.every(
            (n) =>
              n.startTick === 1920 && n.durationTick === 1920 && n.pitch >= 48 && n.pitch <= 84,
          ),
        );
      }
    }
  }
});

test("the target melody and bass agree on a compatible chord without blocking the empty layer", () => {
  const composition = project();
  const draft = chord([60, 64, 67]);
  const request = { composition, trackId: 1, clipId: null, clipStart: 0, editTick: 0, draft };
  composition.tracks.push(
    track(2, "flute", [clip(2, 1920, [note(69, 0, 1920)])]),
    track(3, "electric-bass", [clip(3, 1920, [note(41, 0, 1920)])]),
  );
  const result = recommendNextChord(request)!;
  assert.equal(result.candidates[0].name, "F");
  assert.ok(result.candidates[0].notes.some((n) => n.pitch % 12 === 9));
  composition.tracks.push(track(4, "drum-kit", [clip(4, 1920, chord([36, 38, 42]))]));
  assert.deepEqual(recommendNextChord(request), result);
});

test("changing only another layer's target harmony changes the recommendation", () => {
  const draft = chord([60, 64, 67]);
  for (const [pitches, expected] of [
    [[55, 59, 62], "G"],
    [[57, 60, 64], "Am"],
  ] as const) {
    const composition = project();
    composition.tracks.push(track(2, "piano", [clip(2, 1920, chord([...pitches]))]));
    const result = recommendNextChord({
      composition,
      trackId: 1,
      clipId: null,
      clipStart: 0,
      editTick: 0,
      draft,
    })!;
    assert.equal(result.candidates[0].name, expected);
    assert.deepEqual(draft, chord([60, 64, 67]));
  }
});

test("arpeggios in compound meter preserve chord tones and use a full following bar", () => {
  const composition = project({ timeSignatureNumerator: 6, timeSignatureDenominator: 8 });
  const draft = [note(60, 0, 360), note(64, 360, 360), note(67, 720, 360), note(72, 1080, 360)];
  const result = recommendNextChord({
    composition,
    trackId: 1,
    clipId: null,
    clipStart: 0,
    editTick: 0,
    draft,
  })!;
  assert.equal(result.current, "C");
  assert.equal(result.targetBar, 2);
  assert.ok(
    result.candidates.every((candidate) =>
      candidate.notes.every((n) => n.startTick === 1440 && n.durationTick === 1440),
    ),
  );
});
