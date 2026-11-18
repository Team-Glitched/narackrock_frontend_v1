import { studioStyles } from "@/styles/studio.styles";
import { cn } from "@/lib/utils";
import { CanvasDialog } from "@/components/canvas-dialog";
import { nativeApp } from "@/lib/native-app";
import { NoteSettingsDialog } from "./note-settings-dialog";
import { StudioSourceDialog } from "./studio-source-dialog";
import { TeamPianoRoll } from "./team-piano-roll";
import type { CompositionDto } from "@/lib/api/composition";
import { StudioToolbar } from "./studio-toolbar";
import { JsonNoteImportControl } from "./json-note-import-control";
import { NoteEditorControls, NoteTools } from "./note-editor-controls";
import { ChordPickerDialog } from "./chord-picker-dialog";
import { useNoteEditorShortcuts } from "./use-note-editor-shortcuts";
import { PortraitNoteEditor } from "./note-editor-portrait";
import { useNoteEditorLoad, useNoteEditorScreen } from "./use-note-editor-screen";
import { NativeNoteEditorBridge, NativeNoteEditorStateBridge } from "./native-note-editor-bridge";
import { MonitorSmartphone, Smartphone } from "lucide-react";

export function NoteEditorScreen({
  conversionNotice,
  projectId,
  trackId,
  clipId,
  onBack,
  onOpenLayers,
  portrait = false,
  onToggleLayout,
}: {
  conversionNotice?: string;
  projectId: number | null;
  trackId: number | null;
  clipId: number | null;
  onBack: () => void;
  onOpenLayers: () => void;
  /** Upright 390×844 layout instead of the landscape canvas; the page owns the choice. */
  portrait?: boolean;
  onToggleLayout?: () => void;
}) {
  const load = useNoteEditorLoad(projectId, trackId, clipId);
  if (!load.composition) {
    if (nativeApp())
      return (
        <NativeNoteEditorStateBridge
          status={load.state === "loading" ? "loading" : "error"}
          message={load.message}
          onBack={onBack}
        />
      );
    return (
      <div className={cn(studioStyles.studio, studioStyles.studioState)}>
        <p role={load.state === "error" ? "alert" : "status"}>{load.message}</p>
        <button onClick={onBack}>돌아가기</button>
      </div>
    );
  }
  return (
    <LoadedNoteEditor
      key={load.editorKey}
      conversionNotice={conversionNotice}
      composition={load.composition}
      trackId={load.track.trackId}
      requestedClipId={clipId}
      onBack={onBack}
      onOpenLayers={onOpenLayers}
      portrait={portrait}
      onToggleLayout={onToggleLayout}
    />
  );
}

