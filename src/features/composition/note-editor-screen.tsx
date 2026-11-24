import { studioStyles } from "@/styles/studio.styles";
import { cn } from "@/lib/utils";
import { CanvasDialog } from "@/components/canvas-dialog";
import { LoadingOverlay } from "@/components/loading-overlay";
import { nativeApp } from "@/lib/native-app";
import { NoteSettingsDialog } from "./note-settings-dialog";
import { StudioSourceDialog } from "./studio-source-dialog";
import { TeamPianoRoll } from "./team-piano-roll";
import type { CompositionDto, CompositionView } from "@/lib/api/composition";
import { StudioToolbar } from "./studio-toolbar";
import { JsonNoteImportControl } from "./json-note-import-control";
import { NoteEditorControls, NoteTools } from "./note-editor-controls";
import { ChordPickerDialog } from "./chord-picker-dialog";
import { useNoteEditorShortcuts } from "./use-note-editor-shortcuts";
import { PortraitNoteEditor } from "./note-editor-portrait";
import { useNoteEditorLoad, useNoteEditorScreen } from "./use-note-editor-screen";
import { NativeNoteEditorBridge, NativeNoteEditorStateBridge } from "./native-note-editor-bridge";
import { LocateFixed } from "lucide-react";
import { OrientationToggleButton } from "@/components/orientation-toggle-button";

