import { readFile, unlink } from "@dr.pogodin/react-native-fs";
import { getDocumentAsync } from "expo-document-picker";

import type { NativeAudioFile } from "../src/lib/native-bridge-protocol";

/**
 * The system file picker for a JSON note file; null when cancelled. Pickers report .json files with
 * different MIME types (application/json, octet-stream, text), so any file is offered and the
 * extension decides, as the web's `accept=".json"` input does.
 */
export async function pickJson(): Promise<NativeAudioFile | null> {
  const result = await getDocumentAsync({ type: "*/*", copyToCacheDirectory: true });
  const asset = result.canceled ? undefined : result.assets[0];
  if (!asset) return null;
  const path = decodeURI(asset.uri.replace(/^file:\/\//, ""));
  try {
    if (!/\.json$/i.test(asset.name)) throw new Error("JSON 음표 파일(.json)을 선택해 주세요.");
    return { name: asset.name, type: "application/json", base64: await readFile(path, "base64") };
  } finally {
    // The picker's cache copy is no longer needed once the web has the bytes.
    await unlink(path).catch(() => {});
  }
}
