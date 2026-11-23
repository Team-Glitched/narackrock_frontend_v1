/**
 * Native screen types of the studio (timeline, new project, layer choice); registered in ./index.ts.
 *
 * Also the shared studio pieces the note editor and the creation pages reuse. Each piece is a model
 * field plus an action union; the web hook that owns it returns `{ model, act }`, the page puts the
 * model in its screen model and forwards the matching actions (`isNative…Action`) to `act`:
 * - transport toolbar: `nativeTransport(playback, bpm)` + `transportAction(playback, action)`
 *   (src/features/composition/studio-toolbar.tsx); app `StudioToolbar` (native/screens/studio/toolbar.tsx).
 * - instrument picker: `useNativeInstrumentPicker(choice, onClose)` (instrument-dialog.tsx), or
 *   `useInstrumentPrompt(projectId).native` (use-instrument-prompt.tsx); app `InstrumentSheet`.
 * - BPM/time signature: `useNativeTiming(timing, onApply)` (timing-dialog.tsx); app `TimingSheet`.
 * - sample picker: `useNativeSourcePicker(...)` (studio-source-dialog.tsx); app `SourceSheet`.
 * - volume: app `VolumeSheet` (plain props; the page keeps the value and handles its own action).
 * App sheets live in native/screens/studio/parts.tsx.
 */
import type { AudioSoundKind } from "../api/composition.ts";
import type { NativeAudioTrim, NativeAudioTrimAction } from "./creation.ts";

/** Transport readouts of the studio toolbar (the web's StudioToolbar). */
export type NativeTransport = {
  /** The native audio engine of this page's playback; the live position comes from `useNativeAudioState`. */
  engine: string | null;
  playing: boolean;
  /** Coarse position (whole seconds); draw playheads from the live engine state. */
  positionMs: number;
  bpm: number;
  numerator: number;
  denominator: number;
  metronome: boolean;
  error: string | null;
};

export type NativeTransportAction =
  | { type: "transport-play" }
  | { type: "transport-pause" }
  | { type: "transport-metronome" }
  | { type: "transport-seek"; positionMs: number };

const transportActions: Record<NativeTransportAction["type"], true> = {
  "transport-play": true,
  "transport-pause": true,
  "transport-metronome": true,
  "transport-seek": true,
};

export function isNativeTransportAction(action: { type: string }): action is NativeTransportAction {
  return Object.hasOwn(transportActions, action.type);
}

/** The web's InstrumentDialog ("악기 선택"); the web keeps the selection, busy state and error. */
export type NativeInstrumentPicker = {
  mode: "midi" | "audio";
  /** Families with the parts this mode accepts; `label` includes the web's team-usage suffix. */
  groups: { id: string; label: string; parts: { id: string; label: string }[] }[];
  selected: string | null;
  /** "선택 완료" is enabled (a selection different from the current value, not busy). */
  canConfirm: boolean;
  busy: boolean;
  error: string | null;
};

export type NativeInstrumentAction =
  /** Selects a part and plays its preview (MIDI sample phrase / the layer's original audio). */
  | { type: "instrument-select"; id: string }
  /** Audio mode "원본 듣기". */
  | { type: "instrument-preview" }
  | { type: "instrument-stop-preview" }
  | { type: "instrument-confirm" }
  | { type: "instrument-close" };

const instrumentActions: Record<NativeInstrumentAction["type"], true> = {
  "instrument-select": true,
  "instrument-preview": true,
  "instrument-stop-preview": true,
  "instrument-confirm": true,
  "instrument-close": true,
};

export function isNativeInstrumentAction(action: {
  type: string;
}): action is NativeInstrumentAction {
  return Object.hasOwn(instrumentActions, action.type);
}

/**
 * The web's TimingDialog ("bpm" / "beat"). The app keeps the draft values while it is open and
 * validates them with `timingProblem` (src/features/composition/project-timing.ts).
 */
export type NativeTimingSheet = {
  kind: "bpm" | "beat";
  bpm: number;
  numerator: number;
  denominator: number;
  /** Only the original owner of an unfinished song may change timing; otherwise read-only + "닫기". */
  editable: boolean;
  busy: boolean;
  error: string | null;
};

export type NativeTimingAction =
  /** The toolbar's bpm/beat readouts open the sheet. */
  | { type: "timing-open"; kind: "bpm" | "beat" }
  | { type: "timing-apply"; bpm: number; numerator: number; denominator: number }
  | { type: "timing-close" };

const timingActions: Record<NativeTimingAction["type"], true> = {
  "timing-open": true,
  "timing-apply": true,
  "timing-close": true,
};