export function NoteEditorScreen({
  conversionNotice,
  projectId,
  trackId,
  clipId,
  view = "working",
  onBack,
  onOpenLayers,
  portrait = true,
  onToggleOrientation,
}: {
  conversionNotice?: string;
  projectId: number | null;
  trackId: number | null;
  clipId: number | null;
  view?: CompositionView;
  onBack: () => void;
  onOpenLayers: () => void;
  /** Upright 390×844 layout instead of the landscape canvas; the page owns the choice. */
  portrait?: boolean;
  onToggleOrientation?: () => void;
}) {
  const load = useNoteEditorLoad(projectId, trackId, clipId, view);
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
      <div className={cn(studioStyles.studio, studioStyles.studioState, portrait && studioStyles.studioPortrait)}>
        {load.state === "loading" ? (
          <LoadingOverlay message={load.message} />
        ) : (
          <p role={load.state === "error" ? "alert" : "status"}>{load.message}</p>
        )}
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
      onToggleOrientation={onToggleOrientation}
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
  onToggleOrientation,
}: {
  conversionNotice?: string;
  /** The live project; working notes and their base snapshot are kept apart from it. */
  composition: CompositionDto;
  trackId: number;
  requestedClipId: number | null;
  onBack: () => void;
  onOpenLayers: () => void;
  portrait: boolean;
  onToggleOrientation?: () => void;
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
        onBack={onBack}
      />
    );
  if (screen.clipUnavailable)
    return (
      <div className={cn(studioStyles.studio, studioStyles.studioState, portrait && studioStyles.studioPortrait)}>
        <p role="alert">선택한 MIDI 클립을 찾을 수 없습니다.</p>
        <button onClick={onBack}>돌아가기</button>
      </div>
    );
  const drum = editor.bounds.minPitch === 35 && editor.bounds.maxPitch === 81;
  const hiddenDrumNotes = drum
    ? editor.snapshot.notes.filter((note) => !editor.bounds.rows.includes(note.pitch)).length
    : 0;
  const controls = editable && (
    <NoteEditorControls
      editor={editor}
      positionTick={positionTick}
      onSettings={screen.openSettings}
      onChord={!drum ? screen.openChords : undefined}
      tools={!portrait}
      showModeAction={!portrait}
    />
  );
  const recommendation = screen.recommendation;
  const suggestion = recommendation.candidate;
  const statusRow = (
    // Wraps instead of scrolling: on an upright phone the apply button would otherwise sit off-screen.
    <div className="note-editor-status flex min-h-9 shrink-0 flex-wrap items-center justify-between gap-2 border-b border-[#2b2b34] bg-[#19191f] px-3 py-1.5 text-caption">
      {screen.statusText !== null && (
        <p role="status" className={suggestion ? "sr-only" : "m-0 min-w-0 flex-1 truncate text-app-muted"}>
          {screen.statusText}
        </p>
      )}
      {recommendation.result && suggestion && (
        <section
          aria-label="다음 마디 코드 추천"
          className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5 whitespace-nowrap [&>button]:h-7 [&>button]:shrink-0"
        >
          <button
            type="button"
            className="grid w-7 place-items-center rounded-[8px] border border-[#32323d] bg-[#23232a] text-app-muted hover:text-app-fg"
            aria-label="추천 노트 위치로 이동"
            title="추천 노트 위치로 이동"
            onClick={recommendation.reveal}
          >
            <LocateFixed size={14} aria-hidden="true" />
          </button>
          {recommendation.result.candidates.map((choice, index) => (
            <button
              type="button"
              key={choice.name}
              className="rounded-[8px] border border-[#32323d] bg-[#23232a] px-2.5 font-semibold text-app-fg transition-colors aria-pressed:border-[#5b00ff] aria-pressed:bg-app-primary aria-pressed:text-white"
              aria-pressed={choice === suggestion}
              onClick={() => recommendation.select(index)}
            >
              {choice.name}
            </button>
          ))}
          <button
            type="button"
            className="rounded-[8px] border border-[#32323d] bg-[#23232a] px-2.5 text-app-fg transition-colors hover:border-[#686675]"
            onClick={recommendation.listen}
          >
            {recommendation.playing ? "미리듣기 정지" : "미리듣기"}
          </button>
          <button
            type="button"
            className="rounded-[8px] border border-[#5b00ff] bg-app-primary px-3 font-semibold text-white transition-opacity disabled:opacity-45"
            onClick={recommendation.apply}
            disabled={editor.gestureActive}
          >
            추천 코드 넣기
          </button>
          <button
            type="button"
            className="rounded-[8px] border border-[#32323d] bg-[#1c1c23] px-2.5 text-app-muted transition-colors hover:text-app-fg"
            onClick={recommendation.dismiss}
          >
            건너뛰기
          </button>
        </section>
      )}
      {recommendation.available && (
        <button
          type="button"
          className="h-7 shrink-0 whitespace-nowrap rounded-[8px] border border-[#32323d] bg-[#23232a] px-2.5 text-app-muted transition-colors aria-pressed:border-[#5b00ff]/60 aria-pressed:bg-[#5b00ff]/20 aria-pressed:text-[#d8c7ff]"
          aria-pressed={recommendation.enabled}
          onClick={() => recommendation.setEnabled(!recommendation.enabled)}
        >
          코드 추천 {recommendation.enabled ? "켜짐" : "꺼짐"}
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
      clipStartTick={screen.clipStartTick}
      revealSuggestion={recommendation.revealState}
      suggestion={suggestion ? { name: suggestion.name, notes: suggestion.notes, apply: recommendation.apply } : undefined}
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
          onBack={screen.requestBack}
          action={{ label: "레이어 목록", onClick: screen.openLayerList }}
          onImportSource={screen.openSources}
          onChord={editor.editable && !drum ? screen.openChords : undefined}
          drumToggle={
            editor.editable && drum
              ? {
                  expanded: editor.view.expandedDrums,
                  hidden: hiddenDrumNotes,
                  onToggle: () => editor.setExpandedDrums(!editor.view.expandedDrums),
                }
              : undefined
          }
          controls={controls}
          status={statusRow}
          tools={editable && <NoteTools editor={editor} large />}
          roll={roll}
          rollOverlay={
            onToggleOrientation && (
              <OrientationToggleButton portrait onToggle={onToggleOrientation} />
            )
          }
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
      {recommendation.error && <p className={studioStyles.studioError} role="status">{recommendation.error}</p>}
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
      {!portrait && onToggleOrientation && (
        <OrientationToggleButton portrait={false} onToggle={onToggleOrientation} />
      )}
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
          className="scrollbar-dark max-h-full w-[min(360px,_100%)] overflow-y-auto rounded-[20px] border border-[#2e2e38] bg-[#1c1c23] p-5 text-app-fg shadow-2xl"
          titleId="draft-exit-title"
          onClose={screen.closeExit}
        >
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <h2 id="draft-exit-title" className="m-0 text-title leading-6 font-bold text-app-fg">
                개인 초안을 어떻게 할까요?
              </h2>
              <p className="m-0 text-body leading-5 text-app-muted">
                저장 후 나가기는 공유 클립에 반영합니다. 초안 유지는 다른 참여자의 공유본을 바꾸지
                않습니다.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                className="flex h-11 w-full items-center justify-center rounded-full bg-app-primary px-4 text-label font-semibold text-white transition-opacity disabled:opacity-45"
                disabled={busy || !draft.session || draft.state?.status === "conflict"}
                onClick={screen.saveAndExit}
              >
                저장 후 나가기
              </button>
              <button
                type="button"
                className="flex h-11 w-full items-center justify-center rounded-full border border-[#32323d] bg-[#23232a] px-4 text-label font-medium text-app-fg transition-colors hover:border-[#686675] disabled:opacity-45"
                disabled={busy || (draft.state?.hasUnsavedChanges && !draft.state.localProtected)}
                onClick={screen.keepAndExit}
              >
                개인 초안 유지
              </button>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  className="flex h-10 items-center justify-center rounded-full border border-[#2e2e38] bg-[#16161b] px-3 text-body font-medium text-app-muted transition-colors hover:text-app-fg"
                  onClick={screen.exportRecovery}
                >
                  복구본 내보내기
                </button>
                <button
                  type="button"
                  className="flex h-10 items-center justify-center rounded-full border border-[#2e2e38] bg-[#16161b] px-3 text-body font-medium text-app-muted transition-colors hover:text-app-fg disabled:opacity-45"
                  disabled={busy}
                  onClick={() => screen.setExitTarget(null)}
                >
                  계속 편집
                </button>
              </div>
              <button
                type="button"
                className="mt-1 flex h-10 w-full items-center justify-center rounded-full border border-[#e11d48]/40 bg-[#e11d48]/15 px-4 text-body font-semibold text-[#fda4af] transition-colors hover:bg-[#e11d48]/25 disabled:opacity-45"
                disabled={busy}
                onClick={screen.discardAndExit}
              >
                버리기
              </button>
            </div>
          </div>
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
      {busy ? (
        <LoadingOverlay message="작업을 처리하는 중입니다." />
      ) : playback.preparing ? (
        <LoadingOverlay message="악기를 준비하는 중입니다." />
      ) : null}
    </div>
  );
}
