import { sharedStyles } from "@/styles/shared.styles";
import { useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { useCurrentUserId } from "@/features/auth/use-current-user";
import { ApiError } from "@/lib/api/client";
import type { ShortItemDto } from "@/lib/api/contracts";
import {
  getShortComposers,
  getShortParticipantTracks,
  type ShortComposer,
  type ShortParticipantTracks,
} from "@/lib/api/shorts";

/**
 * Composer list and approved participant tracks. Playing a track first pauses the song (`onBeforePlay`) so the
 * two never sound together; leaving the sheet stops the track.
 */
export function ShortParticipants({ short, onBeforePlay }: { short: ShortItemDto; onBeforePlay: () => void }) {
  const userId = useCurrentUserId();
  const audio = useRef<HTMLAudioElement>(null);
  const [loaded, setLoaded] = useState<{
    key: string;
    composers?: ShortComposer[];
    tracks?: ShortParticipantTracks;
    error?: string;
  } | null>(null);
  const [playing, setPlaying] = useState<number | null>(null);
  const [playError, setPlayError] = useState("");
  const key = `${userId}:${short.shortId}`;
  useEffect(() => {
    if (userId === null) return;
    const controller = new AbortController();
    Promise.all([getShortComposers(short.shortId, controller.signal), getShortParticipantTracks(short.shortId, controller.signal)])
      .then(([composers, tracks]) => setLoaded({ key, composers, tracks }))
      .catch((cause) => {
        if (controller.signal.aborted) return;
        setLoaded({
          key,
          error: cause instanceof ApiError && cause.status === 403 ? "참여자 트랙을 볼 권한이 없습니다." : "참여자 정보를 불러오지 못했습니다.",
        });
      });
    return () => controller.abort();
  }, [key, short.shortId, userId]);
  useEffect(() => () => audio.current?.pause(), []);
  async function play(clipId: number, url: string) {
    const player = audio.current;
    if (!player) return;
    if (playing === clipId) {
      player.pause();
      return;
    }
    onBeforePlay();
    setPlayError("");
    player.src = url;
    try {
      await player.play();
      setPlaying(clipId);
    } catch {
      setPlayError("트랙을 재생하지 못했습니다.");
    }
  }
  const current = loaded?.key === key ? loaded : null;
  if (userId === null)
    return (
      <ul className={sharedStyles.participantList}>
        {short.participants.length ? (
          short.participants.map((person) => (
            <li key={person.userId}>
              <Avatar />
              <span>
                <strong>{person.nickname}</strong>
                <small>{person.userId === short.author.userId ? "원곡자" : "작곡 참여자"}</small>
              </span>
            </li>
          ))
        ) : (
          <li>아직 참여자가 없습니다.</li>
        )}
        <li>참여자별 트랙 듣기는 로그인 후 사용할 수 있습니다.</li>
      </ul>
    );
  if (!current) return <p role="status">참여자 정보를 불러오는 중...</p>;
  if (current.error) return <p role="alert">{current.error}</p>;
  const tracks = current.tracks?.tracks ?? [];
  return (
    <ul className={sharedStyles.participantList}>
      <audio hidden ref={audio} onPause={() => setPlaying(null)} onEnded={() => setPlaying(null)} />
      {current.composers?.map((person) => {
        const clips = tracks
          .filter((track) => track.ownerId === person.userId)
          .flatMap((track) => track.clips.map((clip) => ({ track, clip })));
        return (
          <li key={person.userId}>
            <Avatar src={person.profileImageUrl} />
            <span>
              <strong>{person.nickname}</strong>
              <small>
                {person.userId === short.author.userId ? "원곡자" : "작곡 참여자"}
                {person.role ? ` · ${person.role}` : ""}
              </small>
              {clips.map(({ track, clip }) =>
                clip.mediaUrl ? (
                  <button key={clip.clipId} aria-pressed={playing === clip.clipId} onClick={() => void play(clip.clipId, clip.mediaUrl as string)}>
                    {playing === clip.clipId ? `${track.name} 정지` : `${track.name} 듣기`}
                  </button>
                ) : (
                  <small key={clip.clipId}>{track.name}: 재생 파일이 없는 MIDI 트랙</small>
                ),
              )}
            </span>
          </li>
        );
      })}
      {current.composers?.length === 0 && <li>아직 참여자가 없습니다.</li>}
      {playError && <li role="alert">{playError}</li>}
    </ul>
  );
}
