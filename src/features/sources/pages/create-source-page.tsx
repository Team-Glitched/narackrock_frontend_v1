import { useDevicePortrait } from "@/hooks/use-device-portrait";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { SocialCreate, type SocialCreateProps } from "@/features/community/create-content";
import { DesignViewport } from "@/components/design-viewport";
import { Header } from "@/features/navigation/header";
import { NotificationsOverlay } from "@/features/notifications/notifications-overlay";
import { useUrlNavigation, type NavigationState } from "@/features/navigation/use-url-navigation";
import { resolveSearchScope } from "@/features/search/search-scope";
import { DEFAULT_GALLERY_ID } from "@/lib/api/community";
import { readId, withQuery } from "@/features/navigation/paths";
import { sharedStyles } from "@/styles/shared.styles";
import { cn } from "@/lib/utils";
import { useCurrentUserId } from "@/features/auth/use-current-user";
import { SignInRequired } from "@/features/auth/sign-in-required";
import { apiOrigin } from "@/lib/api/client";
import { sourceKeys } from "../source-queries";
import { nativeApp } from "@/lib/native-app";
import {
  NativeSignedOutSourceCreateBridge,
  NativeSourceCreateContent,
} from "../native-source-create-bridge";

export type SourceStage = "details" | "choose" | "upload" | "record" | "note";
export function sourceStage(value: string | null): SourceStage {
  return ["choose", "upload", "record", "note"].includes(value ?? "")
    ? (value as SourceStage)
    : "details";
}

/** How many audio-step entries sit above the details entry they were opened from. */
type CreateSourceState = NavigationState & { stageDepth?: number };

export default function CreateSourcePage() {
  const { to, back, params, query, state } = useUrlNavigation<CreateSourceState>();
  const navigate = useNavigate();
  const stageDepth = state.stageDepth ?? 0;
  const userId = useCurrentUserId();
  const queryClient = useQueryClient();
  const signedIn = userId !== null;
  const stage = sourceStage(query.get("stage"));
  const pianoMode = stage === "note";
  const portrait = useDevicePortrait();
  const galleryId = readId(params.galleryId) ?? readId(query.get("galleryId"));
  const scope = resolveSearchScope(query.get("scope"), "songs", Boolean(galleryId));
  const search = () => to(withQuery("/search", { scope, galleryId }));
  function changeAudioStage(next: SourceStage) {
    if (next === stage) return;
    const path = withQuery("/sources/new", { stage: next === "details" ? undefined : next });
    // A direct link to an audio step has no details entry below it.
    if (stage !== "details" && stageDepth === 0) {
      to(path, { replace: true, state: { from: state.from } });
    } else if (next === "details" && stageDepth > 0) {
      navigate(-stageDepth);
    } else if (next === "choose" && stageDepth > 1) {
      navigate(-(stageDepth - 1));
    } else {
      to(path, { state: { stageDepth: stageDepth + 1 } });
    }
  }
  const leave = () => {
    if (stage === "details") back("/sources");
    else changeAudioStage(stage === "choose" ? "details" : "choose");
  };
  const createProps: SocialCreateProps = {
    kind: "source",
    galleryId: DEFAULT_GALLERY_ID,
    audioStage: stage,
    onAudioStage: changeAudioStage,
    onCancel: () => back("/sources"),
    onCreated: () => {
      void queryClient.invalidateQueries({ queryKey: sourceKeys.all(userId) });
      to("/sources?tab=mine", { replace: true });
    },
  };
  if (nativeApp())
    return (
      <>
        {signedIn ? (
          <NativeSourceCreateContent
            key={JSON.stringify([apiOrigin(), userId])}
            {...createProps}
            onBack={leave}
            onSearch={search}
          />
        ) : (
          <NativeSignedOutSourceCreateBridge onBack={leave} onSearch={search} />
        )}
        <NotificationsOverlay />
      </>
    );
  return (
    <DesignViewport landscape={pianoMode && !portrait}>
      <div className={cn(sharedStyles.phoneFrame, pianoMode && sharedStyles.phoneFrameSourcePiano)}>
        {!pianoMode && <Header minimal onBack={leave} onSearch={search} />}
        <div className={cn(sharedStyles.screenBody, pianoMode && "p-0")}>
          {signedIn ? (
            <SocialCreate key={JSON.stringify([apiOrigin(), userId])} {...createProps} />
          ) : (
            <SignInRequired>샘플 등록은 로그인 후 사용할 수 있습니다.</SignInRequired>
          )}
        </div>
        <NotificationsOverlay />
      </div>
    </DesignViewport>
  );
}
