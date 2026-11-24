import type { ReactNode } from "react";
import { pickDefaultCover } from "@/lib/default-covers";
import { cn } from "@/lib/utils";
import { sharedStyles } from "@/styles/shared.styles";

export function AlbumArtwork({
  src,
  title,
  seed,
  alt,
  className,
}: {
  src?: string | null;
  title?: string;
  seed?: string | number | null;
  alt?: string;
  className?: string;
}) {
  const resolvedSrc = src?.trim() || pickDefaultCover(seed ?? title ?? "music");
  const resolvedAlt = alt ?? (title ? `${title} 앨범 커버` : "기본 앨범 커버");
  return (
    <span
      className={cn(
        "block overflow-hidden rounded-[8px] bg-app-surface [&>img]:size-full [&>img]:object-cover",
        className,
      )}
    >
      <img src={resolvedSrc} alt={resolvedAlt} draggable={false} />
    </span>
  );
}

export function MusicCard({
  title,
  author,
  albumImageUrl,
  seed,
  onOpen,
  actionsSlot,
  cornerSlot,
  className,
}: {
  title: string;
  author?: string | null;
  albumImageUrl?: string | null;
  seed?: string | number | null;
  onOpen: () => void;
  actionsSlot?: ReactNode;
  cornerSlot?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn(sharedStyles.songCard, "relative w-40 flex-[0_0_160px] flex-col items-start", className)}>
      <AlbumArtwork
        src={albumImageUrl}
        title={title}
        seed={seed ?? `${title}:${author ?? ""}`}
        className={cn(sharedStyles.songArt, "mb-[10px] size-40 rounded-[10px]")}
      />
      {cornerSlot && <div className="absolute top-2 right-2 z-[2]">{cornerSlot}</div>}
      <div className="flex w-full min-w-0 items-start justify-between gap-1">
        <div className="flex min-w-0 flex-1 flex-col gap-1 text-left">
          <button
            type="button"
            onClick={onOpen}
            aria-label={`${title} 열기`}
            className={cn(
              "w-full min-w-0 text-left",
              "after:absolute after:inset-0 after:rounded-[10px] after:content-['']",
              "focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-[#8a56ff]",
            )}
          >
            <strong className="block w-full truncate text-label leading-[20px] font-bold text-app-fg">
              {title}
            </strong>
          </button>
          {author && (
            <small className="block w-full truncate text-body leading-[18px] font-normal text-app-muted">
              {author}
            </small>
          )}
        </div>
        {actionsSlot && <div className="relative z-[1] -mt-0.5 -mr-1 shrink-0">{actionsSlot}</div>}
      </div>
    </div>
  );
}
