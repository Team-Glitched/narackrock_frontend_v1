import { sharedStyles } from "@/styles/shared.styles";
import type { ShortItemDto } from "@/lib/api/contracts";
export function SongRail({
  songs,
  onOpen,
}: {
  songs: ShortItemDto[];
  onOpen: (shortId: number) => void;
}) {
  return (
    <div className={sharedStyles.songRail}>
      {songs.map((song) => (
        <button
          type="button"
          className={sharedStyles.songCard}
          key={song.shortId}
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
      ))}
    </div>
  );
}