function LoadedNoteEditor({
  conversionNotice,
  composition,
  trackId,
  requestedClipId,
  onBack,
  onOpenLayers,
  portrait,
  onToggleLayout,
}: {
  conversionNotice?: string;
  /** The live project; working notes and their base snapshot are kept apart from it. */
  composition: CompositionDto;
  trackId: number;
  requestedClipId: number | null;
  onBack: () => void;
  onOpenLayers: () => void;
  portrait: boolean;
  onToggleLayout?: () => void;
}) {
  const screen = useNoteEditorScreen({
    conversionNotice,
    composition,
    trackId,
    requestedClipId,
    onBack,
    onOpenLayers,
    portrait,
  });
  const { track, editable, editor, playback, draft, dialogs, timing, positionTick, busy } = screen;
  useNoteEditorShortcuts({
    editor,
    positionTick,
    playing: playback.playing,
    onPlay: screen.play,
    onPause: playback.pause,
  });
  if (nativeApp())
    return (
      <NativeNoteEditorBridge
        screen={screen}
        portrait={portrait}
        onToggleLayout={onToggleLayout}
        onBack={onBack}
      />
    );
  if (screen.clipUnavailable)
    return (
      <div className={cn(studioStyles.studio, studioStyles.studioState)}>
        <p role="alert">선택한 MIDI 클립을 찾을 수 없습니다.</p>
        <button onClick={onBack}>돌아가기</button>
      </div>
    );
  const controls = editable && (
    <NoteEditorControls
      editor={editor}
      positionTick={positionTick}
      onSettings={screen.openSettings}
      onChord={screen.openChords}
      tools={!portrait}
    />
  );
  const statusRow = (
    <div className="note-editor-status flex shrink-0 items-center gap-2 px-3 py-0.5">
      {screen.statusText !== null && (
        <p
          role="status"
          className="m-0 min-w-0 flex-1 truncate text-caption leading-[16px] text-app-muted"
        >
          {screen.statusText}
        </p>
      )}
      {onToggleLayout && (
        <button
          type="button"
          className="ml-auto flex shrink-0 items-center gap-1 rounded-[6px] px-1.5 text-caption leading-[18px] text-app-muted hover:text-app-fg"
          onClick={onToggleLayout}
        >
          {portrait ? (
            <MonitorSmartphone size={13} aria-hidden="true" />
          ) : (
            <Smartphone size={13} aria-hidden="true" />
          )}
          {portrait ? "가로 모드" : "세로 모드"}
        </button>
      )}
    </div>
  );
  const roll = (
    <TeamPianoRoll
      editor={editor}
      signature={playback.signature}
      ppq={composition.project.ppq}
      maxTick={screen.maxTick}
      positionTick={positionTick}
      onSeekTick={screen.seekTick}
      playing={playback.playing}
      instrument={track.instrument}
      onAudition={screen.audition}
      onSettings={editor.editable ? dialogs.setSettingsIndex : undefined}
      initialPitch={screen.notes[0]?.pitch ?? 60}
      // Portrait shows fewer, larger rows and a narrower key column so each cell is easy to tap.
      rowHeight={portrait ? 40 : undefined}
      keyWidth={portrait ? 44 : undefined}
    />
  );
  return (
    <div
      className={cn(studioStyles.studio, portrait && studioStyles.studioPortrait, "note-editor")}
    >
      {portrait ? (
        <PortraitNoteEditor
          title={`${track.name} · 피아노롤`}
          bpm={composition.project.bpm}
          signature={playback.signature}
          onTiming={screen.onTiming}
          timeMs={positionTick * timing.tickMs}
          instrument={screen.instrumentChoice}
          playing={playback.playing}
          onPlay={screen.play}
          onPause={playback.pause}
          onRewind={screen.rewind}
          metronome={playback.metronome}
          onMetronome={screen.toggleMetronome}
          volume={playback.volume}
          onVolume={playback.setVolume}
          onBack={screen.requestBack}
          onOpenLayers={screen.openLayerList}
          onImportSource={screen.openSources}
          controls={controls}
          status={statusRow}
          tools={editable && <NoteTools editor={editor} large />}
          roll={roll}
        />
      ) : (
        <>
          <StudioToolbar
            signature={playback.signature}
            title={`${track.name} · 피아노롤`}
            bpm={composition.project.bpm}
            onTiming={screen.onTiming}
            instrument={screen.instrumentChoice}
            playing={playback.playing}
            positionMs={positionTick * timing.tickMs}
            onPlay={screen.play}
            onPause={playback.pause}
            onRewind={screen.rewind}
            onBack={screen.requestBack}
            piano
            volume={playback.volume}
            onVolume={playback.setVolume}
            metronome={playback.metronome}
            onMetronome={screen.toggleMetronome}
            onImportSource={screen.openSources}
            onAdd={screen.openLayerList}
            addLabel="레이어 목록"
          />
          {controls}
          {statusRow}
        </>
      )}
      {screen.shownError && (
        <p className={studioStyles.studioError} role="alert">
          {screen.shownError}
        </p>
      )}
      {draft.loadError && !draft.session && (
        <button onClick={draft.retryLoad}>초안 다시 불러오기</button>
      )}
      {draft.state?.status === "conflict" && (
        <div>
          <button disabled={busy} onClick={screen.useServer}>
            서버본 열기
          </button>
          <button onClick={screen.exportRecovery}>로컬 복구본 내보내기</button>
          <button disabled={busy} onClick={screen.keepLocal}>
            로컬 복구본 명시적으로 재적용
          </button>
        </div>
      )}
      {!editable && <p>내 MIDI 레이어만 수정할 수 있습니다.</p>}
      {screen.showSources && editor.editable && (
        <StudioSourceDialog
          localFileImport={
            <JsonNoteImportControl
              editor={editor}
              ppq={composition.project.ppq}
              onAdded={() => screen.setShowSources(false)}
            />
          }
          onOpenSource={screen.insertOpenSource}
          onClose={() => screen.setShowSources(false)}
          onResource={screen.importResource}
        />
      )}
      {screen.exitTarget && (
        <CanvasDialog
          className={studioStyles.studioAudioDialogContent}
          titleId="draft-exit-title"
          onClose={screen.closeExit}
        >
          <h2 id="draft-exit-title">개인 초안을 어떻게 할까요?</h2>
          <p>
            저장 후 나가기는 공유 클립에 반영합니다. 초안 유지는 다른 참여자의 공유본을 바꾸지
            않습니다.
          </p>
          <button
            disabled={busy || !draft.session || draft.state?.status === "conflict"}
            onClick={screen.saveAndExit}
          >
            저장 후 나가기
          </button>
          <button
            disabled={busy || (draft.state?.hasUnsavedChanges && !draft.state.localProtected)}
            onClick={screen.keepAndExit}
          >
            개인 초안 유지
          </button>
          <button disabled={busy} onClick={screen.discardAndExit}>
            버리기
          </button>
          <button onClick={screen.exportRecovery}>복구본 내보내기</button>
          <button disabled={busy} onClick={() => screen.setExitTarget(null)}>
            계속 편집
          </button>
        </CanvasDialog>
      )}
      {dialogs.showChords && editor.editable && (
        <ChordPickerDialog
          editor={editor}
          ppq={composition.project.ppq}
          signature={playback.signature}
          positionTick={positionTick}
          onClose={() => dialogs.setShowChords(false)}
        />
      )}
      {dialogs.settingsIndex !== null &&
        editor.editable &&
        editor.snapshot.notes[dialogs.settingsIndex] && (
          <NoteSettingsDialog
            key={`${dialogs.settingsIndex}:${editor.lastChange?.revision ?? 0}`}
            note={editor.snapshot.notes[dialogs.settingsIndex]}
            instrument={track.instrument}
            stepTick={editor.bounds.stepTick}
            maxTick={screen.maxTick}
            onClose={() => dialogs.setSettingsIndex(null)}
            onApply={(note) =>
              editor.execute({ type: "replace", index: dialogs.settingsIndex!, note })
            }
          />
        )}
      {!portrait && roll}
    </div>
  );
}
