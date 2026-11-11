import { useId } from "react";
import { sharedStyles } from "@/styles/shared.styles";
import type { ShortRecommendationReason, SongCardDto } from "@/lib/api/contracts";
import { recommendationReasonLabel } from "./recommendation-reason";
import { PopularContentActions } from "@/features/posts/popular-content-actions";
export function SongRail({
  songs,
  onOpen,
  actions = false,
}: {
  songs: (SongCardDto & { reason?: ShortRecommendationReason })[];
  onOpen: (shortId: number) => void;
  actions?: boolean;
}) {
  const railId = useId();
  return (
    <div className={sharedStyles.songRail}>
      {songs.map((song) => (
        <div className={sharedStyles.songCard} key={song.shortId}>
          <button
            type="button"
            className="flex w-full flex-col text-left"
            onClick={() => onOpen(song.shortId)}
            aria-label={`${song.title} 열기`}
            aria-describedby={song.reason ? `${railId}-${song.shortId}-reason` : undefined}
          >
          <span className={sharedStyles.songArt}>
            {song.albumImageUrl ? (
              <img src={song.albumImageUrl} alt={`${song.title} 앨범 커버`} draggable={false} />
            ) : (
              <span className={sharedStyles.emptyArtwork} />
            )}
          </span>
          <strong>{song.title}</strong>
          <small>{song.author.nickname}</small>
          {song.reason && (
            <small id={`${railId}-${song.shortId}-reason`}>{recommendationReasonLabel[song.reason]}</small>
          )}
          </button>
          {actions && <PopularContentActions kind="short" id={song.shortId} title={song.title} ownerId={song.author.userId} />}
        </div>
      ))}
    </div>
  );
}
