"use client";

import { useEffect, useRef, useState } from "react";
import { Asset, Avatar } from "@/components/app/shared";
import type { Navigate } from "@/features/navigation/types";

const tracks = [["#ff4449", "401px"], ["#3de4e8", "493px"], ["#aa3df0", "334px"], ["#fff93a", "493px"], ["#78ff3c", "224px"], ["#ff416f", "275px"]];
function usePlayback() { const [playing, setPlaying] = useState(false); const [progress, setProgress] = useState(0); useEffect(() => { if (!playing) return; const timer = window.setInterval(() => setProgress(value => (value + 0.00625) % 1), 50); return () => window.clearInterval(timer); }, [playing]); return { playing, progress, setProgress, toggle: () => setPlaying(value => !value) }; }
function StudioToolbar({ playing, progress, onPlay, onBack }: { playing: boolean; progress: number; onPlay: () => void; onBack: () => void }) {
  const [volume, setVolume] = useState(20);
  const [muted, setMuted] = useState(false);
  const silent = muted || volume === 0;
  const time = `00:00:${String(Math.floor(progress * 8)).padStart(2, "0")}`;
  return (
    <div className="studio-toolbar">
      <button onClick={onBack} aria-label="뒤로"><Asset name="return.svg" /></button>
      <button onClick={onPlay} aria-label={playing ? "일시정지" : "재생"} className={playing ? "is-playing" : ""}><Asset name="play.svg" /></button>
      <Asset name="metronome.svg" />
      <span><small>bpm</small>360</span>
      <span><small>beat</small>4/4</span>
      <span><small>time</small>{time}</span>
      <div className="studio-volume">
        <button aria-label={silent ? "전체 소리 켜기" : "전체 음소거"} aria-pressed={silent}
          onClick={() => {
            if (silent) {
              if (volume === 0) setVolume(20);
              setMuted(false);
            } else setMuted(true);
          }}>
          <Asset name={silent ? "sound-muted.svg" : "sound.svg"} />
        </button>
        <input type="range" aria-label="전체 볼륨" min="0" max="100" value={muted ? 0 : volume}
          aria-valuetext={`${muted ? 0 : volume}%`}
          onChange={(event) => { setVolume(Number(event.target.value)); setMuted(false); }} />
      </div>
      <button className="studio-add" aria-label="트랙 추가"><i /></button>
    </div>
  );
}

function TrackPerson({ index, go }: { index: number; go: Navigate }) {
  const [muted, setMuted] = useState(false);
  return (
    <div className="track-person">
      <button aria-label={`${index + 1}번 트랙 프로필`} onClick={() => go("profile")}><Avatar /></button>
      <button aria-label={`${index + 1}번 트랙 ${muted ? "소리 켜기" : "음소거"}`}
        aria-pressed={muted} onClick={() => setMuted((value) => !value)}>
        <Asset name={muted ? "sound-muted.svg" : "sound.svg"} />
      </button>
    </div>
  );
}

export function StudioScreen({ go }: { go: Navigate }) { const playback = usePlayback(); return <div className="studio"><StudioToolbar playing={playback.playing} progress={playback.progress} onPlay={playback.toggle} onBack={() => go("home")} /><div className="timeline"><div className="timeline-content"><div className="ruler">{Array.from({ length: 45 }).map((_, i) => <i key={i} />)}<input className="playhead-scrubber" aria-label="재생 위치" type="range" min="0" max="1000" value={Math.round(playback.progress * 1000)} onChange={event => playback.setProgress(Number(event.target.value) / 1000)} /></div><div className="studio-playhead" style={{ left: `${88 + playback.progress * 756}px` }} />{tracks.map(([color, width], i) => <div className="track" key={i}><TrackPerson index={i} go={go} /><button aria-label={`${i + 1}번 트랙 편집`} onClick={() => go("note")} style={{ background: color, width }} /></div>)}</div></div></div>; }
const pitchNames = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

export function NoteEditorScreen({ go }: { go: Navigate }) {
  const playback = usePlayback();
  // A0–C8, the range of an 88-key piano. Show twelve semitones at a time.
  const [highestPitch, setHighestPitch] = useState(71);
  const drag = useRef<{ coordinate: number; pitch: number; rotated: boolean } | null>(null);
  const pianoPitches = Array.from({ length: 12 }, (_, row) => {
    const midi = highestPitch - row;
    return `${pitchNames[midi % 12]}${Math.floor(midi / 12) - 1}`;
  });
  const whiteRows = pianoPitches.map((pitch, row) => ({ pitch, row })).filter(({ pitch }) => !pitch.includes("#"));
  const shiftPitch = (delta: number) => setHighestPitch((pitch) => Math.max(32, Math.min(108, pitch + delta)));
  const [placedNotes, setPlacedNotes] = useState<Set<string>>(() => new Set());
  const toggleNote = (id: string) => setPlacedNotes((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });
  return (
    <div className="studio note-editor">
      <StudioToolbar playing={playback.playing} progress={playback.progress} onPlay={playback.toggle} onBack={() => go("studio")} />
      <div className="note-workspace">
        <div className="note-side" />
        <div className="piano-keys" role="group" tabIndex={0}
          aria-label={`피아노 건반 ${pianoPitches[11]}부터 ${pianoPitches[0]}, 위아래로 드래그하여 음역 변경`}
          onPointerDown={(event) => {
            const rotated = window.matchMedia("(orientation: portrait) and (max-width: 780px)").matches;
            drag.current = { coordinate: rotated ? -event.clientX : event.clientY, pitch: highestPitch, rotated };
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            if (!drag.current) return;
            const coordinate = drag.current.rotated ? -event.clientX : event.clientY;
            const steps = Math.round((coordinate - drag.current.coordinate) / 30);
            setHighestPitch(Math.max(32, Math.min(108, drag.current.pitch + steps)));
          }}
          onPointerUp={() => { drag.current = null; }}
          onPointerCancel={() => { drag.current = null; }}
          onLostPointerCapture={() => { drag.current = null; }}
          onKeyDown={(event) => {
            const delta = { ArrowUp: 1, ArrowDown: -1, PageUp: 12, PageDown: -12 }[event.key];
            if (delta) { event.preventDefault(); shiftPitch(delta); }
          }}>
          {whiteRows.map(({ pitch, row }, index) => {
            const top = index === 0 ? 0 : (whiteRows[index - 1].row + row + 1) * 15;
            const bottom = index === whiteRows.length - 1 ? 360 : (row + whiteRows[index + 1].row + 1) * 15;
            return <div className="piano-key" key={pitch} style={{ top, height: bottom - top }}>
              <span style={{ top: row * 30 + 15 - top }}>{pitch}</span>
            </div>;
          })}
          {pianoPitches.map((pitch, row) => pitch.includes("#") && (
            <div className="piano-key black" key={pitch} aria-label={pitch} style={{ top: row * 30 }} />
          ))}
        </div>
        <div className="piano-roll" aria-label="노트 편집">
          {pianoPitches.map((pitch) => (
            <div className={`piano-row${pitch.includes("#") ? " black-row" : ""}`} key={pitch}>
              {Array.from({ length: 96 }, (_, col) => {
                const id = `${pitch}-${col}`;
                const selected = placedNotes.has(id);
                return <button key={id} className={`piano-cell${selected ? " has-note" : ""}`}
                  aria-label={`${pitch}, ${col + 1}번째 칸`} aria-pressed={selected}
                  onClick={() => toggleNote(id)} />;
              })}
            </div>
          ))}
        </div>
        <div className="note-playhead" style={{ left: `${116 + playback.progress * 2016}px` }} />
      </div>
    </div>
  );
}
