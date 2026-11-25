import { useState } from "react";
import { useLoginPrompt } from "@/features/auth/login-prompt";
import {
  SocialCreateForm,
  useSocialCreate,
  type SocialCreateProps,
  type SocialCreateState,
} from "@/features/community/create-content";
import {
  creationHeader,
  useNativeRecord,
  useNativeUpload,
} from "@/features/composition/native-creation-bridges";
import { useNativeSourcePiano } from "@/features/composition/source-piano-editor";
import { usePreview } from "@/features/images/image-preview";
import { useNativeScreen } from "@/features/navigation/use-native-screen";
import { pickNativeImage } from "@/lib/native-app";
import type { NativeSourceCreate } from "@/lib/native-screens";
import { clampCrop } from "./thumbnail-crop";
import { isNativeInstrumentAction } from "@/lib/native-screens/studio";
import { partLabel, supportsMidi } from "@/features/composition/instrument-parts";
import { defaultSignature, type TimeSignature } from "@/features/composition/time-signature";

type Navigation = { onBack: () => void; onSearch: () => void };
const header = { left: "back", actions: [] } as const;

/**
 * Browser-owned source form, draft and publication; the details and the audio steps (choose,
 * upload, record, piano) are native screens.
 */
export function NativeSourceCreateContent({
  onBack,
  onSearch,
  ...props
}: SocialCreateProps & Navigation) {
  const form = useSocialCreate(props);
  const audioOpen =
    form.audioStage !== "details" &&
    !form.sourceAudioLocked &&
    !form.restoring &&
    !form.draftExpired;
  if (audioOpen) return <NativeSourceAudioStep form={form} onSearch={onSearch} />;
  return (
    <>
      <NativeSourceCreateBridge form={form} onBack={onBack} onSearch={onSearch} />
      <SocialCreateForm form={form} />
    </>
  );
}

export function NativeSignedOutSourceCreateBridge(nav: Navigation) {
  const { requestLogin } = useLoginPrompt();
  return useNativeScreen(
    "source-create",
    { state: "signed-out" },
    {
      header: { ...header, actions: [...header.actions] },
      ...nav,
      onAction: (action) => {
        if (action.type === "sign-in") requestLogin();
      },
    },
  );
}

function NativeSourceCreateBridge({
  form,
  onBack,
  onSearch,
}: { form: SocialCreateState } & Navigation) {
  const [cropOpen, setCropOpen] = useState(false);
  const [pickError, setPickError] = useState<string | null>(null);
  const file = form.image?.file ?? null;
  // Downscale only the bridge preview; publishing still uses the original file and crop.
  const image = usePreview(file, 600);
  const model: NativeSourceCreate = form.restoring
    ? { state: "restoring" }
    : form.draftExpired && !form.busy
      ? { state: "expired" }
      : {
          state: "form",
          title: form.title,
          description: form.content,
          audio: form.sourceAudioLocked ? "locked" : form.audio ? "selected" : "none",
          instrumentLabel: form.sourceInstrument ? partLabel(form.sourceInstrument) : null,
          image,
          crop: form.imageCrop,
          cropping: cropOpen && form.image !== null,
          visibility: form.sourceVisibility,
          busy: form.busy,
          error: pickError ?? form.error,
          storageError: form.storageError || null,
          restoreError: form.restoreError || null,
          imageRestoreFailed: form.imageRestoreFailed,
          draftStatus: form.draftStatus,
          canSubmit: form.canSubmit,
          submitLabel: form.submitLabel,
        };
  const node = useNativeScreen("source-create", model, {
    header: { ...header, actions: [...header.actions] },
    onBack,
    onSearch,
    onAction: (action) => {
      // The web's "완료" closes the crop editor even while the form is busy.
      if (action.type === "source-create-crop-done") return setCropOpen(false);
      if (form.busy || form.restoring || form.draftExpired) return;
      switch (action.type) {
        case "source-create-title":
          return form.setTitle(action.value);
        case "source-create-description":
          return form.setContent(action.value);
        case "source-create-audio":
          if (!form.sourceAudioLocked) form.setAudioStage("choose");
          return;
        case "source-create-image":
          setPickError(null);
          void pickNativeImage().then(
            (picked) => {
              if (picked) {
                form.pickImage(picked);
                setCropOpen(true);
              }
            },
            (cause: unknown) =>
              setPickError(
                cause instanceof Error ? cause.message : "이미지를 추가하지 못했습니다.",
              ),
          );
          return;
        case "source-create-edit-image":
          return setCropOpen(true);
        case "source-create-crop":
          // Same bounds as the web cropper: the square stays inside the picture.
          if (image?.status === "ready")
            form.setImageCrop(clampCrop(action.crop, image.width, image.height));
          return;
        case "source-create-remove-image":
          setCropOpen(false);
          return form.removeImage();
        case "source-create-visibility":
          return form.setSourceVisibility(action.visibility);
        case "source-create-keep-without-image":
          return form.keepWithoutImage();
        case "source-create-submit":
          setPickError(null);
          return void form.submit();
        case "source-create-discard":
          return form.setConfirmDiscard(true);
      }
    },
  });
  return node;
}