export function isNativeTimingAction(action: { type: string }): action is NativeTimingAction {
  return Object.hasOwn(timingActions, action.type);
}

/** A row of the sample picker: a saved open source or a MIDI work kept on this device. */
export type NativeSourcePickerRow = {
  /** `saved:<openSourceId>` or `local:<resourceId>`; sent back with `source-pick`. */
  key: string;
  title: string;
  subtitle: string;
  /** "내 레이어에 넣기" / "노트 가져오기", or the busy label while this row is imported. */
  button: string;
  disabled: boolean;
};

/** The web's StudioSourceDialog ("샘플 추가"). */
export type NativeSourcePicker = {
  /** The tabs shown ("보관한 샘플", "이 기기의 MIDI 작업", "이 기기에서 업로드"); empty hides them. */
  tabs: ("saved" | "local" | "upload")[];
  tab: "saved" | "local" | "upload";
  /** On the upload tab: the JSON file is being read and imported ("파일을 읽는 중…"). */
  uploading: boolean;
  description: string;
  placeholder: string;
  query: string;
  /** null while the first page of saved samples loads ("보관한 샘플을 불러오는 중..."). */
  rows: NativeSourcePickerRow[] | null;
  /** Empty-state text, or null. */
  empty: string | null;
  /** Saved samples failed to load ("보관한 샘플을 불러오지 못했습니다."). */
  failed: boolean;
  /** The "더보기" button: its label and whether it is enabled; null without more pages. */
  more: { label: string; disabled: boolean } | null;
  /** An import is running: closing and the tabs are disabled. */
  busy: boolean;
  error: string | null;
};

export type NativeSourcePickerAction =
  | { type: "source-open" }
  | { type: "source-close" }
  | { type: "source-tab"; tab: "saved" | "local" | "upload" }
  /** Upload tab: pick a JSON note file in the platform picker and import it. */
  | { type: "source-upload" }
  | { type: "source-query"; query: string }
  | { type: "source-pick"; key: string }
  | { type: "source-more" };

const sourceActions: Record<NativeSourcePickerAction["type"], true> = {
  "source-open": true,
  "source-close": true,
  "source-tab": true,
  "source-query": true,
  "source-pick": true,
  "source-more": true,
  "source-upload": true,
};

export function isNativeSourcePickerAction(action: {
  type: string;
}): action is NativeSourcePickerAction {
  return Object.hasOwn(sourceActions, action.type);
}

/** A clip on the studio timeline (the web's TimelineClip). */
export type NativeStudioClip = {
  clipId: number;
  midi: boolean;
  /** Note-free MIDI: not drawn on the lane; the track header offers its editor via `studio-clip`. */
  emptyMidi: boolean;
  startTick: number;
  durationTick: number;
  /** The visible label (part · layer name), or null. */
  label: string | null;
  accessibilityLabel: string;
  /** Can be dragged (own saved MIDI clip, not busy); sends `studio-move-clip` on release. */
  movable: boolean;
  /** A tap opens the piano roll (MIDI); otherwise it opens the track settings. */
  opensEditor: boolean;
  /** MIDI preview: note bars as [x, width, y] in clip fractions (0–1), flattened. */
  notes: number[];
  /** Audio preview: waveform peaks 0–1 (96 bars); null until decoded or without media. */
  peaks: number[] | null;
};

export type NativeStudioTrack = {
  trackId: number;
  profileImageUrl: string | null;
  name: string;
  /** Added by the highlighted contribution request ("추가 트랙"). */
  highlighted: boolean;
  muted: boolean;
  /** The avatar button's accessibility label: "{name} 피아노롤 열기" or "{name} 트랙 설정". */
  settingsLabel: string;
  clips: NativeStudioClip[];
  /** Own-track "+ 노트" and "+ 파일"; other participants do not expose append actions. */
  add: { notes: boolean; audioDisabled: boolean } | null;
};

/** The toolbar's right button: "제출하기", or the round add button ("곡 올리기" / "레이어 추가"). */
export type NativeStudioPrimary =
  | { kind: "submit"; disabled: boolean }
  | { kind: "publish" | "add"; disabled: boolean; hint: string | null };

