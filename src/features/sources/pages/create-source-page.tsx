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
  const galleryId = readId(params.galleryId) ?? readId(query.get("galleryId"));
  const scope = resolveSearchScope(query.get("scope"), "songs", Boolean(galleryId));
  const backPath = !query.has("stage")
    ? "/sources"
    : stage === "choose"
      ? "/sources/new"
      : "/sources/new?stage=choose";
  const leave = () => back(backPath);
  const search = () => to(withQuery("/search", { scope, galleryId }));
  const createProps: SocialCreateProps = {
    kind: "source",
    galleryId: DEFAULT_GALLERY_ID,
    audioStage: stage,
    // The steps form a stack over the details entry: going forward pushes, going back returns to
    // the entry it came from. Pushing "details" again would leave stale step entries behind it,
    // and "작성 취소" (one step back) would then land on a step of the discarded draft.
    onAudioStage: (next) => {
      if (next === "details") {
        if (stageDepth > 0) navigate(-stageDepth);
        else to("/sources/new", { replace: true });
      } else if (next === "choose" && stageDepth > 1) {
        navigate(-(stageDepth - 1));
      } else {
        to(withQuery("/sources/new", { stage: next }), {
          state: { stageDepth: next === "choose" ? 1 : stageDepth + 1 },
        });
      }
    },
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
    <DesignViewport landscape={pianoMode}>
      <div className={cn(sharedStyles.phoneFrame, pianoMode && sharedStyles.phoneFrameSourcePiano)}>
        {!pianoMode && (
          <Header
            onBack={() => back(backPath)}
            onSearch={() => to(withQuery("/search", { scope, galleryId }))}
          />
        )}
        <div className={sharedStyles.screenBody}>
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
