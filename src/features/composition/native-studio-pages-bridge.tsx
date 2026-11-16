import { useState } from "react";
import { useNativeScreen } from "@/features/navigation/use-native-screen";
import { pickNativeImage } from "@/lib/native-app";
import type {
  NativeHeader,
  NativeInstrumentAction,
  NativeInstrumentPicker,
} from "@/lib/native-screens";
import { isNativeInstrumentAction } from "@/lib/native-screens/studio";
import type { CreationMethod } from "./creation-screens";
import type { NewProjectState } from "./new-project-screen";
import { errorText } from "./studio-helpers";

const header: NativeHeader = { left: "back", actions: ["notifications", "search", "account"] };

/** A small JPEG of the chosen album (the app cannot load the page's blob: URLs). */
async function albumThumbnail(file: File) {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  const scale = Math.min(1, 700 / Math.max(bitmap.width, bitmap.height));
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.8);
}

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
  const [thumbnail, setThumbnail] = useState<{ file: File; url: string } | null>(null);
  const [pickError, setPickError] = useState<string | null>(null);
  return useNativeScreen(
    "studio-new",
    {
      suggestion: project.suggestion,
      suggestionCount: project.suggestionCount,
      imageUrl: thumbnail && thumbnail.file === project.image ? thumbnail.url : null,
      canResume: project.savedDraftId !== null,
      busy: project.busy,
      error: project.error ?? pickError,
    },
    {
      header,
      onBack,
      onSearch,
      onAction: (action) => {
        switch (action.type) {
          case "studio-new-suggest":
            if (!project.busy) project.suggestAnotherTitle();
            return;
          case "studio-new-image":
            setPickError(null);
            void pickNativeImage()
              .then(async (file) => {
                if (!file) return;
                project.chooseImage(file);
                if (file.size <= 100 * 1024 * 1024)
                  setThumbnail({ file, url: await albumThumbnail(file) });
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
