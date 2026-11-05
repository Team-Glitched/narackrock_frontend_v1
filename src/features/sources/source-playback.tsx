import { sourceStyles } from "@/styles/source.styles";
import { useRef, useState } from "react";
import { AudioPlaybackBar } from "@/components/audio-playback-bar";
import { ApiError } from "@/lib/api/client";
import { getOpenSourcePlayback, type OpenSourcePlayback } from "@/lib/api/open-sources";

function playbackError(cause: unknown) {
  if (cause instanceof ApiError) {
    if (cause.status === 401) return "로그인 후 재생할 수 있습니다.";
    if (cause.status === 403) return "이 오픈소스를 재생할 권한이 없습니다.";
    if (cause.status === 404) return "삭제되었거나 비공개로 바뀐 오픈소스입니다.";
    return cause.message;
  }
  return "재생 정보를 불러오지 못했습니다. 네트워크를 확인해주세요.";
}

const expired = (playback: OpenSourcePlayback) => Date.parse(playback.expiresAt) <= Date.now() + 5_000;

/** Plays a server open source through its short-lived signed URL, renewing it when it has expired. */
export function SourcePlayback({
  sourceId,
  canPreview,
  durationMs,
}: {
  sourceId: number;
  canPreview: boolean;
  durationMs: number | null;
}) {
  const audio = useRef<HTMLAudioElement>(null);
  const playback = useRef<OpenSourcePlayback | null>(null);
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState<number | null>(durationMs === null ? null : durationMs / 1000);
  const [error, setError] = useState("");
  async function toggle() {
    const player = audio.current;
    if (!player || !canPreview || loading) return;
    if (!player.paused) {
      player.pause();
      return;
    }
    setError("");
    try {
      if (!playback.current || expired(playback.current)) {
        setLoading(true);
        const next = await getOpenSourcePlayback(sourceId);
        playback.current = next;
        const resume = player.currentTime;
        player.src = next.audioUrl;
        player.currentTime = resume;
        if (next.durationMs !== null) setDuration(next.durationMs / 1000);
      }
      await player.play();
    } catch (cause) {
      setError(cause instanceof DOMException ? "오디오를 재생하지 못했습니다. 다시 시도해주세요." : playbackError(cause));
    } finally {
      setLoading(false);
    }
  }
  if (!canPreview)
    return (
      <p className={sourceStyles.osAudioError} role="status">
        이 오픈소스는 현재 미리듣기를 사용할 수 없습니다.
      </p>
    );
  return (
    <>
      <audio
        hidden
        ref={audio}
        muted={muted}
        preload="none"
        onLoadedMetadata={(event) => {
          if (Number.isFinite(event.currentTarget.duration)) setDuration(event.currentTarget.duration);
        }}
        onTimeUpdate={(event) => setPosition(event.currentTarget.currentTime)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onError={() => {
          setPlaying(false);
          const current = playback.current;
          if (current && expired(current)) {
            playback.current = null;
            setError("재생 링크가 만료되었습니다. 다시 재생하면 새 링크를 받습니다.");
          } else setError("오디오를 불러오지 못했습니다.");
        }}
      />
      <AudioPlaybackBar
        playing={playing}
        muted={muted}
        positionMs={position * 1000}
        durationMs={(duration ?? 0) * 1000}
        disabled={loading}
        onToggle={() => void toggle()}
        onSeek={(ms) => {
          if (audio.current && playback.current) {
            audio.current.currentTime = ms / 1000;
            setPosition(ms / 1000);
          }
        }}
        onMute={() => setMuted((value) => !value)}
        label="오픈소스"
      />
      {duration === null && <small>재생 시간 정보 없음</small>}
      {error && (
        <p className={sourceStyles.osAudioError} role="alert">
          {error}
        </p>
      )}
    </>
  );
}