/**
 * The sample registration audio steps (/sources/new?stage=…), each its own history entry and
 * native screen. Back goes to the choice, and from the choice to the details, like the web sheet.
 */
function NativeSourceAudioStep({
  form,
  onSearch,
}: {
  form: SocialCreateState;
  onSearch: () => void;
}) {
  const back = () => form.setAudioStage(form.audioStage === "choose" ? "details" : "choose");
  switch (form.audioStage) {
    case "choose":
      return <SourceChooseStep form={form} onBack={back} onSearch={onSearch} />;
    case "upload":
      return <SourceUploadStep form={form} onBack={back} onSearch={onSearch} />;
    case "record":
      return <SourceRecordStep form={form} onBack={back} onSearch={onSearch} />;
    default:
      return supportsMidi(form.pianoInstrument)
        ? <SourcePianoStep form={form} />
        : <SourceChooseStep form={form} onBack={back} onSearch={onSearch} />;
  }
}

type StepProps = { form: SocialCreateState } & Navigation;

function SourceChooseStep({ form, onBack, onSearch }: StepProps) {
  return useNativeScreen(
    "creation-choose",
    { busy: false, error: null, instrument: form.instrumentPrompt.native.model },
    {
      header: creationHeader,
      onBack,
      onSearch,
      onAction: (action) => {
        if (isNativeInstrumentAction(action)) return form.instrumentPrompt.native.act(action);
        if (action.type === "creation-choose") void form.chooseAudioMethod(action.method);
      },
    },
  );
}

function SourceUploadStep({ form, onBack, onSearch }: StepProps) {
  const [sourceSignature, setSourceSignature] = useState<TimeSignature>(defaultSignature);
  const upload = useNativeUpload({
    saveLabel: "오디오 선택 완료",
    onSave: form.selectAudio,
    instrument: form.instrumentPrompt.native,
    bpm: form.pianoBpm,
    signature: sourceSignature,
    timingMode: "initial",
    onTiming: async ({ bpm, signature }) => {
      form.setPianoBpm(bpm);
      setSourceSignature(signature);
    },
  });
  const node = useNativeScreen("creation-upload", upload.model, {
    header: creationHeader,
    onBack,
    onSearch,
    onAction: (action) => {
      if (action.type !== "more") upload.act(action);
    },
  });
  return (
    <>
      {node}
      {upload.node}
    </>
  );
}

function SourceRecordStep({ form, onBack, onSearch }: StepProps) {
  const [sourceSignature, setSourceSignature] = useState<TimeSignature>(defaultSignature);
  const record = useNativeRecord({
    saveLabel: "녹음 선택 완료",
    onSave: form.selectAudio,
    instrument: form.instrumentPrompt.native,
    bpm: form.pianoBpm,
    signature: sourceSignature,
    timingMode: "initial",
    onTiming: async ({ bpm, signature }) => {
      form.setPianoBpm(bpm);
      setSourceSignature(signature);
    },
  });
  const node = useNativeScreen("creation-record", record.model, {
    header: creationHeader,
    onBack,
    onSearch,
    onAction: (action) => {
      if (action.type !== "more") record.act(action);
    },
  });
  return (
    <>
      {node}
      {record.node}
    </>
  );
}

/** The landscape piano has no page header; its toolbar's back (and the app's) returns to the choice. */
function SourcePianoStep({ form }: { form: SocialCreateState }) {
  const piano = useNativeSourcePiano({
    instrument: form.pianoInstrument!,
    onInstrument: form.setPianoInstrument,
    notes: form.pianoNotes,
    setNotes: form.setPianoNotes,
    bpm: form.pianoBpm,
    onBpm: form.setPianoBpm,
    onBack: () => form.setAudioStage("choose"),
    onSave: form.saveSelectedAudio,
  });
  return useNativeScreen("creation-piano", piano.model, {
    header: null,
    onBack: () => piano.act({ type: "creation-piano-back" }),
    onAction: (action) => {
      if (action.type !== "more") piano.act(action);
    },
  });
}
