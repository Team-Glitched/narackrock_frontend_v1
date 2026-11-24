// `audio-record`: microphone recording for the web's record screens, with a live level feed for
// native screens (`useRecordingLevels`).
import { readFile, unlink } from "@dr.pogodin/react-native-fs";
import { Platform } from "react-native";
import { AudioManager, AudioRecorder, FileFormat, FilePreset } from "react-native-audio-api";

import type { NativeAudioFile } from "../../src/lib/native-bridge-protocol";
import { peak } from "./logic.ts";

/** Recent normalized peaks kept for the meter (newest last). */
const levelCapacity = 256;

let recorder: { instance: AudioRecorder; name: string; type: string } | null = null;
let levels: number[] = [];
const levelListeners = new Set<() => void>();

function setLevels(next: number[]): void {
  levels = next;
  for (const listener of levelListeners) listener();
}

export function recordingLevels(): number[] {
  return levels;
}

export function subscribeRecordingLevels(listener: () => void): () => void {
  levelListeners.add(listener);
  return () => void levelListeners.delete(listener);
}

/** iOS needs a recording session category while the microphone is open; Android ignores it. */
function setRecordingSession(recording: boolean): void {
  if (Platform.OS !== "ios") return;
  AudioManager.setSystemOptions({
    ios: recording
      ? {
          category: "playAndRecord",
          mode: "default",
          options: ["defaultToSpeaker", "allowBluetoothA2DP"],
        }
      : { category: "playback", mode: "default", options: [] },
  });
}

/** AAC (small enough to cross the bridge quickly); WAV where the platform has no AAC encoder. */
function enableOutput(instance: AudioRecorder): { name: string; type: string } {
  const fileName = `recording-${Date.now()}`;
  try {
    instance.enableFileOutput({
      format: FileFormat.M4A,
      preset: FilePreset.Medium,
      channelCount: 1,
      fileName,
    });
    return { name: "recording.m4a", type: "audio/mp4" };
  } catch {
    instance.enableFileOutput({
      format: FileFormat.Wav,
      preset: FilePreset.Medium,
      channelCount: 1,
      fileName,
    });
    return { name: "recording.wav", type: "audio/wav" };
  }
}

async function finish(keep: boolean): Promise<NativeAudioFile | null> {
  const current = recorder;
  recorder = null;
  setLevels([]);
  if (!current) return null;
  current.instance.clearOnAudioReady();
  current.instance.clearOnError();
  const result = await current.instance.stop().finally(() => setRecordingSession(false));
  if (result.status === "error") throw new Error(result.message);
  const paths = result.paths.map((path) => decodeURI(path.replace(/^file:\/\//, "")));
  try {
    const path = paths[0];
    if (!keep || !path) return null;
    return { name: current.name, type: current.type, base64: await readFile(path, "base64") };
  } finally {
    await Promise.all(paths.map((path) => unlink(path).catch(() => {})));
  }
}

async function start(): Promise<void> {
  await finish(false);
  if ((await AudioManager.requestRecordingPermissions()) !== "Granted")
    throw new Error("마이크 권한을 확인해 주세요.");
  setRecordingSession(true);
  const instance = new AudioRecorder();
  try {
    const format = enableOutput(instance);
    instance.onAudioReady(
      { sampleRate: 44_100, bufferLength: 1024, channelCount: 1 },
      ({ buffer }) => {
        if (recorder?.instance !== instance) return;
        const next = [...levels, peak(buffer.getChannelData(0))];
        setLevels(next.length > levelCapacity ? next.slice(-levelCapacity) : next);
      },
    );
    const result = await instance.start();
    if (result.status === "error") throw new Error(result.message);
    recorder = { instance, ...format };
  } catch (cause) {
    instance.clearOnAudioReady();
    setRecordingSession(false);
    throw cause;
  }
}

/** Starts (null), stops (the recording) or cancels (null) the microphone recording. */
export async function record(op: "start" | "stop" | "cancel"): Promise<NativeAudioFile | null> {
  if (op === "start") {
    await start();
    return null;
  }
  return finish(op === "stop");
}

/** Discards a recording in progress (the page reloaded). */
export function cancelRecording(): void {
  void finish(false).catch(() => {});
}

/**
 * Record screen count-in: asks for the microphone and opens the iOS recording session before the
 * first click, so Start after the last beat only has to open the input.
 */
export async function prepareRecording(): Promise<void> {
  if ((await AudioManager.requestRecordingPermissions()) !== "Granted")
    throw new Error("마이크 권한을 확인해 주세요.");
  setRecordingSession(true);
}

/** A cancelled count-in returns the session to playback unless a recording owns it. */
export function releasePreparedRecording(): void {
  if (!recorder) setRecordingSession(false);
}

/** The count-in's recheck before Start: the permission can be revoked while counting. */
export async function microphoneGranted(): Promise<boolean> {
  return (await AudioManager.checkRecordingPermissions()) === "Granted";
}

/**
 * App launch: asks for the microphone up front. Recording still asks when it is missing (denied
 * here, or revoked later); the OS stops showing the prompt once the user chose "don't ask again".
 */
export async function requestMicrophoneAtLaunch(): Promise<void> {
  if ((await AudioManager.checkRecordingPermissions()) === "Granted") return;
  await AudioManager.requestRecordingPermissions();
}
