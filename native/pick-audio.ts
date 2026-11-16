import { readFile, unlink } from "@dr.pogodin/react-native-fs";
import { getDocumentAsync } from "expo-document-picker";

import type { NativeAudioFile } from "../src/lib/native-bridge-protocol";

/** The formats of the web's audio file input (wav, mp3, mp4/m4a, flac), by extension. */
const accepted: Record<string, string> = {
  wav: "audio/wav",
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  mp4: "audio/mp4",
  flac: "audio/flac",
};

/** The system file picker limited to audio; null when cancelled. The original file, as the web's input sends. */
export async function pickAudio(): Promise<NativeAudioFile | null> {
  const result = await getDocumentAsync({ type: ["audio/*"], copyToCacheDirectory: true });
  const asset = result.canceled ? undefined : result.assets[0];
  if (!asset) return null;
  const path = decodeURI(asset.uri.replace(/^file:\/\//, ""));
  try {
    const type = accepted[asset.name.split(".").pop()?.toLowerCase() ?? ""];
    if (!type)
      throw new Error("지원하지 않는 오디오 형식입니다. WAV, MP3, M4A, FLAC 파일을 선택해 주세요.");
    return { name: asset.name, type, base64: await readFile(path, "base64") };
  } finally {
    // The picker's cache copy is no longer needed once the web has the bytes.
    await unlink(path).catch(() => {});
  }
}
