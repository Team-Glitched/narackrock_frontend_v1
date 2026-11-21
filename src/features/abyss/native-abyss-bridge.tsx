import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { useLoginPrompt } from "@/features/auth/login-prompt";
import { useComments } from "@/features/comments/use-comments";
import { useNativeComments } from "@/features/comments/use-native-comments";
import { useNativeScreen } from "@/features/navigation/use-native-screen";
import type { ShortItemDto } from "@/lib/api/contracts";
import type {
  NativeAbyss,
  NativeAbyssAction,
  NativeAbyssCover,
  NativeAbyssParticipants,
  NativeAbyssSheet,
  NativeHeader,
} from "@/lib/native-screens";
import { isNativeCommentAction } from "@/lib/native-screens/comments";
import type { AbyssState } from "./abyss-screen";
import { useShortCommentAdapter } from "./abyss-comments";
import { participantRole, useShortParticipants } from "./short-participants";
import { participationLabel } from "./short-participation";

/** The abyss page's Header: back button, notifications, chat, search, account. */
const header: NativeHeader = { left: "back", actions: ["notifications", "chat", "search", "account"] };

/** Swiping rewrites /abyss/:shortId with `replace`; one app entry keeps the screen (and its carousel) mounted. */
const path = "/abyss";

/** Position updates are rounded down to this step, so playback resends the model at most 4 times a second. */
const POSITION_STEP_MS = 250;

type SheetHandler = RefObject<((action: NativeAbyssAction) => void) | null>;
type SheetReport = (sheet: NativeAbyssSheet | null) => void;

const cover = (short: ShortItemDto): NativeAbyssCover => ({
  shortId: short.shortId,
  title: short.title,
  albumImageUrl: short.albumImageUrl?.trim() || null,
});

function abyssModel(abyss: AbyssState, sheet: NativeAbyssSheet | null): NativeAbyss {
  const { selectedShort: current, playback, shorts, index, participation } = abyss;
  if (abyss.status !== "ready" || !current)
    return { status: abyss.status === "ready" ? "empty" : abyss.status };
  const messages: { text: string; alert: boolean }[] = [];
  if (playback.selection !== null)
    messages.push({
      text:
        playback.selection.size === 0
          ? "선택한 참여자가 없어 재생을 멈췄습니다."
          : `선택한 참여자 ${playback.selection.size}명의 트랙만 재생합니다.`,
      alert: false,
    });
  if (playback.selection === null && !abyss.mediaUrl)
    messages.push({ text: "재생 가능한 음원 파일이 없습니다.", alert: false });
  if (playback.selection === null && abyss.mediaFailed)
    messages.push({ text: "음원 파일을 불러오지 못했습니다.", alert: true });
  if (playback.error) messages.push({ text: playback.error, alert: true });
  const totalMs = Math.max(0, playback.totalMs);
  const positionMs = Math.min(Math.max(0, playback.positionMs), totalMs || Infinity);
  return {
    status: "ready",
    short: {
      ...cover(current),
      author: { userId: current.author.userId, nickname: current.author.nickname },
      likeCount: current.likeCount,
      dislikeCount: current.dislikeCount,
      commentCount: current.commentCount,
      vote: current.isLiked ? "like" : current.isDisliked ? "dislike" : null,
      saved: current.isBookmarked,
    },
    previous: index > 0 ? cover(shorts[index - 1]) : null,
    next: index < shorts.length - 1 ? cover(shorts[index + 1]) : null,
    position: index + 1,
    count: shorts.length,
    canPrevious: shorts.length >= 2,
    canNext: abyss.hasNext && !abyss.loadingMore,
    playback: {
      playing: playback.playing,
      canPlay: playback.canPlay,
      positionMs: Math.floor(positionMs / POSITION_STEP_MS) * POSITION_STEP_MS,
      totalMs,
    },
    messages,
    nextFailed: abyss.nextFailed,
    busy: abyss.busy,
    feedback: abyss.feedback,
    join:
      participation && current.projectId != null
        ? {
            label: participationLabel[participation],
            secondary: participation !== "joinable",
            busy: abyss.requestBusy,
          }
        : null,
    sheet: sheet && sheet.kind === abyss.sheet ? sheet : null,
  };
}

/**
 * In the app the abyss page is drawn natively (native/screens/abyss). The page keeps the feed and the playback: the
 * `<audio>` and the owner-subset engine stay in the (hidden) web view and the native screen sends the controls.
 */
