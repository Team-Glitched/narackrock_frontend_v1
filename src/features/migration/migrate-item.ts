import { apiOrigin, getCurrentUserId } from "@/lib/api/client";
import { listAllBookmarkedPosts, listAllBookmarkedShorts } from "@/lib/api/bookmarks";
import { fetchPost, togglePostBookmark } from "@/lib/api/community";
import { getShort, toggleShortBookmark } from "@/lib/api/shorts";
import {
  getOpenSource,
  setOpenSourceSaved,
  createOpenSource,
  listMyOpenSourcePublications,
} from "@/lib/api/open-sources";
import { getComposition, uploadMedia, type MidiNoteDto } from "@/lib/api/composition";
import { saveEditorDraft, getEditorDrafts } from "@/lib/api/composition-drafts";
import { readBrowserRecord } from "@/lib/browser/records";
import { rememberWork } from "@/features/workspace/workspace-store";
import { findInstrument, invalidPitchesFor } from "@/features/composition/instrument-catalog";
import {
  migrationKey,
  migrateBookmark,
  migratePrivateAudio,
  type MigrationJournal,
} from "./migration-journal";
import { restoreCreationDraft } from "@/features/community/creation-draft";
import { type LegacyItem, recoveryComposition } from "./legacy-items";

export function migrationEntry(item: LegacyItem, userId: number): MigrationJournal | null {
  try {
    return JSON.parse(
      localStorage.getItem(migrationKey(apiOrigin(), userId, item.kind, item.key)) ?? "null",
    );
  } catch {
    return null;
  }
}
export async function legacyAudio(item: LegacyItem): Promise<File | null> {
  if (item.mediaKey) return (await readBrowserRecord<File>(item.mediaKey)) ?? null;
  if (item.storageKey.startsWith("narackrock.creation-draft.")) {
    const draft = await restoreCreationDraft(
      item.storageKey.slice("narackrock.creation-draft.".length),
    );
    return draft?.audio ?? null;
  }
  return null;
}
const sameMetadata = (item: LegacyItem, title: string, author: string | null, ownerId?: number) => {
  if (
    item.title !== title ||
    !item.author ||
    item.author !== author ||
    (item.ownerId !== null && item.ownerId !== ownerId)
  )
    throw new Error(
      "제목·작성자·소유권이 서버 자료와 일치하지 않습니다. 숫자 ID만으로 이관하지 않습니다.",
    );
};

