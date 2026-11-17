import type { CompositionDto, MidiNoteDto } from "../../lib/api/composition.ts";
import { chordQualities, chordRoots } from "./chord-input.ts";
import { notesOverlap } from "./note-editing.ts";
import { partFor } from "./instrument-parts.ts";

const modes = [
  [0, 2, 4, 5, 7, 9, 11],
  [0, 2, 3, 5, 7, 8, 10],
];
const pc = (pitch: number) => ((pitch % 12) + 12) % 12;
type Role = "harmony" | "bass" | "melody";
type Tone = { pitch: number; start: number; end: number; role: Role; active: boolean };
type Chord = { root: number; tones: number[]; name: string; degree: number };
export type ChordSuggestion = {
  name: string;
  tones: string[];
  reason: string;
  notes: MidiNoteDto[];
};
type Request = {
  composition: CompositionDto;
  trackId: number;
  clipId: number | null;
  clipStart: number;
  editTick: number | null;
  draft: readonly MidiNoteDto[];
};
type Window = { weights: number[]; tones: Tone[]; bass: number | undefined };

function roles(instrument: string | null, vocal: boolean): Role | null {
  const id = partFor(instrument)?.id ?? instrument;
  if (id === "drum-kit" || id === "percussion" || id === "rap") return null;
  if (
    vocal ||
    id === "vocal" ||
    id === "backing-vocal" ||
    id === "flute" ||
    id === "violin" ||
    id === "saxophone" ||
    id === "trumpet" ||
    id === "synth-lead"
  )
    return "melody";
  return id?.includes("bass") ? "bass" : "harmony";
}

function context({ composition, trackId, clipId, clipStart, draft }: Request): Tone[] {
  return composition.tracks
    .flatMap((track) => {
      const active = track.trackId === trackId;
      if (track.approvalStatus === "REJECTED") return [];
      function place(notes: readonly MidiNoteDto[], start: number, vocal = false): Tone[] {
        const role = roles(track.instrument, vocal);
        return role
          ? notes
              .filter((note) => note.velocity > 0)
              .map((note) => ({
                pitch: note.pitch,
                start: start + note.startTick,
                end: start + note.startTick + note.durationTick,
                role,
                active,
              }))
          : [];
      }
      const saved = track.clips.flatMap((clip) => {
        if (clip.approvalStatus === "REJECTED" || (active && clip.clipId === clipId)) return [];
        if (clip.clipType === "MIDI") return place(clip.midiNotes, clip.startTick);
        const analysis = clip.audioAnalysis;
        if (!analysis) return [];
        const ratio =
          (composition.project.bpm * composition.project.ppq) / (analysis.bpm * analysis.ppq);
        return place(
          analysis.midiNotes.flatMap((note) => {
            const startTick = Math.round(note.startTick * ratio);
            const endTick = Math.min(
              clip.durationTick,
              Math.round((note.startTick + note.durationTick) * ratio),
            );
            return endTick > startTick
              ? [{ ...note, startTick, durationTick: endTick - startTick }]
              : [];
          }),
          clip.startTick,
          analysis.soundKind === "HUMMING",
        );
      });
      return active ? [...saved, ...place(draft, clipStart)] : saved;
    })
    .sort((a, b) => a.start - b.start);
}

function windowOf(notes: Tone[], start: number, end: number, beat: number, bar: number): Window {
  const weights = Array<number>(12).fill(0);
  const tones = notes.filter((note) => note.start < end && note.end > start);
  for (const tone of tones) {
    const length = Math.min(end, tone.end) - Math.max(start, tone.start);
    const onBeat = Math.abs(tone.start / beat - Math.round(tone.start / beat)) < 1e-6;
    const downbeat = Math.abs(tone.start / bar - Math.round(tone.start / bar)) < 1e-6;
    const accent = tone.start < start ? 1 : downbeat ? 1.55 : onBeat ? 1.25 : 1;
    const roleWeight = tone.role === "harmony" ? 1.25 : tone.role === "bass" ? 1.1 : 0.8;
    weights[pc(tone.pitch)] += (length / beat) * accent * roleWeight * (tone.active ? 1.2 : 1);
  }
  const bass = tones
    .filter((tone) => tone.role === "bass")
    .sort(
      (a, b) =>
        Math.min(end, b.end) -
          Math.max(start, b.start) -
          (Math.min(end, a.end) - Math.max(start, a.start)) || a.pitch - b.pitch,
    )[0]?.pitch;
  return { weights, tones, bass };
}

