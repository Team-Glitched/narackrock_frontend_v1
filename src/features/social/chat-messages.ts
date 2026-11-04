import type { ChatMessage } from "../../lib/api/social.ts";

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
  const byId = new Map(current.map((message) => [message.id, message]));
  for (const message of incoming) {
    const inConversation =
      (message.senderId === me && message.recipientId === friendId) ||
      (message.senderId === friendId && message.recipientId === me);
    if (inConversation) byId.set(message.id, message);
  }
  return [...byId.values()].sort((a, b) => a.id - b.id);
}
