import type { AudioTranscriptionMode } from "@/lib/api/composition";
import {
  createAudioClip,
  createTrack,
  deleteEmptyTrack,
  getComposition,
  transformRecordingToMidi,
  uploadMedia,
  type CompositionDto,
  type MidiNoteDto,
} from "@/lib/api/composition";
import { prepareAudioFile, type AudioSelection } from "./prepare-audio-file";
import { createHtiMidiLayerPlan } from "./hti-midi-flow";
import { findInstrument, invalidPitchesFor } from "./instrument-catalog";
import { partFor, partLabel, supportsMidi } from "./instrument-parts";
import { rememberWork, type Resource } from "@/features/workspace/workspace-store";
import { getEditorDrafts, saveEditorDraft } from "@/lib/api/composition-drafts";
import { listLocalDrafts, type DraftContent } from "./editor-draft";
import { apiOrigin } from "@/lib/api/client";

export type CompositionTarget = { projectId: number; shortId: number | null };
export type EditorTarget = { trackId: number; clipId: number | null; conversionNotice?: string };

/** A layer whose track was created but whose clip was not; retrying reuses `trackId` instead of a new track. */
export class PartialLayerError extends Error {
  readonly trackId: number;
  readonly retry?: () => Promise<void>;
  constructor(trackId: number, cause: unknown, retry?: () => Promise<void>) {
    super(cause instanceof Error ? cause.message : "레이어 내용을 저장하지 못했습니다.");
    this.trackId = trackId;
    this.retry = retry;
  }
}

/**
 * Frees the viewer's one layer in a song when an earlier flow left an empty track behind: no shared clip and no
 * personal draft that "개인 초안 유지" kept for later.
 */
export async function releaseAbandonedLayer(projectId: number) {
  const [composition, drafts] = await Promise.all([getComposition(projectId), getEditorDrafts(projectId)]);
  // Keeping a draft may succeed locally even when its first server save fails.
  // If recovery storage is inaccessible, we cannot safely classify a track as abandoned.
  let localDrafts;
  try {
    localDrafts = listLocalDrafts(window.localStorage, apiOrigin(), composition.viewerPermission.userId, projectId);
  } catch {
    return;
  }
  const abandoned = composition.tracks.find(
    (track) =>
      track.originOpenSourceId == null &&
      track.ownerId === composition.viewerPermission.userId &&
      track.clips.length === 0 &&
      !localDrafts.some((draft) => draft.trackId === track.trackId) &&
      !drafts.some((draft) => draft.trackId === track.trackId && draft.status === "ACTIVE"),
  );
  if (abandoned) await deleteEmptyTrack(projectId, abandoned.trackId);
}

async function saveNewLayerDraft(projectId: number, trackId: number, content: DraftContent) {
  const draftId = crypto.randomUUID();
  const request = {
    expectedRevision: 0,
    mutationId: crypto.randomUUID(),
    targetClipId: null,
    content,
    baseClip: null,
  };
  const retry = async () => {
    await saveEditorDraft(projectId, trackId, draftId, request);
  };
  try {
    await retry();
  } catch (cause) {
    throw new PartialLayerError(trackId, cause, retry);
  }
}

function assertMidiNotes(instrument: string, notes: MidiNoteDto[]) {
  const definition = findInstrument(instrument);
  if (!definition || !supportsMidi(instrument))
    throw new Error(`${partLabel(instrument)}에는 MIDI 노트를 넣을 수 없습니다.`);
  const invalid = invalidPitchesFor(
    definition,
    notes.map((note) => note.pitch),
  );
  if (invalid.length) throw new Error("드럼 노트는 35~81번 타악기 음만 사용할 수 있습니다.");
}

function layerName(instrument: string, composition: CompositionDto) {
  return `${partLabel(instrument)} ${composition.tracks.length + 1}`;
}

/** Creates an empty MIDI track for a chosen sampled instrument; notes are added through the personal draft. */
export async function createMidiLayer(
  projectId: number,
  instrument: string,
): Promise<EditorTarget> {
  if (!supportsMidi(instrument))
    throw new Error(`${partLabel(instrument)}은(는) MIDI 레이어로 만들 수 없습니다.`);
  const composition = await getComposition(projectId);
  const { trackId } = await createTrack(
    projectId,
    layerName(instrument, composition),
    instrument,
    composition.tracks.length,
  );
  return { trackId, clipId: null };
}

/**
 * Uploads audio as a layer with an explicit instrument or recorded role. The audio is uploaded before the track
 * is created; if the clip then fails, a `PartialLayerError` keeps the new track for a retry.
 */
