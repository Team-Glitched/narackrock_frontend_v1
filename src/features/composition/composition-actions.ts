import {
  createAudioClip,
  createMidiClip,
  createTrack,
  getComposition,
  saveMidiClip,
  transformRecordingToMidi,
  uploadMedia,
} from "@/lib/api/composition";
import { prepareAudioFile, type AudioSelection } from "./prepare-audio-file";
import { createHtiMidiLayerPlan } from "./hti-midi-flow";
import { rememberWork, type Resource } from "@/features/workspace/workspace-store";
import { readSavedSourceAudio, type SavedSource } from "@/features/community/saved-sources";

export type CompositionTarget = { projectId: number; shortId: number | null };
export type EditorTarget = { trackId: number; clipId: number | null };

export async function createPianoLayer(projectId: number): Promise<EditorTarget> {
  const composition = await getComposition(projectId);
  const { trackId } = await createTrack(
    projectId,
    `피아노롤 ${composition.tracks.length + 1}`,
    "piano",
    composition.tracks.length,
  );
  return { trackId, clipId: null };
}

export async function saveAudioLayer(
  projectId: number,
  file: File,
  selection?: AudioSelection,
): Promise<void> {
  const { wav, durationMs } = await prepareAudioFile(file, selection);
  const composition = await getComposition(projectId);
  if (durationMs > composition.project.maxDurationMs)
    throw new Error("오디오는 1분 이하여야 합니다.");
  const mediaFileId = await uploadMedia(wav, "AUDIO");
  const { trackId } = await createTrack(
    projectId,
    `오디오 ${composition.tracks.length + 1}`,
    null,
    composition.tracks.length,
  );
  const { bpm, ppq, maxTick } = composition.project;
  const durationTick = Math.max(1, Math.min(maxTick, Math.ceil((durationMs * bpm * ppq) / 60_000)));
  await createAudioClip(projectId, trackId, mediaFileId, durationTick);
}

export async function recordingToMidi(projectId: number, file: File): Promise<EditorTarget> {
  const [{ wav, durationMs }, composition] = await Promise.all([
    prepareAudioFile(file),
    getComposition(projectId),
  ]);
  if (durationMs > composition.project.maxDurationMs)
    throw new Error("녹음은 1분 이하여야 합니다.");
  const result = await transformRecordingToMidi(projectId, wav);
  const plan = createHtiMidiLayerPlan(
    result,
    composition.tracks.length,
    composition.project.maxTick,
  );
  const { trackId } = await createTrack(projectId, plan.name, plan.instrument, plan.sortOrder);
  const { clipId } = await createMidiClip(projectId, trackId, 0, plan.durationTick, plan.midiNotes);
  return { trackId, clipId };
}

export async function importMidiResource(
  resource: Resource,
  target: CompositionTarget,
  editor?: EditorTarget,
): Promise<EditorTarget | null> {
  const { projectId, shortId } = target;
  const composition = await getComposition(projectId);
  if (
    !composition.viewerPermission.canContribute &&
    !(shortId === null && composition.viewerPermission.canEdit)
  )
    throw new Error("이 곡에는 레이어를 추가할 수 없습니다.");
  const source = resource.composition.tracks[0];
  if (!source?.clips.length) throw new Error("가져올 클립이 없습니다.");
  if (source.clips.some((clip) => clip.clipType !== "MIDI" || !clip.midiNotes.length))
    throw new Error("현재 보관함에서는 MIDI 레이어만 가져올 수 있습니다.");
  const ratio = composition.project.ppq / resource.composition.project.ppq;
  if (
    source.clips.some(
      (clip) => (clip.startTick + clip.durationTick) * ratio > composition.project.maxTick,
    )
  )
    throw new Error("선택한 레이어가 곡의 최대 길이를 초과합니다.");
  if (editor) {
    const current = composition.tracks.find((track) => track.trackId === editor.trackId);
    if (!current || current.ownerId !== composition.viewerPermission.userId)
      throw new Error("내 MIDI 레이어에서만 가져올 수 있습니다.");
    const clip =
      current.clips.find((item) => item.clipId === editor.clipId && item.clipType === "MIDI") ??
      current.clips.find((item) => item.clipType === "MIDI");
    const existing = clip?.midiNotes ?? [];
    const offset = Math.max(0, ...existing.map((note) => note.startTick + note.durationTick));
    const notes = [
      ...existing,
      ...source.clips.flatMap((sourceClip) =>
        sourceClip.midiNotes.map((note) => ({
          ...note,
          startTick: offset + Math.round((sourceClip.startTick + note.startTick) * ratio),
          durationTick: Math.max(1, Math.round(note.durationTick * ratio)),
        })),
      ),
    ];
    const duration = Math.max(1, ...notes.map((note) => note.startTick + note.durationTick));
    if (duration + (clip?.startTick ?? 0) > composition.project.maxTick)
      throw new Error("가져온 노트가 곡의 최대 길이를 초과합니다.");
    let clipId: number;
    if (clip) {
      await saveMidiClip(clip.clipId, clip.startTick, duration, notes);
      clipId = clip.clipId;
    } else {
      clipId = (await createMidiClip(projectId, current.trackId, 0, duration, notes)).clipId;
    }
    return { trackId: current.trackId, clipId };
  }
  if (
    shortId !== null &&
    composition.tracks.some((track) => track.ownerId === composition.viewerPermission.userId)
  )
    throw new Error("이미 참여한 레이어가 있습니다. 내 MIDI에서 가져오기를 이용해주세요.");
  const { trackId } = await createTrack(
    projectId,
    resource.title,
    source.instrument,
    composition.tracks.length,
  );
  for (const clip of source.clips)
    await createMidiClip(
      projectId,
      trackId,
      Math.round(clip.startTick * ratio),
      Math.max(1, Math.round(clip.durationTick * ratio)),
      clip.midiNotes.map((note) => ({
        ...note,
        startTick: Math.round(note.startTick * ratio),
        durationTick: Math.max(1, Math.round(note.durationTick * ratio)),
      })),
    );
  rememberWork(await getComposition(projectId), shortId);
  return null;
}

export async function importSavedAudio(
  source: SavedSource,
  target: CompositionTarget,
): Promise<void> {
  const { projectId, shortId } = target;
  const current = await getComposition(projectId);
  if (
    !current.viewerPermission.canContribute &&
    !(shortId === null && current.viewerPermission.canEdit)
  )
    throw new Error("레이어를 추가할 권한이 없습니다.");
  if (
    shortId !== null &&
    current.tracks.some((track) => track.ownerId === current.viewerPermission.userId)
  )
    throw new Error("이미 참여한 레이어가 있습니다.");
  const file = await readSavedSourceAudio(source);
  if (!file) throw new Error("저장된 오디오를 찾을 수 없습니다.");
  const { wav, durationMs } = await prepareAudioFile(file);
  const durationTick = Math.max(
    1,
    Math.ceil((durationMs * current.project.bpm * current.project.ppq) / 60_000),
  );
  if (durationMs > current.project.maxDurationMs || durationTick > current.project.maxTick)
    throw new Error("이 곡의 최대 길이를 초과하는 오디오입니다.");
  const mediaFileId = await uploadMedia(wav, "AUDIO");
  const { trackId } = await createTrack(projectId, source.title, null, current.tracks.length);
  await createAudioClip(projectId, trackId, mediaFileId, durationTick);
  rememberWork(await getComposition(projectId), shortId);
}
