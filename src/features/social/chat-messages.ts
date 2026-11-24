import type { ChatMessage } from "../../lib/api/social.ts";
import {
  CHAT_MESSAGE_MAX_LENGTH,
  codePointLength,
  hasVisibleText,
  sanitizeMultiline,
} from "../../lib/content-limits.ts";

export { CHAT_MESSAGE_MAX_LENGTH };

/** Normalizes line breaks, strips invisible characters, and checks the 2000-character limit. */
export function chatMessageContent(draft: string): string | null {
  const content = sanitizeMultiline(draft);
  if (!content || !hasVisibleText(content)) return null;
  return codePointLength(content) <= CHAT_MESSAGE_MAX_LENGTH ? content : null;
}
export function isChatMessageDeleted(
  message: Pick<ChatMessage, "deleted" | "isDeleted">,
): boolean {
  return Boolean(message.deleted ?? message.isDeleted);
}

function parseTimestamp(value?: string | null): { ms: number; subNs: number } | null {
  if (!value) return null;
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) return null;
  const fraction = /\.(\d+)/.exec(value)?.[1] ?? "";
  const subNs = Number(fraction.slice(0, 9).padEnd(9, "0").slice(3));
  return { ms, subNs };
}

function compareEditedAt(a?: string | null, b?: string | null): number {
  if (!a && !b) return 0;
  if (a && !b) return 1;
  if (!a && b) return -1;
  if (a === b) return 0;
  const parsedA = parseTimestamp(a);
  const parsedB = parseTimestamp(b);
  if (parsedA && parsedB) {
    if (parsedA.ms !== parsedB.ms) return parsedA.ms < parsedB.ms ? -1 : 1;
    if (parsedA.subNs !== parsedB.subNs) return parsedA.subNs < parsedB.subNs ? -1 : 1;
    return 0;
  }
  return a! < b! ? -1 : a! > b! ? 1 : 0;
}

function normalizeChatMessage(message: ChatMessage): ChatMessage {
  const deleted = isChatMessageDeleted(message);
  return { ...message, deleted, content: deleted ? "" : message.content };
}

function preferChatMessage(existing: ChatMessage | undefined, incoming: ChatMessage): ChatMessage {
  const next = normalizeChatMessage(incoming);
  if (!existing) return next;
  // Deletion is terminal so late REST history captured prior to delete never resurrects the message.
  if (existing.deleted) return existing;
  if (next.deleted) return next;
  // The server increments `revision` inside the committed update, so it orders concurrent edits even when their
  // `editedAt` timestamps (taken before the write lock) disagree. Older servers omit it; fall back to `editedAt`.
  const order =
    isRevision(next.revision) && isRevision(existing.revision)
      ? next.revision - existing.revision
      : compareEditedAt(next.editedAt, existing.editedAt);
  return order < 0 ? existing : next;
}

function isRevision(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/**
 * Merges REST pages, send responses and STOMP deliveries for one conversation. The same message arrives through
 * several paths (send response + socket, reconnect backfill, polling), so messages are keyed by server ID and kept
 * in ID order; messages of other conversations are ignored.
 */
export function mergeChatMessages(
  current: ChatMessage[],
  incoming: ChatMessage[],
  me: number,
  friendId: number,
): ChatMessage[] {
  const byId = new Map(
    current.map((message) => [message.id, normalizeChatMessage(message)]),
  );
  for (const message of incoming) {
    const inConversation =
      (message.senderId === me && message.recipientId === friendId) ||
      (message.senderId === friendId && message.recipientId === me);
    if (inConversation) {
      byId.set(message.id, preferChatMessage(byId.get(message.id), message));
    }
  }
  return [...byId.values()].sort((a, b) => a.id - b.id);
}
