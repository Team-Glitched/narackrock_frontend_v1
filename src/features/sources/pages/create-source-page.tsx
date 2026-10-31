import { SocialCreate } from "@/features/community/create-content";
import { useAppNavigation } from "@/features/navigation/use-app-navigation";
import { DEFAULT_GALLERY_ID } from "@/lib/api/community";
import { withQuery } from "@/features/navigation/paths";
export type SourceStage = "details" | "choose" | "upload" | "record" | "note";
export function sourceStage(value: string | null): SourceStage {
  return ["choose", "upload", "record", "note"].includes(value ?? "")
    ? (value as SourceStage)
    : "details";
}
export default function CreateSourcePage() {
  const { to, back, query } = useAppNavigation();
  const stage = sourceStage(query.get("stage"));
  return (
    <SocialCreate
      kind="source"
      galleryId={DEFAULT_GALLERY_ID}
      audioStage={stage}
      onAudioStage={(next) =>
        to(withQuery("/sources/new", { stage: next === "details" ? null : next }))
      }
      onCancel={() => back("/sources")}
      onCreated={() => to("/sources", { replace: true })}
    />
  );
}