function keys(weights: number[], configured: string | null | undefined) {
  const match = configured?.trim().match(/^([A-G])([#♯b♭]?)(?:\s*(major|minor|maj|min|m))?$/i);
  const name = match?.[1].toUpperCase();
  const tonic = name ? [9, 11, 0, 2, 4, 5, 7]["ABCDEFG".indexOf(name)] : undefined;
  const accidental = match?.[2];
  const fixedRoot =
    tonic === undefined
      ? undefined
      : pc(tonic + (accidental === "#" || accidental === "♯" ? 1 : accidental ? -1 : 0));
  return modes
    .flatMap((scale, mode) =>
      chordRoots.map((_, root) => {
        const pitches = scale.map((interval) => pc(interval + root));
        const total = weights.reduce((sum, value) => sum + value, 0) || 1;
        const score =
          (pitches.reduce((sum, pitch) => sum + weights[pitch], 0) +
            0.2 * weights[root] +
            0.1 * weights[pc(root + 7)]) /
          total;
        return { root, mode, pitches, score };
      }),
    )
    .filter(
      (key) =>
        fixedRoot === undefined ||
        (key.root === fixedRoot &&
          key.mode === (match?.[3] && /^m(in(or)?)?$/i.test(match[3]) ? 1 : 0)),
    )
    .sort((a, b) => b.score - a.score)
    .slice(0, fixedRoot === undefined ? 3 : 1);
}

function chords(scale: number[], minor: boolean): Chord[] {
  const shapes = ["major", "minor", "dim", "maj7", "m7", "7", "m7b5"];
  return scale.flatMap((root, degree) =>
    chordQualities.flatMap(({ id, intervals, suffix }) => {
      if (!shapes.includes(id)) return [];
      const tones = intervals.map((step) => pc(root + step));
      const minorDominant = minor && degree === 4 && (id === "major" || id === "7");
      return minorDominant || tones.every((tone) => scale.includes(tone))
        ? [{ root, tones, name: chordRoots[root].name + suffix, degree }]
        : [];
    }),
  );
}

function fit(chord: Chord, window: Window) {
  const total = window.weights.reduce((sum, weight) => sum + weight, 0) || 1;
  return (
    window.weights.reduce(
      (sum, weight, pitch) => sum + (chord.tones.includes(pitch) ? weight : -weight),
      0,
    ) / total
  );
}

function transition(before: number | undefined, next: number) {
  if (before === undefined) return next === 0 ? 0.25 : 0;
  if (before === 4 || before === 6) return next === 0 ? 1.35 : next === 5 ? 0.8 : -0.1;
  if (before === 1 || before === 3) return next === 4 ? 1.15 : next === 0 ? 0.55 : 0;
  if (before === 5 || before === 2) return next === 1 || next === 3 ? 1 : next === 4 ? 0.45 : 0;
  if (next === before) return -0.4;
  return next === 3 ? 1 : next === 5 || next === 4 ? 0.85 : next === 1 ? 0.6 : 0;
}

function voicing(
  chord: Chord,
  reference: number[],
  instrument: string | null,
  start: number,
  duration: number,
  occupied: readonly MidiNoteDto[],
) {
  const guitar = instrument?.includes("guitar");
  const bass = instrument?.includes("bass");
  const [low, high, center] = bass ? [40, 67, 49] : guitar ? [45, 81, 59] : [48, 84, 63];
  const lead = reference.length > 0 ? reference : [center - 3, center, center + 4];
  const variants: Array<{ notes: MidiNoteDto[]; cost: number }> = [];
  for (let bottom = low; bottom < high; bottom++) {
    if (!chord.tones.includes(pc(bottom))) continue;
    const pitches = chord.tones.map((tone) => bottom + pc(tone - bottom)).sort((a, b) => a - b);
    if (pitches.at(-1)! > high) continue;
    const played = pitches.map((pitch) => ({
      pitch,
      startTick: start,
      durationTick: duration,
      velocity: 82,
      effectType: null,
      effectParams: {},
    }));
    const notes = played.filter(
      (note) =>
        !occupied.some(
          (other) =>
            other.pitch === note.pitch &&
            other.startTick <= note.startTick &&
            other.startTick + other.durationTick >= note.startTick + note.durationTick,
        ),
    );
    if (!notes.length || notes.some((note) => occupied.some((other) => notesOverlap(note, other))))
      continue;
    const cost =
      pitches.reduce(
        (sum, pitch) => sum + Math.min(...lead.map((old) => Math.abs(old - pitch))),
        0,
      ) /
        pitches.length +
      Math.abs((pitches[0] + pitches.at(-1)!) / 2 - center) * 0.13 +
      (pc(bottom) === chord.root ? 0 : 0.5);
    variants.push({ notes, cost });
  }
  return variants.sort((a, b) => a.cost - b.cost)[0];
}

/** The edit tick and returned MIDI notes are clip-relative. Measure boundaries are project-relative. */
export function recommendNextChord(request: Request) {
  const { composition, trackId, clipStart, editTick, draft } = request;
  const { ppq, timeSignatureNumerator, timeSignatureDenominator, maxTick, songKey } =
    composition.project;
  const track = composition.tracks.find((item) => item.trackId === trackId);
  const beat = (ppq * 4) / timeSignatureDenominator;
  const bar = beat * timeSignatureNumerator;
  if (!track || !roles(track.instrument, false) || !(bar > 0)) return null;
  const notes = context(request);
  const fallback =
    notes.find((note) => note.active && note.start >= clipStart) ??
    notes.find((note) => note.end > clipStart);
  if (editTick === null && !fallback) return null;
  const measure = Math.floor(
    (editTick === null ? Math.max(clipStart, fallback!.start) : clipStart + editTick) / bar,
  );
  const source = measure * bar;
  const target = Math.round((measure + 1) * bar);
  const end = Math.min(maxTick, Math.round((measure + 2) * bar));
  if (target >= maxTick || target < clipStart || end <= target) return null;
  const localTick = target - clipStart;
  const history = windowOf(notes, Math.max(0, source - 3 * bar), target, beat, bar);
  const current = windowOf(notes, source, target, beat, bar);
  if (!current.tones.length) return null;
  const earlier = windowOf(notes, Math.max(0, source - bar), source, beat, bar);
  const tail = windowOf(notes, Math.max(source, target - 2 * beat), target, beat, bar);
  const targetNotes = windowOf(notes, target, end, beat, bar);
  const reference = (tail.tones.length ? tail : current).tones
    .filter((tone) => tone.active && tone.role === "harmony")
    .map((tone) => tone.pitch);
  const pitchAnchor = [...new Set(reference)].filter((pitch) => pitch >= 40 && pitch <= 86);
  const firstHarmony = history.tones.find((tone) => tone.role === "harmony");
  const tonalAnchor =
    history.bass ??
    (firstHarmony
      ? Math.min(
          ...history.tones
            .filter((tone) => tone.role === "harmony" && tone.start === firstHarmony.start)
            .map((tone) => tone.pitch),
        )
      : undefined);
  const currentPitches = new Set(current.tones.map((tone) => pc(tone.pitch)));
  const occupied = draft.filter(
    (note) => note.startTick < end - clipStart && note.startTick + note.durationTick > localTick,
  );
  const ranked = keys(history.weights, songKey)
    .flatMap((key) => {
      const choices = chords(key.pitches, key.mode === 1);
      const triads = choices.filter((choice) => choice.tones.length === 3);
      const guess = (window: Window) =>
        window.tones.length
          ? [...triads].sort((a, b) => scoreCurrent(b, window) - scoreCurrent(a, window))[0]
          : undefined;
      const now = guess(tail.tones.length ? tail : current);
      const before = guess(earlier);
      const bass = targetNotes.bass ?? tail.bass;
      return choices.flatMap((choice) => {
        const voice = voicing(
          choice,
          pitchAnchor,
          track.instrument,
          localTick,
          end - target,
          occupied,
        );
        if (!voice) return [];
        const melody = targetNotes.tones.length ? fit(choice, targetNotes) : 0;
        const bassFit =
          bass === undefined
            ? 0
            : targetNotes.bass !== undefined
              ? choice.root === pc(bass)
                ? 1.1
                : choice.tones.includes(pc(bass))
                  ? 0.35
                  : -0.8
              : -Math.min(pc(bass - choice.root), pc(choice.root - bass)) * 0.035;
        const flow = transition(now?.degree, choice.degree);
        const tonalFit = tonalAnchor !== undefined && pc(tonalAnchor) === key.root ? 0.42 : 0;
        const score =
          key.score * 3.5 +
          tonalFit +
          flow +
          0.25 * transition(before?.degree, choice.degree) +
          1.45 * melody +
          bassFit -
          0.12 * voice.cost -
          (choice.tones.length === 4 ? 0.24 : 0);
        const reason =
          melody > 0.45
            ? "다음 마디의 음과 잘 어울려요."
            : bassFit > 0.3
              ? "다음 마디의 베이스 음과 맞아요."
              : flow >= 0.8 && currentPitches.size >= 3
                ? "현재 화음에서 자연스럽게 이어져요."
                : "조성과 가까운 음 배치를 고려했어요.";
        return [{ chord: choice, now, score, notes: voice.notes, reason }];
      });
    })
    .sort((a, b) => b.score - a.score || a.chord.name.localeCompare(b.chord.name));
  const selected: typeof ranked = [];
  for (const option of ranked) {
    if (selected.some((previous) => previous.chord.root === option.chord.root)) continue;
    selected.push(option);
    if (selected.length === 3) break;
  }
  if (!selected.length) return null;
  const candidates: ChordSuggestion[] = selected.map(({ chord, reason, notes }) => ({
    name: chord.name,
    tones: chord.tones.map((tone) => chordRoots[tone].name),
    notes,
    reason,
  }));
  return {
    sourceBar: measure + 1,
    targetBar: measure + 2,
    localTick,
    current:
      currentPitches.size >= 3 && current.tones.some((tone) => tone.role === "harmony")
        ? selected[0].now?.name
        : undefined,
    candidates,
  };
}

function scoreCurrent(chord: Chord, window: Window) {
  return (
    fit(chord, window) +
    (window.bass === undefined ? 0 : chord.root === pc(window.bass) ? 0.36 : 0) +
    Math.min(...chord.tones.map((pitch) => window.weights[pitch])) * 0.08
  );
}