/** The studio timeline (/studio/:projectId, /studio/shorts/:shortId; the web's StudioScreen). */
export type NativeStudio = {
  /** Loading ("작곡 데이터를 불러오는 중입니다.") or failure with "돌아가기"; null once loaded. */
  state: { message: string; failed: boolean } | null;
  title: string;
  transport: NativeTransport;
  /** The bpm/beat readouts open the timing sheet (otherwise read-only readouts). */
  timingEditable: boolean;
  /** "+ 샘플" is shown. */
  canImportSource: boolean;
  primary: NativeStudioPrimary;
  privateSave: { disabled: boolean } | null;
  maxTick: number;
  maxDurationMs: number;
  /** Clip drag snapping: ticks per grid cell and the cell width the web uses (px at 20px/half-beat). */
  stepTick: number;
  cellPx: number;
  /** Timeline width in web px (the web's `timelineWidth`); the app scales it. */
  width: number;
  /** "피아노롤에서 열 MIDI 레이어를 선택하세요." */
  selectMidiLayer: boolean;
  /** Contribution request banner text with an optional "다시 시도". */
  contribution: { text: string; retry: boolean } | null;
  busy: boolean;
  /** The studio's or the playback's error (the app hides it while the submit form shows `submit.error`). */
  error: string | null;
  status: string | null;
  tracks: NativeStudioTrack[];
  /** "작업 제출" form (the comment stays in the app between openings, like the web's input). */
  submit: { busy: boolean; error: string | null } | null;
  /** "정말로 올리시겠습니까?" */
  publishConfirm: boolean;
  /** "곡 올리기" metadata form (title + optional album image picked natively). */
  publishForm: {
    action: "save" | "publish";
    busy: boolean;
    error: string | null;
    imageName: string | null;
  } | null;
  /** Audio-analysis dialog for the viewer's own recorded/uploaded clip (chord recommendation input). */
  audioAnalysis?: { busy: boolean; error: string | null; cachedKind: AudioSoundKind | null; noteCount: number };
  /** A chosen file appended to an existing track, trimmed before saving. */
  audioTrim: { fileName: string; picker: NativeAudioTrim } | null;
  /** Track settings (volume + "악기/보컬 변경"). */
  trackSettings: {
    trackId: number;
    name: string;
    part: string;
    volume: number;
    canChangeInstrument: boolean;
  } | null;
  instrument: NativeInstrumentPicker | null;
  timing: NativeTimingSheet | null;
  sources: NativeSourcePicker | null;
};

export type NativeStudioAction =
  | NativeTransportAction
  | NativeInstrumentAction
  | NativeTimingAction
  | NativeSourcePickerAction
  | NativeAudioTrimAction
  | { type: "studio-analysis-run"; kind: AudioSoundKind }
  | { type: "studio-analysis-close" }
  | { type: "studio-exit" }
  | { type: "studio-retry-contribution" }
  | { type: "studio-primary" }
  | { type: "studio-private-save" }
  | { type: "studio-track"; trackId: number }
  | { type: "studio-track-notes"; trackId: number }
  | { type: "studio-track-audio"; trackId: number }
  /** A single tap opens MIDI editing (`edit` true) or audio track settings (`edit` false). */
  | { type: "studio-clip"; trackId: number; clipId: number; edit: boolean }
  | { type: "studio-move-clip"; trackId: number; clipId: number; startTick: number }
  | { type: "studio-mute"; trackId: number }
  | { type: "studio-track-volume"; trackId: number; value: number }
  | { type: "studio-track-close" }
  | { type: "studio-change-instrument" }
  | { type: "studio-submit"; comment: string }
  | { type: "studio-submit-close" }
  | { type: "studio-publish-confirm" }
  | { type: "studio-publish-close" }
  | { type: "studio-publish-image" }
  | { type: "studio-publish-save"; title: string }
  | { type: "studio-publish-form-close" };

/** /studio/new (the web's NewProject). */
export type NativeStudioNew = {
  /** Suggested title; a new suggestion ("다른 제목") moves `suggestionCount`. */
  suggestion: string;
  suggestionCount: number;
  imageUrl: string | null;
  canResume: boolean;
  busy: boolean;
  error: string | null;
};

export type NativeStudioNewAction =
  | { type: "studio-new-suggest" }
  | { type: "studio-new-image" }
  | { type: "studio-new-start"; title: string }
  | { type: "studio-new-resume" }
  | { type: "studio-new-migration" };

/** /studio/:projectId/layers/new (the web's CompositionChoiceScreen + instrument prompt). */
export type NativeStudioLayerChoice = {
  /** "올바르지 않은 페이지 주소입니다." */
  invalid: boolean;
  busy: boolean;
  error: string | null;
  instrument: NativeInstrumentPicker | null;
};

export type NativeStudioLayerChoiceAction =
  | NativeInstrumentAction
  | { type: "studio-layer-choose"; method: "upload" | "record" | "note" };

export type StudioScreens = {
  "studio-timeline": { model: NativeStudio; action: NativeStudioAction };
  "studio-new": { model: NativeStudioNew; action: NativeStudioNewAction };
  "studio-layer-choice": { model: NativeStudioLayerChoice; action: NativeStudioLayerChoiceAction };
};
