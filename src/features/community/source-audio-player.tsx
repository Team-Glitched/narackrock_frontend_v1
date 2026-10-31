import { sourceStyles } from "@/styles/source.styles";
import { useRef, useState } from "react";
import { AudioPlaybackBar } from "@/components/app/audio-playback-bar";

export function SourceAudioPlayer({ src }: { src: string | null }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false),
    [muted, setMuted] = useState(false);
  const [position, setPosition] = useState(0),
    [duration, setDuration] = useState(0),
    [error, setError] = useState("");
  async function toggle() {
    const player = audio.current;
    if (!src || !player) return;
    if (!player.paused) {
      player.pause();
      return;
    }
    setError("");
    try {
      await player.play();
    } catch {
      setError("오디오를 재생하지 못했습니다. 다시 시도해주세요.");
    }
  }
  return (
    <>
      <audio
        hidden
        ref={audio}
        src={src ?? undefined}
        muted={muted}
        preload="metadata"
        onLoadedMetadata={(event) =>
          setDuration(
            Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0,
          )
        }
        onDurationChange={(event) =>
          setDuration(
            Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0,
          )
        }
        onTimeUpdate={(event) => setPosition(event.currentTarget.currentTime)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onError={() => {
          setPlaying(false);
          setError("오디오를 불러오지 못했습니다.");
        }}
      />
      <AudioPlaybackBar
        playing={playing}
        muted={muted}
        positionMs={position * 1000}
        durationMs={duration * 1000}
        disabled={!src}
        onToggle={() => void toggle()}
        onSeek={(ms) => {
          if (audio.current) {
            audio.current.currentTime = ms / 1000;
            setPosition(ms / 1000);
          }
        }}
        onMute={() => setMuted((value) => !value)}
        label="오픈소스"
      />
      {error && (
        <p className={sourceStyles.osAudioError} role="alert">
          {error}
        </p>
      )}
    </>
  );
}
