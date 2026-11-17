import { useQueries } from "@tanstack/react-query";
import { useNativeScreen } from "@/features/navigation/use-native-screen";
import type { ClipDto } from "@/lib/api/composition";
import { pickNativeAudio, pickNativeImage } from "@/lib/native-app";
import {
  isNativeInstrumentAction,
  isNativeSourcePickerAction,
  isNativeTimingAction,
  isNativeTransportAction,
} from "@/lib/native-screens/studio";
import type { NativeStudio, NativeStudioAction, NativeStudioClip } from "@/lib/native-screens";
import { isNativeAudioTrimAction } from "@/lib/native-screens/creation";
import { useNativeAudioTrim } from "./native-audio-trim";
import { useNativeInstrumentPicker } from "./instrument-dialog";
import { partLabel } from "./instrument-parts";
import { midiPreviewHeight, midiPreviewNotes } from "./midi-preview-notes";
import { useNativeSourcePicker } from "./studio-source-dialog";
import { errorText } from "./studio-helpers";
import type { Studio } from "./studio-screen";
import { nativeTransport, transportAction } from "./studio-toolbar";
import { signatureGrid } from "./time-signature";
import { clipLabels } from "./timeline-clip";
import { clipWaveformQuery } from "./timeline-clip-preview";
import { snappedClipStart } from "./timeline-move";
import { useNativeTiming } from "./timing-dialog";

const round = (value: number) => Math.round(value * 1000) / 1000;

/** MIDI preview bars as [x, width, y] fractions of the clip (the web's TimelineClipPreview). */
function previewBars(clip: ClipDto) {
  if (clip.clipType !== "MIDI" || clip.durationTick <= 0) return [];
  return midiPreviewNotes(clip.midiNotes ?? [], clip.durationTick).flatMap((note) => [
    round(note.startTick / clip.durationTick),
    round(note.durationTick / clip.durationTick),
    round(note.y / midiPreviewHeight),
  ]);
}

/** A studio that cannot be shown: the invalid address or the loading/failed state. */
export function studioStateModel(message: string, failed: boolean): NativeStudio {
  return {
    state: { message, failed },
    title: "",
    transport: {
      engine: null,
      playing: false,
      positionMs: 0,
      bpm: 0,
      numerator: 4,
      denominator: 4,
      metronome: false,
      volume: 0,
      error: null,
    },
    timingEditable: false,
    canImportSource: false,
    primary: { kind: "add", disabled: true, hint: null },
    maxTick: 1,
    maxDurationMs: 1,
    stepTick: 1,
    cellPx: 20,
    width: 0,
    selectMidiLayer: false,
    contribution: null,
    busy: false,
    error: null,
    status: null,
    tracks: [],
    submit: null,
    publishConfirm: false,
    publishForm: null,
    audioTrim: null,
    trackSettings: null,
    instrument: null,
    timing: null,
    sources: null,
  };
}

/** The studio route's invalid address in the app ("올바르지 않은 페이지 주소입니다."). */
export function NativeStudioInvalidBridge({ onExit }: { onExit: () => void }) {
  return useNativeScreen(
    "studio-timeline",
    studioStateModel("올바르지 않은 페이지 주소입니다.", true),
    {
      header: null,
      onBack: onExit,
      onAction: (action) => {
        if (action.type === "studio-exit") onExit();
      },
    },
  );
}

