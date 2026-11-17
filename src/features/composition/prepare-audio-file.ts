const sampleRate = 44_100;

export type AudioSelection = { startMs: number; endMs: number };

export async function prepareAudioFile(
  file: File,
  selection?: AudioSelection,
): Promise<{ wav: File; durationMs: number }> {
  const decoder = new AudioContext();
  let decoded: AudioBuffer;
  try {
    decoded = await decoder.decodeAudioData(await file.arrayBuffer());
  } catch {
    throw new Error("이 오디오 파일을 읽을 수 없습니다.");
  } finally {
    await decoder.close();
  }
  const fullDurationMs = decoded.duration * 1000;
  const startMs = selection?.startMs ?? 0;
  const requestedEndMs = selection?.endMs ?? fullDurationMs;
  if (
    !Number.isFinite(fullDurationMs) ||
    !Number.isFinite(startMs) ||
    !Number.isFinite(requestedEndMs) ||
    startMs < 0 ||
    startMs >= fullDurationMs ||
    requestedEndMs <= startMs ||
    requestedEndMs > fullDurationMs + 100
  ) {
    throw new Error("선택한 오디오 구간이 올바르지 않습니다.");
  }
  const endMs = Math.min(requestedEndMs, fullDurationMs);
  const selectedDurationMs = endMs - startMs;
  if (selectedDurationMs > 60_000) throw new Error("선택 구간은 1분 이하여야 합니다.");

  const frames = Math.max(1, Math.floor((selectedDurationMs * sampleRate) / 1000));
  const offline = new OfflineAudioContext(2, frames, sampleRate);
  const source = offline.createBufferSource();
  source.buffer = decoded;
  source.connect(offline.destination);
  source.start(0, startMs / 1000, selectedDurationMs / 1000);
  const rendered = await offline.startRendering();
  return {
    wav: audioBufferToWav(rendered, `${file.name.replace(/\.[^.]+$/, "")}.wav`),
    durationMs: Math.ceil((frames * 1000) / sampleRate),
  };
}

export function audioBufferToWav(rendered: AudioBuffer, name: string): File {
  return new File([wavBytes(rendered)], name, { type: "audio/wav" });
}

/** Rendered audio as a 16-bit stereo PCM WAV (mono is duplicated); shared with the app's renderer. */
export function wavBytes(
  rendered: Pick<AudioBuffer, "length" | "sampleRate" | "numberOfChannels" | "getChannelData">,
): ArrayBuffer {
  const frames = rendered.length;
  const sampleRate = rendered.sampleRate;
  const bytes = new ArrayBuffer(44 + frames * 4);
  const view = new DataView(bytes);
  const writeText = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index++)
      view.setUint8(offset + index, value.charCodeAt(index));
  };
  writeText(0, "RIFF");
  view.setUint32(4, 36 + frames * 4, true);
  writeText(8, "WAVE");
  writeText(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 2, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 4, true);
  view.setUint16(32, 4, true);
  view.setUint16(34, 16, true);
  writeText(36, "data");
  view.setUint32(40, frames * 4, true);
  const left = rendered.getChannelData(0);
  const right = rendered.getChannelData(Math.min(1, rendered.numberOfChannels - 1));
  for (let frame = 0; frame < frames; frame++) {
    const l = Math.max(-1, Math.min(1, left[frame]));
    const r = Math.max(-1, Math.min(1, right[frame]));
    view.setInt16(44 + frame * 4, Math.round(l * 32767), true);
    view.setInt16(46 + frame * 4, Math.round(r * 32767), true);
  }
  return bytes;
}
