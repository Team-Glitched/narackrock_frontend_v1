import type { ReactNode } from "react";
import { sharedStyles } from "@/styles/shared.styles";
import type { SongCardDto } from "@/lib/api/contracts";
import { MusicCard } from "@/components/music-card";
import { PopularContentActions } from "@/features/posts/popular-content-actions";
export function SongRail({
  songs,
  onOpen,
  actions = false,
  renderCorner,
}: {
  songs: SongCardDto[];
  onOpen: (shortId: number) => void;
  actions?: boolean;
  renderCorner?: (song: SongCardDto) => ReactNode;
}) {
  return (
    <div className={sharedStyles.songRail}>
      {songs.map((song) => (
        <MusicCard
          key={song.shortId}
          title={song.title}
          author={song.author.nickname}
          albumImageUrl={song.albumImageUrl}
          onOpen={() => onOpen(song.shortId)}
          cornerSlot={renderCorner?.(song)}
          actionsSlot={
            actions ? (
              <PopularContentActions
                kind="short"
                id={song.shortId}
                title={song.title}
                ownerId={song.author.userId}
              />
            ) : undefined
          }
        />
      ))}
    </div>
  );
}