/** Called only for one checked item. A browser/account lock serializes all read-before-write decisions. */
export async function migrateItem(
  item: LegacyItem,
  userId: number,
  ownsAudio: boolean,
  target?: { projectId: number; trackId: number },
) {
  if (!navigator.locks)
    throw new Error("Web Lock을 지원하는 브라우저에서만 안전하게 이관할 수 있습니다.");
  const origin = apiOrigin();
  const assertAccount = () => {
    if (getCurrentUserId() !== userId || apiOrigin() !== origin)
      throw new Error("계정 또는 서버가 변경되었습니다.");
  };
  const key = migrationKey(origin, userId, item.kind, item.key);
  const journal = (entry: MigrationJournal) => {
    assertAccount();
    localStorage.setItem(key, JSON.stringify(entry));
  };
  try {
    return await navigator.locks.request(`narackrock.migration:${origin}:${userId}`, async () => {
      assertAccount();
      if (item.kind === "post" || item.kind === "song") {
        if (item.id === null) throw new Error("유효한 원본 ID가 없습니다.");
        const id = item.id;
        await migrateBookmark({
          validate: async () => {
            assertAccount();
            if (item.kind === "post") {
              const detail = await fetchPost(id);
              sameMetadata(item, detail.title, detail.writer.nickname, detail.writer.userId);
              return detail.isBookmarked;
            } else {
              const detail = await getShort(id);
              sameMetadata(item, detail.title, detail.author.nickname, detail.author.userId);
              return detail.isBookmarked;
            }
          },
          readSaved: async () => {
            assertAccount();
            return item.kind === "post"
              ? (await listAllBookmarkedPosts()).some((row) => row.postId === id)
              : (await listAllBookmarkedShorts()).some((row) => row.shortId === id);
          },
          toggle: async () => {
            assertAccount();
            return item.kind === "post" ? togglePostBookmark(id) : toggleShortBookmark(id);
          },
          journal,
        });
      } else if (item.kind === "source") {
        if (item.id === null) throw new Error("유효한 원본 ID가 없습니다.");
        const source = await getOpenSource(item.id);
        sameMetadata(item, source.title, source.writer.nickname, source.writer.userId);
        assertAccount();
        await setOpenSourceSaved(item.id, true);
        if (!(await getOpenSource(item.id)).isSaved)
          throw new Error("서버 저장을 확인하지 못했습니다.");
        journal({ phase: "done", message: "서버 보관 확인" });
      } else if (item.kind === "audio") {
        if (!ownsAudio) throw new Error("직접 작성·소유한 오디오임을 확인해주세요.");
        const file = await legacyAudio(item);
        if (!file) throw new Error("원본 오디오 파일이 없습니다. 메타데이터만 내보낼 수 있습니다.");
        const payload = {
          title: item.title,
          description: "브라우저 원본에서 동의 후 비공개로 이전",
        };
        await migratePrivateAudio({
          previous: migrationEntry(item, userId),
          payload,
          uploadIdentity: {
            name: file.name,
            size: file.size,
            type: file.type,
            lastModified: file.lastModified,
          },
          list: async () => {
            assertAccount();
            const all = [];
            for (let page = 0; ; page++) {
              const result = await listMyOpenSourcePublications(page);
              all.push(...result.items);
              if (!result.hasNext) return all;
            }
          },
          upload: async (onSession) => {
            assertAccount();
            return uploadMedia(file, "AUDIO", onSession);
          },
          create: async (mediaFileId) => {
            assertAccount();
            return createOpenSource({ ...payload, mediaFileId, thumbnailMediaFileId: null });
          },
          journal,
        });
      } else if (item.kind === "work") {
        if (item.id === null) throw new Error("프로젝트 ID가 없습니다.");
        const composition = await getComposition(item.id);
        if (composition.project.title !== item.title)
          throw new Error("서버 프로젝트 제목이 원본과 다릅니다.");
        if (
          composition.project.ownerId !== userId &&
          !composition.tracks.some((track) => track.ownerId === userId)
        )
          throw new Error("현재 계정의 작업·참여 여부를 확인할 수 없습니다.");
        assertAccount();
        rememberWork(composition, null);
        journal({ phase: "done", message: "현재 계정·서버의 방문 이력에 추가" });
      } else if (item.kind === "midi") {
        if (!target) throw new Error("대상 프로젝트와 내 MIDI 트랙을 선택해주세요.");
        if (migrationEntry(item, userId)?.phase === "done") return;
        const composition = await getComposition(target.projectId);
        const track = composition.tracks.find((row) => row.trackId === target.trackId);
        const instrument = findInstrument(track?.instrument);
        if (
          !track ||
          track.ownerId !== userId ||
          !instrument ||
          !["DRAFT", "IN_PROGRESS"].includes(composition.project.status) ||
          !(composition.viewerPermission.canContribute || composition.viewerPermission.canEdit)
        )
          throw new Error("편집 가능한 내 MIDI 트랙이 아닙니다.");
        if (
          (await getEditorDrafts(target.projectId)).some(
            (draft) => draft.trackId === target.trackId && draft.targetClipId === null,
          )
        )
          throw new Error("대상에 이미 새 클립 초안이 있습니다. 피아노롤에서 가져와주세요.");
        const source = recoveryComposition(item);
        if (!source || !Array.isArray(source.tracks))
          throw new Error("유효한 MIDI 원본이 없습니다.");
        if (
          !source.project ||
          typeof source.project !== "object" ||
          !("ppq" in source.project) ||
          typeof source.project.ppq !== "number" ||
          !Number.isSafeInteger(source.project.ppq) ||
          source.project.ppq <= 0
        )
          throw new Error("원본 MIDI의 PPQ를 확인할 수 없습니다.");
        const ratio = composition.project.ppq / source.project.ppq;
        const notes: MidiNoteDto[] = [];
        for (const sourceTrack of source.tracks) {
          if (!sourceTrack || !Array.isArray(sourceTrack.clips))
            throw new Error("원본 MIDI 트랙이 잘못되었습니다.");
          for (const clip of sourceTrack.clips) {
            if (
              clip.clipType !== "MIDI" ||
              !Array.isArray(clip.midiNotes) ||
              !Number.isSafeInteger(clip.startTick) ||
              clip.startTick < 0
            )
              throw new Error("유효한 MIDI 노트만 가져올 수 있습니다.");
            for (const note of clip.midiNotes) {
              if (
                !Number.isInteger(note.pitch) ||
                note.pitch < 0 ||
                note.pitch > 127 ||
                !Number.isSafeInteger(note.startTick) ||
                note.startTick < 0 ||
                !Number.isSafeInteger(note.durationTick) ||
                note.durationTick <= 0 ||
                !Number.isInteger(note.velocity) ||
                note.velocity < 0 ||
                note.velocity > 127
              )
                throw new Error("원본 노트가 잘못되었습니다.");
              notes.push({
                pitch: note.pitch,
                startTick: Math.round((note.startTick + clip.startTick) * ratio),
                durationTick: Math.max(1, Math.round(note.durationTick * ratio)),
                velocity: note.velocity,
                effectType: note.effectType ?? null,
                effectParams: note.effectParams ?? {},
              });
            }
          }
        }
        if (
          !notes.length ||
          invalidPitchesFor(
            instrument,
            notes.map((note) => note.pitch),
          ).length
        )
          throw new Error("노트가 없거나 악기 음역에 맞지 않습니다.");
        const durationTick = Math.max(...notes.map((note) => note.startTick + note.durationTick));
        const startTick = Math.max(
          0,
          ...track.clips.map((clip) => clip.startTick + clip.durationTick),
        );
        if (startTick + durationTick > composition.project.maxTick)
          throw new Error(
            "대상 트랙 뒤에 가져올 공간이 없습니다. 피아노롤에서 기존 클립의 개인 초안으로 가져와주세요.",
          );
        assertAccount();
        await saveEditorDraft(target.projectId, target.trackId, crypto.randomUUID(), {
          expectedRevision: 0,
          mutationId: crypto.randomUUID(),
          targetClipId: null,
          baseClip: null,
          content: { startTick, durationTick, midiNotes: notes },
        });
        journal({ phase: "done", message: "개인 MIDI 초안 저장 · 공유본 미반영" });
      } else throw new Error("이 자료는 자동 이관할 서버 계약이 없습니다. 원본을 내보내주세요.");
    });
  } catch (cause) {
    if (getCurrentUserId() === userId && apiOrigin() === origin) {
      const previous = migrationEntry(item, userId);
      if (!previous || !["sending", "creating", "uncertain", "done"].includes(previous.phase))
        journal({
          ...previous,
          phase: "failed",
          message: cause instanceof Error ? cause.message : "이관 실패",
        });
    }
    throw cause;
  }
}
