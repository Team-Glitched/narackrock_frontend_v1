import { CachesDirectoryPath, writeFile } from "@dr.pogodin/react-native-fs";
import { isAvailableAsync, shareAsync } from "expo-sharing";

/**
 * Writes a web-generated file to the app cache and opens the share sheet for it. The copy stays in
 * the cache (the OS clears it): the receiving app may still be reading it after the sheet closes.
 */
export async function shareFile(file: { name: string; type: string; base64: string }) {
  if (!(await isAvailableAsync())) throw new Error("이 기기에서는 파일을 내보낼 수 없습니다.");
  const path = `${CachesDirectoryPath}/${file.name.replace(/[^\w.-]/g, "_")}`;
  await writeFile(path, file.base64, "base64");
  await shareAsync(`file://${path}`, { mimeType: file.type, dialogTitle: file.name });
}
