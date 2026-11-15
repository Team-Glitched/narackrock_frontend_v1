import {
  launchImageLibraryAsync,
  UIImagePickerPreferredAssetRepresentationMode,
} from "expo-image-picker";

import type { NativePickedImage } from "../src/lib/native-bridge-protocol";

/** Formats the web's image inputs accept. */
const accepted = ["image/jpeg", "image/png", "image/webp", "image/gif"];

/** The system photo picker; null when cancelled. The original file, as the web's file input sends. */
export async function pickImage(): Promise<NativePickedImage | null> {
  const result = await launchImageLibraryAsync({
    mediaTypes: ["images"],
    base64: true,
    quality: 1,
    // iOS: HEIC photos come back as JPEG.
    preferredAssetRepresentationMode: UIImagePickerPreferredAssetRepresentationMode.Compatible,
  });
  const asset = result.canceled ? undefined : result.assets[0];
  if (!asset?.base64) return null;
  const type = asset.mimeType ?? "";
  if (!accepted.includes(type))
    throw new Error("지원하지 않는 이미지 형식입니다. JPG, PNG, WEBP, GIF 이미지를 선택해 주세요.");
  return { name: asset.fileName ?? `image.${type.split("/")[1]}`, type, base64: asset.base64 };
}
