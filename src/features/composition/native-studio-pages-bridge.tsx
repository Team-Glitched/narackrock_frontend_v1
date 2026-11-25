import { useState } from "react";
import { useNativeScreen } from "@/features/navigation/use-native-screen";
import { pickNativeImage } from "@/lib/native-app";
import type {
  NativeHeader,
  NativeInstrumentAction,
  NativeInstrumentPicker,
} from "@/lib/native-screens";
import { isNativeAlbumAction, isNativeInstrumentAction } from "@/lib/native-screens/studio";
import type { CreationMethod } from "./creation-screens";
import { useNativeAlbumCrop } from "./native-album-crop";
import type { NewProjectState } from "./new-project-screen";
import { errorText } from "./studio-helpers";

const header: NativeHeader = { left: "back", actions: [] };

/** /studio/new as the app's native screen, over the web form's `useNewProject` state. */
export function NativeStudioNewBridge({
  project,
  onBack,
  onSearch,
  onMigration,
}: {
  project: NewProjectState;
  onBack: () => void;
  onSearch: () => void;
  onMigration: () => void;
}) {
  const album = useNativeAlbumCrop({ file: project.image, onApply: project.chooseImage });
  const [pickError, setPickError] = useState<string | null>(null);
  return useNativeScreen(
    "studio-new",
    {
      suggestion: project.suggestion,
      suggestionCount: project.suggestionCount,
      album: album.model,
      canResume: project.savedDraftId !== null,
      busy: project.busy,
      error: project.error ?? pickError,
    },
    {
      header,
      onBack,
      onSearch,
      onAction: (action) => {
        if (isNativeAlbumAction(action)) {
          if (action.type !== "album-edit" || !project.busy) album.act(action);
          return;
        }
        switch (action.type) {
          case "studio-new-suggest":
            if (!project.busy) project.suggestAnotherTitle();
            return;
          case "studio-new-image":
            if (project.busy) return;
            setPickError(null);
            void pickNativeImage()
              .then((file) => {
                if (file) album.select(file);
              })
              .catch((cause) => setPickError(errorText(cause)));
            return;
          case "studio-new-start":
            return void project.start(action.title);
          case "studio-new-resume":
            if (!project.busy) void project.resume();
            return;
          case "studio-new-migration":
            return onMigration();
        }
      },
    },
  );
}

/** /studio/:projectId/layers/new as the app's native screen (layer kinds + the instrument prompt). */
export function NativeLayerChoiceBridge({
  invalid,
  busy,
  error,
  instrument,
  onChoose,
  onBack,
  onSearch,
}: {
  invalid: boolean;
  busy: boolean;
  error: string | null;
  instrument: {
    model: NativeInstrumentPicker | null;
    act: (action: NativeInstrumentAction) => void;
  };
  onChoose: (method: CreationMethod) => void;
  onBack: () => void;
  onSearch: () => void;
}) {
  return useNativeScreen(
    "studio-layer-choice",
    { invalid, busy, error, instrument: instrument.model },
    {
      header,
      onBack,
      onSearch,
      onAction: (action) => {
        if (isNativeInstrumentAction(action)) instrument.act(action);
        else if (action.type === "studio-layer-choose" && !busy && !invalid)
          onChoose(action.method);
      },
    },
  );
}