/** The studio timeline as the app's native screen, over the page's `useStudio` state. */
export function NativeStudioBridge({ studio }: { studio: Studio }) {
  const { composition, playback, tracks } = studio;
  const project = composition?.project;
  const viewer = composition?.viewerPermission;
  const pendingAudio = studio.pendingAudio;
  const trim = useNativeAudioTrim(pendingAudio, {
    saveLabel: "선택 구간을 레이어에 저장",
    onCancel: () => studio.setPendingAudio(null),
    onSave: async (selection) => {
      if (!pendingAudio) return;
      await studio.addAudio(pendingAudio.trackId, pendingAudio.file, selection);
      studio.setPendingAudio(null);
    },
  });
  const timing = useNativeTiming(
    { bpm: project?.bpm ?? 120, signature: playback.signature },
    studio.onTiming,
  );
  const instrument = useNativeInstrumentPicker(studio.instrumentChoice, studio.closeInstrument);
  const sources = useNativeSourcePicker({
    open: studio.showSources,
    onOpen: () => {
      if (!studio.canImportSource) return;
      playback.pause();
      studio.setShowSources(true);
    },
    onClose: () => studio.setShowSources(false),
    onResource: studio.importResource,
  });
  const audioClips = tracks.flatMap((track) =>
    track.clips.filter((clip) => clip.clipType === "AUDIO" && clip.mediaUrl && clip.durationMs > 0),
  );
  const waveforms = useQueries({
    queries: audioClips.map((clip) =>
      clipWaveformQuery(studio.userId, clip.mediaUrl!, clip.clipOffsetMs, clip.durationMs),
    ),
  });
  const peaks = new Map(
    audioClips.map((clip, index) => [
      clip.clipId,
      waveforms[index]?.data?.map((peak) => Math.round(peak * 100) / 100) ?? null,
    ]),
  );

  const signature = playback.signature;
  const stepTick = project ? (project.ppq * 2) / signature.denominator : 1;
  const model: NativeStudio =
    !composition || !project || !viewer || !studio.ready
      ? studioStateModel(
          studio.loadMessage ?? "작곡 데이터를 불러오는 중입니다.",
          studio.loadMessage !== null,
        )
      : {
          state: null,
          title: project.title,
          transport: nativeTransport(playback, project.bpm),
          timingEditable: studio.onTiming !== undefined,
          canImportSource: studio.canImportSource,
          primary: studio.primary,
          maxTick: project.maxTick,
          maxDurationMs: project.maxDurationMs,
          stepTick,
          cellPx: signatureGrid(signature).cellPx,
          width: (project.maxTick / Math.max(1, project.ppq / 2)) * 20,
          selectMidiLayer: studio.selectMidiLayer,
          contribution: studio.contribution,
          busy: studio.busy,
          error: studio.error ?? playback.error,
          status: studio.status,
          tracks: tracks.map((track) => ({
            trackId: track.trackId,
            name: track.name,
            highlighted: studio.highlightedTracks.has(track.trackId),
            add:
              track.ownerId === viewer.userId
                ? {
                    notes: Boolean(track.instrument),
                    audioDisabled: studio.busy || !viewer.canContribute,
                  }
                : null,
            muted: playback.mutedTrackIds.has(track.trackId),
            settingsLabel:
              studio.selectMidiLayer && track.clips.some((clip) => clip.clipType === "MIDI")
                ? `${track.name} 피아노롤 열기`
                : `${track.name} 트랙 설정`,
            clips: track.clips.map((clip): NativeStudioClip => {
              const { label, clipTypeLabel } = clipLabels(clip, track.name, track.instrument);
              return {
                clipId: clip.clipId,
                midi: clip.clipType === "MIDI",
                startTick: clip.startTick,
                durationTick: clip.durationTick,
                label: label || null,
                accessibilityLabel: label ? `${label} ${clipTypeLabel}` : clipTypeLabel,
                movable: studio.clipMovable(clip),
                opensEditor: clip.clipType === "MIDI",
                notes: previewBars(clip),
                peaks: peaks.get(clip.clipId) ?? null,
              };
            }),
          })),
          submit: studio.showSubmitForm ? { busy: studio.busy, error: studio.error } : null,
          publishConfirm: studio.showPublishConfirmation,
          publishForm: studio.showPublishForm
            ? { busy: studio.busy, imageName: studio.publishImage?.name ?? null }
            : null,
          audioTrim:
            pendingAudio && trim.model
              ? { fileName: pendingAudio.file.name, picker: trim.model }
              : null,
          trackSettings: studio.trackSettings && {
            trackId: studio.trackSettings.track.trackId,
            name: studio.trackSettings.track.name,
            part: studio.trackSettings.track.instrument
              ? partLabel(studio.trackSettings.track.instrument)
              : "오디오",
            volume: studio.trackSettings.volume,
            canChangeInstrument: studio.trackSettings.roleEditable,
          },
          instrument: instrument.model,
          timing: timing.model,
          sources: sources.model,
        };

  function findClip(trackId: number, clipId: number) {
    const track = tracks.find((item) => item.trackId === trackId);
    const clip = track?.clips.find((item) => item.clipId === clipId);
    return track && clip ? { track, clip } : null;
  }

  function onAction(action: NativeStudioAction | { type: "more" }) {
    if (isNativeTransportAction(action)) {
      if (action.type === "transport-seek" && project)
        playback.seek(Math.max(0, Math.min(project.maxDurationMs, action.positionMs)));
      else transportAction(playback, action);
      return;
    }
    if (isNativeTimingAction(action)) return timing.act(action);
    if (isNativeInstrumentAction(action)) return instrument.act(action);
    if (isNativeSourcePickerAction(action)) return sources.act(action);
    if (isNativeAudioTrimAction(action)) return trim.act(action);
    switch (action.type) {
      case "studio-exit":
        return studio.onExit();
      case "studio-retry-contribution":
        return studio.retryContribution();
      case "studio-primary": {
        const { primary } = studio;
        if (primary.disabled) return;
        if (primary.kind === "submit") {
          studio.setError(null);
          studio.setShowSubmitForm(true);
        } else if (primary.kind === "publish") studio.requestPublish();
        else studio.onAddLayer();
        return;
      }
      case "studio-track-notes": {
        const track = tracks.find((item) => item.trackId === action.trackId);
        if (track && track.ownerId === viewer?.userId && track.instrument)
          studio.onEditTrack(track.trackId, null);
        return;
      }
      case "studio-track-audio": {
        const track = tracks.find((item) => item.trackId === action.trackId);
        if (
          !viewer ||
          !track ||
          track.ownerId !== viewer.userId ||
          !viewer.canContribute ||
          studio.busy
        )
          return;
        void pickNativeAudio()
          .then((file) => {
            if (file) {
              playback.pause();
              studio.setPendingAudio({
                trackId: track.trackId,
                file,
                url: URL.createObjectURL(file),
              });
            }
          })
          .catch((cause) => studio.setError(errorText(cause)));
        return;
      }
      case "studio-track": {
        const track = tracks.find((item) => item.trackId === action.trackId);
        if (track) studio.openTrack(track);
        return;
      }
      case "studio-clip": {
        const found = findClip(action.trackId, action.clipId);
        if (!found) return;
        if (action.edit && found.clip.clipType === "MIDI")
          studio.onEditTrack(found.track.trackId, found.clip.clipId > 0 ? found.clip.clipId : null);
        else studio.setTrackSettingsId(found.track.trackId);
        return;
      }
      case "studio-move-clip": {
        const found = findClip(action.trackId, action.clipId);
        if (!found || !project || !studio.clipMovable(found.clip)) return;
        const { clip } = found;
        const startTick = snappedClipStart(
          action.startTick,
          0,
          stepTick,
          project.maxTick,
          clip.durationTick,
        );
        if (startTick === clip.startTick) return;
        void studio
          .moveClip(found.track, clip, startTick)
          .catch((cause) =>
            studio.setError(cause instanceof Error ? cause.message : "클립을 이동하지 못했습니다."),
          );
        return;
      }
      case "studio-mute":
        return playback.toggleTrackMute(action.trackId);
      case "studio-track-volume":
        return playback.setTrackVolume(action.trackId, Math.max(0, Math.min(100, action.value)));
      case "studio-track-close":
        return studio.setTrackSettingsId(null);
      case "studio-change-instrument":
        if (studio.trackSettings?.roleEditable)
          studio.changeInstrument(studio.trackSettings.track.trackId);
        return;
      case "studio-submit":
        return void studio.submitDrafts(action.comment);
      case "studio-submit-close":
        if (studio.busy) return;
        studio.setShowSubmitForm(false);
        studio.setError(null);
        return;
      case "studio-publish-confirm":
        if (!studio.showPublishConfirmation) return;
        studio.setShowPublishConfirmation(false);
        return void studio.publish();
      case "studio-publish-close":
        return studio.setShowPublishConfirmation(false);
      case "studio-publish-image":
        void pickNativeImage()
          .then((image) => {
            if (image) studio.setPublishImage(image);
          })
          .catch((cause) => studio.setError(errorText(cause)));
        return;
      case "studio-publish-save":
        return void studio.finishMetadata(action.title);
      case "studio-publish-form-close":
        return studio.setShowPublishForm(false);
    }
  }

  const node = useNativeScreen("studio-timeline", model, {
    header: null,
    onBack: studio.onExit,
    onAction,
  });
  return (
    <>
      {node}
      {trim.node}
    </>
  );
}
