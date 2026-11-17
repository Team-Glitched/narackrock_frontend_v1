import { useEffect, useMemo, useRef, useState } from "react";
import type { CompositionDto } from "@/lib/api/composition";
import type { NoteEditorController } from "./use-note-editor";
import { findInstrument } from "./instrument-catalog";
import { recommendNextChord } from "./next-chord";
import { useCompositionPlayback } from "./use-composition-playback";

export function useNextChord({
  composition,
  trackId,
  clipId,
  clipStart,
  editor,
  stopMainPlayback,
  volume,
}: {
  composition: CompositionDto;
  trackId: number;
  clipId: number | null;
  clipStart: number;
  editor: NoteEditorController;
  stopMainPlayback: () => void;
  volume: number;
}) {
  const appliedRevision = useRef<number | null>(null);
  const [enabled, setEnabled] = useState(true);
  const [dismissed, setDismissed] = useState<number | null>(null);
  const [revealState, setRevealState] = useState<{ pitch: number } | null>(null);
  const [picked, setPicked] = useState<{ revision: number; index: number } | null>(null);
  const revision = editor.lastChange?.revision ?? 0;
  const editTick = editor.lastChange?.focusTick ?? null;
  const draft = editor.snapshot.notes;
  const available =
    editor.editable &&
    composition.tracks.length > 0 &&
    findInstrument(composition.tracks.find((track) => track.trackId === trackId)?.instrument)
      ?.kind === "pitched";
  const result = useMemo(
    () =>
      available && enabled && dismissed !== revision
        ? recommendNextChord({ composition, trackId, clipId, clipStart, editTick, draft })
        : null,
    [
      available,
      enabled,
      dismissed,
      revision,
      composition,
      trackId,
      clipId,
      clipStart,
      editTick,
      draft,
    ],
  );
  const index = picked?.revision === revision ? picked.index : 0;
  const candidate = result?.candidates[index] ?? result?.candidates[0] ?? null;

  const tickMs = 60000 / (composition.project.bpm * composition.project.ppq);
  const bar =
    (composition.project.ppq * 4 * composition.project.timeSignatureNumerator) /
    composition.project.timeSignatureDenominator;
  const auditionEnd = candidate
    ? (clipStart + candidate.notes[0].startTick + candidate.notes[0].durationTick) * tickMs
    : 0;
  const mix = useMemo<CompositionDto | null>(() => {
    if (!candidate) return null;
    const notes = [...draft, ...candidate.notes];
    const durationTick = notes.reduce(
      (end, note) => Math.max(end, note.startTick + note.durationTick),
      0,
    );
    return {
      ...composition,
      tracks: composition.tracks
        .filter((track) => track.approvalStatus !== "REJECTED")
        .map((track) => {
          const clips = track.clips.filter((clip) => clip.approvalStatus !== "REJECTED");
          if (track.trackId !== trackId) return { ...track, clips };
          return {
            ...track,
            isMuted: false,
            isSolo: track.isSolo || composition.tracks.some((item) => item.isSolo && !item.isMuted),
            clips: [
              ...clips.filter((clip) => clip.clipId !== clipId),
              {
                clipId: clipId ?? -1,
                ownerId: track.ownerId,
                clipType: "MIDI",
                sourceType: "MIDI_INPUT",
                mediaFileId: null,
                mediaUrl: null,
                startTick: clipStart,
                durationTick,
                startTimeMs: clipStart * tickMs,
                durationMs: durationTick * tickMs,
                clipOffsetMs: 0,
                approvalStatus: "DRAFT",
                midiNotes: notes,
              },
            ],
          };
        }),
    };
  }, [candidate, composition, draft, trackId, clipId, clipStart, tickMs]);
  const audition = useCompositionPlayback(mix, {
    scopeKey: `chord:${composition.project.projectId}:${trackId}:${clipId}`,
    durationMs: auditionEnd,
  });
  const { pause } = audition;
  useEffect(() => pause, [candidate, pause]);

  function apply() {
    if (!candidate || editor.gestureActive || appliedRevision.current === revision) return;
    appliedRevision.current = revision;
    pause();
    if (editor.execute({ type: "insert", notes: candidate.notes })) setDismissed(revision + 1);
    else appliedRevision.current = null;
  }
  function reveal() {
    if (!result || !candidate) return;
    editor.setViewStartTick(
      editor.windowTicks >= 2 * bar ? Math.max(0, result.localTick - bar) : result.localTick,
    );
    setRevealState({ pitch: candidate.notes[Math.floor(candidate.notes.length / 2)].pitch });
  }
  function listen() {
    if (!candidate || !result) return;
    if (audition.playing) {
      pause();
      return;
    }
    stopMainPlayback();
    audition.setVolume(volume);
    audition.seek(Math.max(0, (clipStart + result.localTick - bar) * tickMs));
    void audition.play();
  }
  return {
    available,
    enabled,
    setEnabled,
    result,
    candidate,
    index,
    apply,
    reveal,
    revealState,
    listen,
    playing: audition.playing,
    stop: pause,
    error: audition.error,
    select: (index: number) => setPicked({ revision, index }),
    dismiss: () => {
      pause();
      setDismissed(revision);
    },
  };
}
