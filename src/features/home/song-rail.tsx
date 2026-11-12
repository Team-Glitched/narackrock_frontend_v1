import { sharedStyles } from "@/styles/shared.styles";
import type { SongCardDto } from "@/lib/api/contracts";
import { PopularContentActions } from "@/features/posts/popular-content-actions";
export function SongRail({
  songs,
  onOpen,
  actions = false,
}: {
  songs: SongCardDto[];
  onOpen: (shortId: number) => void;
  actions?: boolean;
}) {
  return (
    <div className={sharedStyles.songRail}>
      {songs.map((song) => (
        <div className={sharedStyles.songCard} key={song.shortId}>
          <button
            type="button"
            className="flex w-full flex-col text-left"
            onClick={() => onOpen(song.shortId)}
            aria-label={`${song.title} 열기`}
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
          </button>
          {actions && <PopularContentActions kind="short" id={song.shortId} title={song.title} ownerId={song.author.userId} />}
        </div>
      ))}
    </div>
  );
}
