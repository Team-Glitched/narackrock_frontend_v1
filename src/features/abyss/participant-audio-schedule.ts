import { selectParticipantTracks } from "./participant-selection.ts";
import { instrumentFor, samplePitches } from "../composition/instrument-catalog.ts";
import type { ParticipantTracks } from "../../lib/api/shorts.ts";

export type ScheduledSound = {
  url: string;
  startMs: number;
  offsetMs: number;
  durationMs: number;
  rate: number;
  gain: number;
  pan: number;
  release: boolean;
};

// Plan all sources against one clock, preserving silence, clip offsets, gain and stereo position.
export function participantAudioSchedule(data: ParticipantTracks, ids: number[], positionMs: number): ScheduledSound[] {
  const sounds: ScheduledSound[] = [];
  const tickMs = 60_000 / (data.project.bpm * data.project.ppq);
  const hasSolo = data.tracks.some(track => track.isSolo && !track.isMuted);
  for (const track of selectParticipantTracks(data, ids).tracks) {
    if (track.isMuted || (hasSolo && !track.isSolo)) continue;
    const gain = Math.max(0, Math.min(100, track.volume)) / 100;
    const pan = Math.max(-1, Math.min(1, (track.pan ?? 0) / 100));
    const instrument = instrumentFor(track.instrument);
    for (const clip of track.clips) {
      if (clip.clipType === "AUDIO") {
        const end = Math.min(data.project.maxDurationMs, clip.startTimeMs + clip.durationMs);
        if (end <= positionMs) continue;
        if (!clip.mediaUrl) throw new Error("재생할 오디오 파일을 찾을 수 없습니다.");
        sounds.push({ url: clip.mediaUrl, startMs: Math.max(0, clip.startTimeMs - positionMs),
          offsetMs: clip.clipOffsetMs + Math.max(0, positionMs - clip.startTimeMs),
          durationMs: end - Math.max(positionMs, clip.startTimeMs), rate: 1, gain, pan, release: false });
        continue;
      }
      for (const note of clip.midiNotes ?? []) {
        if (instrument.kind === "drum" && (note.pitch < (instrument.minPitch ?? 35) || note.pitch > (instrument.maxPitch ?? 81))) continue;
        const start = (clip.startTick + note.startTick) * tickMs;
        const length = instrument.kind === "drum" ? Math.max(1500, note.durationTick * tickMs) : note.durationTick * tickMs;
        const end = Math.min(data.project.maxDurationMs, start + length);
        if (end <= positionMs) continue;
        const sample = samplePitches(instrument).reduce((nearest, pitch) =>
          Math.abs(pitch - note.pitch) < Math.abs(nearest - note.pitch) ? pitch : nearest);
        const rate = 2 ** ((note.pitch - sample) / 12);
        sounds.push({ url: `/audio/instruments/${instrument.id}/${sample}.mp3`,
          startMs: Math.max(0, start - positionMs), offsetMs: Math.max(0, positionMs - start) * rate,
          durationMs: end - Math.max(positionMs, start), rate,
          gain: gain * Math.max(0, Math.min(127, note.velocity)) / 127, pan, release: instrument.kind !== "drum" });
      }
    }
  }
  return sounds;
}
