"use client";

import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import type { CompositionDto, MidiNoteDto } from "@/lib/api/composition";
import { StudioToolbar } from "@/features/screens/studio-screens";
import { NoteSettingsDialog } from "@/components/app/dialog";
import { TeamPianoRoll } from "./team-piano-roll";
import { useCompositionPlayback } from "./use-composition-playback";
import { renderPianoAudio } from "./source-piano-render";

export function SourcePianoEditor({ notes, setNotes, bpm, onBpm, onBack, onSave }: {
  notes: MidiNoteDto[]; setNotes: Dispatch<SetStateAction<MidiNoteDto[]>>;
  bpm: number; onBpm: (bpm: number) => void; onBack: () => void; onSave: (file: File) => void;
}) {
  const maxTick = bpm * 480; // One minute, matching upload/record limits.
  const composition = useMemo<CompositionDto>(() => ({
    viewerPermission: { userId: 0, canEdit: true, canContribute: true, canReviewContribution: false, canExport: true },
    project: { projectId: 0, title: "오픈소스", albumImageFileId: null, bpm, ppq: 480, maxTick, maxDurationMs: 60000, status: "DRAFT", isPublic: false, version: { major: 1, minor: 0, display: "1.0" } },
    tracks: [{ trackId: 0, ownerId: 0, name: "피아노", instrument: "piano", volume: 100, isMuted: false, isSolo: false, approvalStatus: "DRAFT", clips: [{ clipId: 0, ownerId: 0, clipType: "MIDI", sourceType: "MIDI_INPUT", mediaFileId: null, mediaUrl: null, startTick: 0, durationTick: maxTick, startTimeMs: 0, durationMs: 60000, clipOffsetMs: 0, approvalStatus: "DRAFT", midiNotes: notes }] }],
  }), [notes, bpm, maxTick]);
  const player = useCompositionPlayback(composition);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<number | null>(null);
  async function save() {
    if (pending) return;
    if (!notes.length) { setError("피아노롤에 노트를 추가해주세요."); return; }
    player.pause(); setPending(true); setError(null);
    try { onSave(await renderPianoAudio(notes, bpm)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "오디오를 만들지 못했습니다."); }
    finally { setPending(false); }
  }
  return <div className="studio note-editor">
    <StudioToolbar signature={player.signature} onSignature={value=>{player.pause();player.setSignature(value);}} piano title="오픈소스 피아노롤" bpm={bpm} playing={player.playing} positionMs={player.positionMs}
      onPlay={() => { void player.play().catch(() => setError("재생하지 못했습니다.")); }} onPause={player.pause}
      onBack={() => { if (!pending) onBack(); }} volume={player.volume} onVolume={player.setVolume}
      metronome={player.metronome} onMetronome={() => player.setMetronome(value => !value)}
      onBpm={value => {
        if (notes.some(note => note.startTick + note.durationTick > value * 480)) { setError("현재 노트가 1분을 초과하는 BPM입니다."); return; }
        player.pause(); onBpm(value); setError(null);
      }} addLabel="오디오 선택 완료" onAdd={pending ? undefined : () => void save()} />
    {error && <p className="studio-error" role="alert">{error}</p>}
    {pending && <p className="studio-error" role="status">오디오를 만드는 중...</p>}
    {settings !== null && notes[settings] && <NoteSettingsDialog note={notes[settings]} stepTick={960/player.signature.denominator} maxTick={maxTick} instrument="piano" onClose={() => setSettings(null)} onChange={note => setNotes(current => current.some((item, index) => index !== settings && item.pitch === note.pitch && note.startTick < item.startTick + item.durationTick && note.startTick + note.durationTick > item.startTick) ? current : current.map((item, index) => index === settings ? note : item))} />}
    <TeamPianoRoll signature={player.signature} notes={notes} setNotes={setNotes} stepTick={960/player.signature.denominator} maxTick={maxTick} lengthCells={1} editable={!pending}
      positionMs={player.positionMs} maxDurationMs={60000} onSeek={player.seek} initialPitch={60} onSettings={setSettings} />
  </div>;
}
