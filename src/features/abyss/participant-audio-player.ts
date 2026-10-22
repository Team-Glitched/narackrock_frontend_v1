import { compositionEndMs } from "../composition/composition-playback-timeline.ts";
import { participantAudioSchedule } from "./participant-audio-schedule.ts";
import type { ParticipantTracks } from "../../lib/api/shorts.ts";

export type ParticipantPlaybackState = {
  playing: boolean; loading: boolean; positionMs: number; durationMs: number; error: string | null;
};
export const emptyParticipantPlayback: ParticipantPlaybackState = {
  playing: false, loading: false, positionMs: 0, durationMs: 0, error: null,
};

export class ParticipantAudioPlayer {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private buffers = new Map<string, AudioBuffer>();
  private sources: AudioBufferSourceNode[] = [];
  private nodes: AudioNode[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private request = 0;
  private controller: AbortController | null = null;
  private state = { ...emptyParticipantPlayback };
  private startedAt = 0;
  private startPosition = 0;
  private muted = false;
  private repeat = false;
  private last: { data: ParticipantTracks; ids: number[]; durationMs: number } | null = null;

  private changed: (state: ParticipantPlaybackState) => void;
  private ended: () => void;
  private createContext: () => AudioContext;

  constructor(changed: (state: ParticipantPlaybackState) => void, ended: () => void,
    createContext: () => AudioContext = () => new AudioContext()) {
    this.changed = changed; this.ended = ended; this.createContext = createContext;
  }

  private emit(update: Partial<ParticipantPlaybackState>) {
    this.state = { ...this.state, ...update };
    this.changed(this.state);
  }

  prepare() {
    this.context ??= this.createContext();
    if (!this.master) {
      this.master = this.context.createGain();
      this.master.connect(this.context.destination);
    }
    this.master.gain.value = this.muted ? 0 : 1;
    return this.context.resume();
  }

  setMuted(value: boolean) {
    this.muted = value;
    if (this.master) this.master.gain.value = value ? 0 : 1;
  }
  setRepeat(value: boolean) { this.repeat = value; }

  private position() {
    return this.state.playing && this.context
      ? Math.min(this.state.durationMs, this.startPosition + Math.max(0, this.context.currentTime - this.startedAt) * 1000)
      : this.state.positionMs;
  }

  pause() {
    const positionMs = this.position();
    this.request++;
    this.controller?.abort();
    this.controller = null;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    for (const source of this.sources) { try { source.stop(); } catch { /* already ended */ } }
    this.sources = [];
    this.nodes.forEach(node => node.disconnect());
    this.nodes = [];
    this.emit({ playing: false, loading: false, positionMs });
  }

  async play(data: ParticipantTracks, ids: number[], positionMs: number, durationMs?: number) {
    this.pause();
    const request = ++this.request;
    const controller = new AbortController();
    this.controller = controller;
    const endMs = durationMs && durationMs > 0 ? durationMs : compositionEndMs(data, data.tracks);
    const position = positionMs >= endMs ? 0 : Math.max(0, positionMs);
    this.last = { data, ids, durationMs: endMs };
    if (endMs <= 0) { this.emit({ error: "재생할 트랙이 없습니다." }); return; }
    this.emit({ loading: true, positionMs: position, durationMs: endMs, error: null });
    try {
      await this.prepare();
      if (request !== this.request || !this.context || !this.master) return;
      const context = this.context;
      const sounds = participantAudioSchedule(data, ids, position);
      await Promise.all([...new Set(sounds.map(sound => sound.url))].map(async url => {
        if (this.buffers.has(url)) return;
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) throw new Error("선택한 참여자의 음원을 불러오지 못했습니다.");
        const buffer = await context.decodeAudioData(await response.arrayBuffer());
        if (request === this.request) this.buffers.set(url, buffer);
      }));
      if (request !== this.request) return;
      const startedAt = context.currentTime + .04;
      for (const sound of sounds) {
        const buffer = this.buffers.get(sound.url)!;
        const offset = sound.offsetMs / 1000;
        if (offset >= buffer.duration) continue;
        const source = context.createBufferSource();
        source.buffer = buffer;
        source.playbackRate.value = sound.rate;
        const gain = context.createGain();
        const panner = context.createStereoPanner();
        panner.pan.value = sound.pan;
        source.connect(gain); gain.connect(panner); panner.connect(this.master);
        const start = startedAt + sound.startMs / 1000;
        const length = Math.min(sound.durationMs / 1000, (buffer.duration - offset) / sound.rate);
        gain.gain.setValueAtTime(sound.gain, start);
        if (sound.release) {
          gain.gain.setValueAtTime(sound.gain, start + Math.max(0, length - .04));
          gain.gain.linearRampToValueAtTime(0, start + length);
        }
        source.start(start, offset);
        source.stop(start + length);
        this.sources.push(source);
        this.nodes.push(source, gain, panner);
      }
      this.startedAt = startedAt;
      this.startPosition = position;
      this.emit({ playing: true, loading: false });
      this.timer = setInterval(() => {
        const next = this.position();
        this.emit({ positionMs: next });
        if (next >= endMs) {
          this.pause();
          if (this.repeat && ids.length) void this.play(data, ids, 0, endMs);
          else this.ended();
        }
      }, 50);
    } catch (error) {
      if (request !== this.request) return;
      this.pause();
      this.emit({ error: error instanceof Error ? error.message : "음원을 재생하지 못했습니다." });
    }
  }

  seek(positionMs: number) {
    const playing = this.state.playing;
    const last = this.last;
    this.pause();
    this.emit({ positionMs, error: null });
    if (playing && last) void this.play(last.data, last.ids, positionMs, last.durationMs);
  }

  resume() {
    if (this.last) return this.play(this.last.data, this.last.ids, this.state.positionMs, this.last.durationMs);
  }

  dispose() {
    this.pause();
    this.buffers.clear();
    this.master?.disconnect();
    this.master = null;
    void this.context?.close();
    this.context = null;
  }
}
