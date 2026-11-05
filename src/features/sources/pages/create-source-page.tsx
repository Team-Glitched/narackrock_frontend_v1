import { SocialCreate } from "@/features/community/create-content";
import { DesignViewport } from "@/components/design-viewport";
import { Header } from "@/features/navigation/header";
import { NotificationsOverlay } from "@/features/notifications/notifications-overlay";
import { useUrlNavigation } from "@/features/navigation/use-url-navigation";
import { resolveSearchScope } from "@/features/search/search-scope";
import { DEFAULT_GALLERY_ID } from "@/lib/api/community";
import { readId, withQuery } from "@/features/navigation/paths";
import { sharedStyles } from "@/styles/shared.styles";
import { cn } from "@/lib/utils";
import { useCurrentUserId } from "@/features/auth/use-current-user";
import { SignInRequired } from "@/features/auth/sign-in-required";
import { apiOrigin } from "@/lib/api/client";

export type SourceStage = "details" | "choose" | "upload" | "record" | "note";
export function sourceStage(value: string | null): SourceStage {
  return ["choose", "upload", "record", "note"].includes(value ?? "")
    ? (value as SourceStage)
    : "details";
}

export default function CreateSourcePage() {
  const { to, back, params, query } = useUrlNavigation();
  const userId = useCurrentUserId();
  const signedIn = userId !== null;
  const stage = sourceStage(query.get("stage"));
  const pianoMode = stage === "note";
  const galleryId = readId(params.galleryId) ?? readId(query.get("galleryId"));
  const scope = resolveSearchScope(query.get("scope"), "songs", Boolean(galleryId));
  const backPath = !query.has("stage") ? "/sources" : stage === "choose" ? "/sources/new" : "/sources/new?stage=choose";
  return (
    <DesignViewport landscape={pianoMode}>
      <div className={cn(sharedStyles.phoneFrame, pianoMode && sharedStyles.phoneFrameSourcePiano)}>
        {!pianoMode && <Header onBack={() => back(backPath)} onSearch={() => to(withQuery("/search", { scope, galleryId }))} />}
        <div className={sharedStyles.screenBody}>
          {signedIn ? (
            <SocialCreate
              key={JSON.stringify([apiOrigin(), userId])}
              kind="source"
              galleryId={DEFAULT_GALLERY_ID}
              audioStage={stage}
              onAudioStage={(next) => to(withQuery("/sources/new", { stage: next === "details" ? null : next }))}
              onCancel={() => back("/sources")}
              onCreated={() => to("/sources?tab=mine", { replace: true })}
            />
          ) : (
            <SignInRequired>오픈소스 등록은 로그인 후 사용할 수 있습니다.</SignInRequired>
          )}
        </div>
        <NotificationsOverlay />
      </div>
    </DesignViewport>
  );
}