export function NativeAbyssBridge({
  abyss,
  onSearch,
}: {
  abyss: AbyssState;
  onSearch: () => void;
}) {
  const [sheet, setSheet] = useState<NativeAbyssSheet | null>(null);
  const report = useCallback<SheetReport>((next) => setSheet(next), []);
  const sheetHandler: SheetHandler = useRef(null);
  const { selectedShort: current, playback } = abyss;
  const sheetOpen = (kind: NativeAbyssSheet["kind"]) =>
    sheet?.kind === kind && abyss.sheet === kind;
  const node = useNativeScreen("abyss", abyssModel(abyss, sheet), {
    header,
    onSearch,
    path,
    onAction: (action) => {
      if (isNativeCommentAction(action)) {
        if (sheetOpen("comments")) sheetHandler.current?.(action);
        return;
      }
      switch (action.type) {
        case "abyss-retry":
          return abyss.retry();
        case "abyss-previous":
          return abyss.selectPrevious();
        case "abyss-next":
          return void abyss.selectNext();
        case "abyss-toggle":
          if (playback.canPlay) void playback.toggle();
          return;
        case "abyss-seek":
          if (playback.totalMs > 0)
            playback.seek(Math.min(Math.max(0, action.ms), playback.totalMs));
          return;
        case "abyss-vote":
          return abyss.vote(action.vote);
        case "abyss-save":
          return abyss.bookmark();
        case "abyss-share":
          return abyss.share();
        case "abyss-report":
          return abyss.openReport();
        case "abyss-profile":
          return abyss.openProfile(action.userId);
        case "abyss-join":
          if (!abyss.requestBusy) abyss.join();
          return;
        case "abyss-comments":
          return abyss.openComments();
        case "abyss-participants":
          return abyss.openParticipants();
        case "abyss-close-sheet":
          if (abyss.sheet === "participants") abyss.closeParticipants();
          else if (abyss.sheet === "comments") abyss.closeSheet();
          return;
        case "abyss-participants-op":
        case "abyss-participant-toggle":
          if (sheetOpen("participants")) sheetHandler.current?.(action);
          return;
      }
    },
  });
  return (
    <>
      {node}
      {current && abyss.sheet === "comments" && (
        <CommentsSource
          key={`${current.shortId}:${abyss.currentUserId ?? "guest"}`}
          abyss={abyss}
          shortId={current.shortId}
          handler={sheetHandler}
          onSheet={report}
        />
      )}
      {current && abyss.sheet === "participants" && (
        <ParticipantsSource
          key={current.shortId}
          abyss={abyss}
          short={current}
          handler={sheetHandler}
          onSheet={report}
        />
      )}
    </>
  );
}

/** Reports a sheet's model when it changes and routes its actions while it is mounted. */
function useSheetReport(
  sheet: NativeAbyssSheet,
  act: (action: NativeAbyssAction) => void,
  handlerRef: SheetHandler,
  onSheet: SheetReport,
) {
  const json = JSON.stringify(sheet);
  useEffect(() => {
    handlerRef.current = act;
  });
  useEffect(() => onSheet(JSON.parse(json) as NativeAbyssSheet), [json, onSheet]);
  useEffect(() => () => onSheet(null), [onSheet]);
}

/** The short's comments (the web's AbyssComments sheet) for the native sheet. */
function CommentsSource({
  abyss,
  shortId,
  handler,
  onSheet,
}: {
  abyss: AbyssState;
  shortId: number;
  handler: SheetHandler;
  onSheet: SheetReport;
}) {
  const adapter = useShortCommentAdapter(shortId);
  const comments = useComments({
    adapter,
    currentUserId: abyss.currentUserId,
    onChanged: abyss.commentsChanged,
  });
  // The web sheet has no profile links on comments.
  const native = useNativeComments(comments, {});
  useSheetReport(
    { kind: "comments", comments: native.model },
    (action) => {
      if (isNativeCommentAction(action)) native.act(action);
    },
    handler,
    onSheet,
  );
  return <>{native.node}</>;
}

/** The participant sheet (the web's ShortParticipants) for the native sheet. */
function ParticipantsSource({
  abyss,
  short,
  handler,
  onSheet,
}: {
  abyss: AbyssState;
  short: ShortItemDto;
  handler: SheetHandler;
  onSheet: SheetReport;
}) {
  const { requestLogin } = useLoginPrompt();
  const { playback } = abyss;
  const state = useShortParticipants(short, playback);
  const participants: NativeAbyssParticipants =
    state.userId === null
      ? {
          signedIn: false,
          people: short.participants.map((person) => ({
            userId: person.userId,
            nickname: person.nickname,
            role: participantRole(short, person.userId),
          })),
        }
      : {
          signedIn: true,
          selectable: state.selectable,
          stems: { text: state.stemsText, error: playback.stems.status === "error" },
          composersLoading: state.composers.isPending,
          composersError: state.composersError,
          owners: state.owners.map((owner) => ({
            userId: owner.userId,
            nickname: owner.nickname,
            profileImageUrl: owner.profileImageUrl,
            detail: owner.detail,
            checked: owner.checked,
          })),
          empty: state.empty,
        };
  useSheetReport(
    { kind: "participants", participants },
    (action) => {
      if (action.type === "abyss-participant-toggle") {
        if (state.selectable) state.toggle(action.userId);
        return;
      }
      if (action.type !== "abyss-participants-op") return;
      switch (action.op) {
        case "select-all":
          if (state.selectable) playback.setDraft(null);
          return;
        case "clear":
          if (state.selectable) playback.setDraft(new Set());
          return;
        case "listen-all":
          return abyss.listenAll();
        case "confirm":
          return abyss.closeParticipants();
        case "retry-stems":
          return playback.retryStems();
        case "retry-composers":
          return void state.composers.refetch();
        case "login":
          return void requestLogin();
      }
    },
    handler,
    onSheet,
  );
  return null;
}

/** A malformed abyss address ("올바르지 않은 페이지 주소입니다."). */
export function NativeInvalidAbyssBridge({ onSearch }: { onSearch: () => void }) {
  return useNativeScreen("abyss", { status: "invalid" }, { header, onSearch, path });
}
