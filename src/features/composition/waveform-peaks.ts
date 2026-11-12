type WaveformSource = Pick<AudioBuffer, "getChannelData" | "length" | "numberOfChannels" | "sampleRate">;

/** Bins follow the clip's source window, including any silence past the end of the file. */
export function waveformPeaks(
  buffer: WaveformSource,
  barCount: number,
  offsetMs = 0,
  durationMs = buffer.length * 1000 / buffer.sampleRate,
): number[] {
  const peaks = Array<number>(barCount).fill(0);
  if (durationMs <= 0 || barCount === 0) return peaks;
  const start = Math.max(0, offsetMs) * buffer.sampleRate / 1000;
  const framesPerBar = durationMs * buffer.sampleRate / 1000 / barCount;
  for (let index = 0; index < buffer.numberOfChannels; index += 1) {
    const channel = buffer.getChannelData(index);
    for (let bar = 0; bar < barCount; bar += 1) {
      const from = Math.round(start + bar * framesPerBar);
      const to = Math.min(buffer.length, Math.round(start + (bar + 1) * framesPerBar));
      let peak = peaks[bar];
      for (let frame = from; frame < to; frame += 1)
        peak = Math.max(peak, Math.abs(channel[frame]));
      peaks[bar] = peak;
    }
  }
  const maximum = Math.max(0.01, ...peaks);
  return peaks.map((peak) => peak / maximum);
}
