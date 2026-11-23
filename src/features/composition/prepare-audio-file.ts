const sampleRate = 44_100;

export type AudioClipSegment = { startMs: number; endMs: number };

export type AudioSelection = {
  startMs: number;
  endMs: number;
  /** Optional ordered sub-segments to splice together; defaults to [{ startMs, endMs }]. */
  segments?: AudioClipSegment[];
};

function applySeamMicroFade(rendered: AudioBuffer, seamFrames: number[]) {
  if (!seamFrames.length || typeof rendered.getChannelData !== "function") return;
  const halfFade = Math.min(132, Math.floor(rendered.length / 4));
  if (halfFade < 2) return;
  const channels = Math.max(1, rendered.numberOfChannels);
  for (let ch = 0; ch < channels; ch += 1) {
    const data = rendered.getChannelData(ch);
    for (const seam of seamFrames) {
      for (let offset = 1; offset <= halfFade; offset += 1) {
        const gain = offset / (halfFade + 1);
        const before = seam - offset;
        if (before >= 0 && before < data.length) data[before] *= gain;
        const after = seam + offset - 1;
        if (after >= 0 && after < data.length) data[after] *= gain;
      }
    }
  }
}

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
  if (!Number.isFinite(fullDurationMs) || fullDurationMs <= 0) {
    throw new Error("선택한 오디오 구간이 올바르지 않습니다.");
  }
  const rawSegments: AudioClipSegment[] = selection?.segments?.length
    ? selection.segments
    : [{ startMs: selection?.startMs ?? 0, endMs: selection?.endMs ?? fullDurationMs }];

  const normalized = rawSegments.map((segment) => {
    const startMs = segment.startMs;
    const requestedEndMs = segment.endMs;
    if (
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
    return { startMs, endMs, durationMs: endMs - startMs };
  });

  const selectedDurationMs = normalized.reduce((sum, segment) => sum + segment.durationMs, 0);
  if (selectedDurationMs <= 0 || selectedDurationMs > 60_000) {
    throw new Error("선택 구간은 1분 이하여야 합니다.");
  }

  const frames = Math.max(1, Math.floor((selectedDurationMs * sampleRate) / 1000));
  const offline = new OfflineAudioContext(2, frames, sampleRate);
  if (normalized.length === 1) {
    const source = offline.createBufferSource();
    source.buffer = decoded;
    source.connect(offline.destination);
    source.start(0, normalized[0].startMs / 1000, normalized[0].durationMs / 1000);
    const rendered = await offline.startRendering();
    return {
      wav: audioBufferToWav(rendered, `${file.name.replace(/\.[^.]+$/, "")}.wav`),
      durationMs: Math.ceil((frames * 1000) / sampleRate),
    };
  }

  let cursorSec = 0;
  const seamFrames: number[] = [];
  for (let index = 0; index < normalized.length; index += 1) {
    const segment = normalized[index];
    const segDurationSec = segment.durationMs / 1000;
    const source = offline.createBufferSource();
    source.buffer = decoded;
    source.connect(offline.destination);
    source.start(cursorSec, segment.startMs / 1000, segDurationSec);
    if (index > 0) seamFrames.push(Math.round(cursorSec * sampleRate));
    cursorSec += segDurationSec;
  }
  const rendered = await offline.startRendering();
  applySeamMicroFade(rendered, seamFrames);
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
