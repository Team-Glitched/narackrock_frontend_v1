"use client";

const sampleRate = 44_100;

export async function prepareAudioFile(file: File): Promise<{ wav: File; durationMs: number }> {
  const decoder = new AudioContext();
  let decoded: AudioBuffer;
  try {
    decoded = await decoder.decodeAudioData(await file.arrayBuffer());
  } catch {
    throw new Error("이 오디오 파일을 읽을 수 없습니다.");
  } finally {
    await decoder.close();
  }
  if (decoded.duration <= 0 || decoded.duration > 60) throw new Error("오디오는 1분 이하여야 합니다.");

  const frames = Math.ceil(decoded.duration * sampleRate);
  const offline = new OfflineAudioContext(2, frames, sampleRate);
  const source = offline.createBufferSource();
  source.buffer = decoded;
  source.connect(offline.destination);
  source.start();
  const rendered = await offline.startRendering();
  const bytes = new ArrayBuffer(44 + frames * 4);
  const view = new DataView(bytes);
  const writeText = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index++) view.setUint8(offset + index, value.charCodeAt(index));
  };
  writeText(0, "RIFF"); view.setUint32(4, 36 + frames * 4, true); writeText(8, "WAVE");
  writeText(12, "fmt "); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
  view.setUint16(22, 2, true); view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 4, true); view.setUint16(32, 4, true); view.setUint16(34, 16, true);
  writeText(36, "data"); view.setUint32(40, frames * 4, true);
  const left = rendered.getChannelData(0);
  const right = rendered.getChannelData(1);
  for (let frame = 0; frame < frames; frame++) {
    const l = Math.max(-1, Math.min(1, left[frame]));
    const r = Math.max(-1, Math.min(1, right[frame]));
    view.setInt16(44 + frame * 4, Math.round(l * 32767), true);
    view.setInt16(46 + frame * 4, Math.round(r * 32767), true);
  }
  const name = `${file.name.replace(/\.[^.]+$/, "")}.wav`;
  return { wav: new File([bytes], name, { type: "audio/wav" }), durationMs: Math.ceil(decoded.duration * 1000) };
}
