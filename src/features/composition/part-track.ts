import { createTrack, updateTrackInstrument, type CompositionDto } from "@/lib/api/composition";
import { occupyingTrack, partLabel } from "./instrument-parts";

/** Reuses an empty layer after a lost response or failed upload instead of creating a second one. */
export async function ensurePartTrack(composition: CompositionDto, instrument: string) {
  const own = composition.tracks.find(track => track.ownerId === composition.viewerPermission.userId);
  if (own?.clips.length) throw new Error("이미 만든 레이어가 있습니다. 작곡 화면에서 이어서 작업해 주세요.");
  if (occupyingTrack(composition.tracks, instrument, own?.trackId)) {
    throw new Error("팀원이 이미 사용 중인 악기 종류입니다. 다른 종류를 선택해 주세요.");
  }
  if (own) {
    await updateTrackInstrument(composition.project.projectId, own.trackId, instrument);
    return { trackId: own.trackId };
  }
  return createTrack(composition.project.projectId, `${partLabel(instrument)} ${composition.tracks.length + 1}`, instrument, composition.tracks.length);
}