export async function saveAudioLayer(
  projectId: number,
  file: File,
  role: string,
  sourceType: "FILE_UPLOAD" | "RECORDING",
  selection?: AudioSelection,
  existingTrackId?: number,
): Promise<void> {
  if (!partFor(role)) throw new Error("레이어의 악기나 녹음 역할을 선택해주세요.");
  const { wav, durationMs } = await prepareAudioFile(file, selection);
  const composition = await getComposition(projectId);
  if (durationMs > composition.project.maxDurationMs)
    throw new Error("오디오는 곡의 최대 길이 이하여야 합니다.");
  const mediaFileId = await uploadMedia(wav, "AUDIO");
  const trackId =
    existingTrackId ??
    (await createTrack(projectId, layerName(role, composition), role, composition.tracks.length))
      .trackId;
  const { bpm, ppq, maxTick } = composition.project;
  const durationTick = Math.max(1, Math.min(maxTick, Math.ceil((durationMs * bpm * ppq) / 60_000)));
  const retry = async () => {
    const latest = await getComposition(projectId);
    const track = latest.tracks.find(
      (item) => item.trackId === trackId && item.ownerId === latest.viewerPermission.userId,
    );
    if (!track) throw new Error("현재 계정의 신규 트랙을 확인하지 못했습니다.");
    if (track.clips.some((clip) => clip.mediaFileId === mediaFileId)) return;
    if (track.clips.length)
      throw new Error("이 트랙에 다른 클립이 생겼습니다. 편집기에서 확인해주세요.");
    await createAudioClip(projectId, trackId, mediaFileId, durationTick, sourceType);
  };
  try {
    await retry();
  } catch (cause) {
    throw new PartialLayerError(trackId, cause, retry);
  }
}

/** Automatically routes a recording to notes for a chosen MIDI instrument (never a hard-coded piano). */
export async function recordingToMidi(
  projectId: number,
  file: File,
  instrument: string,
  soundKind: AudioTranscriptionMode = "AUTO",
  selection?: AudioSelection,
): Promise<EditorTarget> {
  const [{ wav, durationMs }, composition] = await Promise.all([
    prepareAudioFile(file, selection),
    getComposition(projectId),
  ]);
  if (durationMs > composition.project.maxDurationMs)
    throw new Error("녹음은 곡의 최대 길이 이하여야 합니다.");
  const result = await transformRecordingToMidi(projectId, wav, soundKind);
  const plan = createHtiMidiLayerPlan(
    result,
    composition.tracks.length,
    composition.project.maxTick,
  );
  assertMidiNotes(instrument, plan.midiNotes);
  const { trackId } = await createTrack(
    projectId,
    layerName(instrument, composition),
    instrument,
    plan.sortOrder,
  );
  await saveNewLayerDraft(projectId, trackId, {
    startTick: 0,
    durationTick: plan.durationTick,
    midiNotes: plan.midiNotes,
  });
  return { trackId, clipId: null, conversionNotice: result.routing?.reason };
}

/** Notes of a local MIDI resource scaled to the project's PPQ, appended after `afterTick`. */
export function resourceNotes(resource: Resource, ppq: number, afterTick: number): MidiNoteDto[] {
  const source = resource.composition.tracks[0];
  if (!source?.clips.length) throw new Error("가져올 클립이 없습니다.");
  if (source.clips.some((clip) => clip.clipType !== "MIDI" || !clip.midiNotes.length))
    throw new Error("보관함에서는 MIDI 레이어만 가져올 수 있습니다.");
  const ratio = ppq / resource.composition.project.ppq;
  return source.clips.flatMap((clip) =>
    clip.midiNotes.map((note) => ({
      ...note,
      startTick: afterTick + Math.round((clip.startTick + note.startTick) * ratio),
      durationTick: Math.max(1, Math.round(note.durationTick * ratio)),
    })),
  );
}

/**
 * Adds a local MIDI resource as a new layer of its own instrument. Importing into an existing layer is done
 * inside the piano roll, where the notes become part of the personal draft instead of the shared clip.
 */
export async function importMidiResource(
  resource: Resource,
  target: CompositionTarget,
): Promise<void> {
  const { projectId, shortId } = target;
  const composition = await getComposition(projectId);
  if (
    !composition.viewerPermission.canContribute &&
    !(shortId === null && composition.viewerPermission.canEdit)
  )
    throw new Error("이 곡에는 레이어를 추가할 수 없습니다.");
  const source = resource.composition.tracks[0];
  const instrument = source?.instrument ?? "";
  const notes = resourceNotes(resource, composition.project.ppq, 0);
  assertMidiNotes(instrument, notes);
  if (notes.some((note) => note.startTick + note.durationTick > composition.project.maxTick))
    throw new Error("선택한 레이어가 곡의 최대 길이를 초과합니다.");
  const ownTrack = composition.tracks.find(
    (track) =>
      track.originOpenSourceId == null &&
      track.ownerId === composition.viewerPermission.userId &&
      ["DRAFT", "APPROVED"].includes(track.approvalStatus),
  );
  if (shortId !== null && ownTrack) {
    if (ownTrack.clips.length > 0 || !supportsMidi(ownTrack.instrument)) {
      throw new Error("이미 참여한 레이어가 있습니다. 내 피아노롤에서 가져오기를 이용해주세요.");
    }
  }
  const trackId =
    shortId !== null && ownTrack
      ? ownTrack.trackId
      : (
          await createTrack(
            projectId,
            resource.title,
            instrument,
            composition.tracks.length,
          )
        ).trackId;
  const durationTick = Math.max(1, ...notes.map((note) => note.startTick + note.durationTick));
  await saveNewLayerDraft(projectId, trackId, { startTick: 0, durationTick, midiNotes: notes });
  rememberWork(await getComposition(projectId), shortId);
}
