import type { MidiNoteDto } from "@/lib/api/composition";
import { audioBufferToWav } from "./prepare-audio-file";

function scheduleMidiEnvelope(gain: AudioParam, start: number, end: number, level: number) {
  const duration = Math.max(0, end - start);
  const attack = Math.min(0.01, duration / 4);
  const release = Math.min(0.08, duration / 4);
  gain.setValueAtTime(0, start);
  gain.linearRampToValueAtTime(level, start + attack);
  gain.setValueAtTime(level, end - release);
  gain.linearRampToValueAtTime(0, end);
}

/** Render authored notes to the audio attachment; no MIDI upload or HTI conversion. */
export async function renderPianoAudio(notes: MidiNoteDto[], bpm: number): Promise<File> {
  if (!notes.length) throw new Error("노트를 추가해주세요.");
  const tickSeconds = 60 / (bpm * 480);
  const duration = Math.max(
    ...notes.map((note) => (note.startTick + note.durationTick) * tickSeconds),
  );
  if (!Number.isFinite(duration) || duration <= 0 || duration > 60)
    throw new Error("오디오 길이는 1분 이하여야 합니다.");
  const context = new OfflineAudioContext(2, Math.ceil(duration * 44100), 44100);
  const pitches = [21, 24, 36, 48];
  let samples = new Map<number, AudioBuffer>();
  try {
    samples = new Map(
      await Promise.all(
        pitches.map(async (pitch) => {
          const name = pitch === 21 ? "A0" : `C${pitch / 12 - 1}`;
          const response = await fetch(`/audio/piano/${name}.mp3`);
          if (!response.ok) throw new Error("피아노 샘플을 불러오지 못했습니다.");
          return [pitch, await context.decodeAudioData(await response.arrayBuffer())] as const;
        }),
      ),
    );
  } catch {
    /* Use the same triangle fallback as composition playback. */
  }
  for (const note of notes) {
    const start = note.startTick * tickSeconds;
    const end = start + note.durationTick * tickSeconds;
    const nearest = pitches.reduce((best, pitch) =>
      Math.abs(note.pitch - pitch) < Math.abs(note.pitch - best) ? pitch : best,
    );
    const buffer = samples.get(nearest);
    const gain = context.createGain();
    gain.connect(context.destination);
    scheduleMidiEnvelope(gain.gain, start, end, (note.velocity / 127) * (buffer ? 0.8 : 0.18));
    if (buffer) {
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.playbackRate.value = 2 ** ((note.pitch - nearest) / 12);
      source.loop = end - start > buffer.duration / source.playbackRate.value;
      source.connect(gain);
      source.start(start);
      source.stop(end);
    } else {
      const source = context.createOscillator();
      source.type = "triangle";
      source.frequency.value = 440 * 2 ** ((note.pitch - 69) / 12);
      source.connect(gain);
      source.start(start);
      source.stop(end);
    }
  }
  return audioBufferToWav(await context.startRendering(), "piano.wav");
}
